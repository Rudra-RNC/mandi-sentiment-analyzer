"""
serve_api.py
------------

Run:
    python serve_api.py
    -> serving on http://localhost:5000

Endpoints:
    GET  /health              -> {"status": "ok", "model": "naive_bayes"}
    POST /predict              body: {"comment": "text"}
                                -> {"sentiment": "...", "confidence": 0.93,
                                    "probabilities": {...}}
    POST /predict/batch         body: {"comments": ["text1", "text2", ...]}
                                -> {"results": [ {...}, {...} ]}

No extra dependencies beyond Flask -- CORS headers are added manually below
so the dashboard (running on a different origin) can call this without
needing flask-cors installed.
"""
import joblib 
from flask import Flask, jsonify, request  

MODEL_PATH = "model/sentiment_model.joblib"

app = Flask(__name__)
_bundle = joblib.load(MODEL_PATH)
PIPELINE = _bundle["pipeline"]
LABELS = _bundle["labels"]
MODEL_NAME = _bundle["model_name"]


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def classify(text):
    pred = PIPELINE.predict([text])[0]
    result = {"comment": text, "sentiment": pred}
    if hasattr(PIPELINE, "predict_proba"):
        probs = PIPELINE.predict_proba([text])[0]
        prob_map = {label: round(float(p), 4) for label, p in zip(PIPELINE.classes_, probs)}
        result["confidence"] = prob_map[pred]
        result["probabilities"] = prob_map
    return result


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_NAME, "labels": LABELS})


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict_one():
    if request.method == "OPTIONS":
        return "", 204
    data = request.get_json(silent=True) or {}
    comment = data.get("comment", "").strip()
    if not comment:
        return jsonify({"error": "Provide non-empty 'comment' field."}), 400
    return jsonify(classify(comment))


@app.route("/predict/batch", methods=["POST", "OPTIONS"])
def predict_batch():
    if request.method == "OPTIONS":
        return "", 204
    data = request.get_json(silent=True) or {}
    comments = [c.strip() for c in data.get("comments", []) if c and c.strip()]
    if not comments:
        return jsonify({"error": "Provide a non-empty 'comments' array."}), 400
    return jsonify({"results": [classify(c) for c in comments]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
