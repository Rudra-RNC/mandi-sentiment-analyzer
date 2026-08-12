"""
train_model.py
---------------
Usage:
    python train_model.py --data data/mandi_feedback_dataset.csv --out model/

Outputs (written to --out):
    sentiment_model.joblib   the winning sklearn Pipeline (vectorizer + classifier)
    metrics.json             accuracy / precision / recall / F1 for both candidates
    confusion_matrix.png     confusion matrix for the winning model
"""
import argparse
import json
import os

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

LABELS = ["negative", "neutral", "positive"]


def load_data(path):
    df = pd.read_csv(path)
    df = df.dropna(subset=["comment", "sentiment"])
    df = df[df["sentiment"].isin(LABELS)]
    return df


def build_candidates():
    """Two TF-IDF + classifier pipelines to compare."""
    vectorizer_kwargs = dict(
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.9,
        sublinear_tf=True,
        strip_accents="unicode",
    )
    return {
        "naive_bayes": Pipeline(
            [
                ("tfidf", TfidfVectorizer(**vectorizer_kwargs)),
                ("clf", MultinomialNB()),
            ]
        ),
        "logistic_regression": Pipeline(
            [
                ("tfidf", TfidfVectorizer(**vectorizer_kwargs)),
                ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
            ]
        ),
    }


def evaluate(pipeline, X_test, y_test):
    preds = pipeline.predict(X_test)
    return {
        "accuracy": accuracy_score(y_test, preds),
        "macro_f1": f1_score(y_test, preds, average="macro"),
        "report": classification_report(y_test, preds, labels=LABELS, output_dict=True),
    }, preds


def main():
    parser = argparse.ArgumentParser(description="Train the mandi sentiment classifier.")
    parser.add_argument("--data", default="data/mandi_feedback_dataset.csv")
    parser.add_argument("--out", default="model/")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)

    df = load_data(args.data)
    print(f"Loaded {len(df)} labeled comments from {args.data}")
    print("Class balance:\n", df["sentiment"].value_counts())

    X_train, X_test, y_train, y_test = train_test_split(
        df["comment"], df["sentiment"],
        test_size=args.test_size, random_state=args.seed, stratify=df["sentiment"],
    )

    candidates = build_candidates()
    metrics = {}
    fitted = {}

    for name, pipeline in candidates.items():
        pipeline.fit(X_train, y_train)
        result, preds = evaluate(pipeline, X_test, y_test)
        metrics[name] = {"accuracy": result["accuracy"], "macro_f1": result["macro_f1"], "report": result["report"]}
        fitted[name] = (pipeline, preds)
        print(f"\n=== {name} ===")
        print(f"accuracy: {result['accuracy']:.3f}   macro F1: {result['macro_f1']:.3f}")
        print(classification_report(y_test, preds, labels=LABELS))

    winner = max(metrics, key=lambda k: metrics[k]["macro_f1"])
    print(f"\nBest model: {winner} (macro F1 = {metrics[winner]['macro_f1']:.3f})")

    winning_pipeline, winning_preds = fitted[winner]
    model_path = os.path.join(args.out, "sentiment_model.joblib")
    joblib.dump({"pipeline": winning_pipeline, "model_name": winner, "labels": LABELS}, model_path)
    print(f"Saved model to {model_path}")

    metrics["winner"] = winner
    metrics_path = os.path.join(args.out, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to {metrics_path}")

    fig, ax = plt.subplots(figsize=(5, 4.5))
    ConfusionMatrixDisplay.from_predictions(y_test, winning_preds, labels=LABELS, ax=ax, colorbar=False)
    ax.set_title(f"Confusion matrix \u2014 {winner}")
    fig.tight_layout()
    cm_path = os.path.join(args.out, "confusion_matrix.png")
    fig.savefig(cm_path, dpi=150)
    print(f"Saved confusion matrix to {cm_path}")


if __name__ == "__main__":
    main()
