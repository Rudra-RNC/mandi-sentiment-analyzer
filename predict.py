"""
predict.py
----------
Classify new mandi feedback comments with the trained model.

Usage:
    python predict.py "Rate was too high for onions this week"
    python predict.py --file new_comments.txt
    echo "Fresh tomatoes, good quality" | python predict.py --stdin
"""
import argparse
import sys

import joblib

MODEL_PATH_DEFAULT = "model/sentiment_model.joblib"


def load_model(path):
    bundle = joblib.load(path)
    return bundle["pipeline"], bundle["labels"], bundle["model_name"]


def predict(pipeline, labels, texts):
    preds = pipeline.predict(texts)
    results = []
    if hasattr(pipeline, "predict_proba"):
        probs = pipeline.predict_proba(texts)
        for text, pred, prob_row in zip(texts, preds, probs):
            prob_map = {label: round(float(p), 4) for label, p in zip(pipeline.classes_, prob_row)}
            confidence = prob_map[pred]
            results.append({"comment": text, "sentiment": pred, "confidence": confidence, "probabilities": prob_map})
    else:
        for text, pred in zip(texts, preds):
            results.append({"comment": text, "sentiment": pred, "confidence": None, "probabilities": None})
    return results


def main():
    parser = argparse.ArgumentParser(description="Classify mandi feedback comments.")
    parser.add_argument("comments", nargs="*", help="Comment text(s) to classify")
    parser.add_argument("--file", help="Path to a text file, one comment per line")
    parser.add_argument("--stdin", action="store_true", help="Read comments from stdin, one per line")
    parser.add_argument("--model", default=MODEL_PATH_DEFAULT)
    args = parser.parse_args()

    texts = list(args.comments)
    if args.file:
        with open(args.file, encoding="utf-8") as f:
            texts += [line.strip() for line in f if line.strip()]
    if args.stdin:
        texts += [line.strip() for line in sys.stdin if line.strip()]

    if not texts:
        parser.error("Provide comment text as an argument, --file, or --stdin.")

    pipeline, labels, model_name = load_model(args.model)
    results = predict(pipeline, labels, texts)

    for r in results:
        conf = f"{r['confidence']*100:.1f}%" if r["confidence"] is not None else "n/a"
        print(f"[{r['sentiment'].upper():8s} {conf:>6s}]  {r['comment']}")


if __name__ == "__main__":
    main()
