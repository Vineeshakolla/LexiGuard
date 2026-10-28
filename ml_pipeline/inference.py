#!/usr/bin/env python3
"""
LexiGuard Machine Learning Pipeline: Inference Module
-----------------------------------------------------
Performs fast legal clause category classification using the trained
scikit-learn vectorizer and best-performing model (Linear SVM / Logistic Regression).
Can be imported as a module or executed as a standalone CLI tool.
"""

import os
import sys
import json
import joblib
import numpy as np
from typing import Dict, List, Any

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "data", "model_artifacts")
VEC_PATH = os.path.join(ARTIFACTS_DIR, "vectorizer.joblib")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "best_model.joblib")
EXPORT_PATH = os.path.join(ARTIFACTS_DIR, "model_export.json")

class ClauseClassifier:
    def __init__(self):
        self.vectorizer = None
        self.model = None
        self.categories = []
        self.selected_model_name = "Unknown"
        self._load()

    def _load(self):
        if os.path.exists(VEC_PATH) and os.path.exists(MODEL_PATH):
            self.vectorizer = joblib.load(VEC_PATH)
            self.model = joblib.load(MODEL_PATH)
            if hasattr(self.model, "classes_"):
                if not os.path.exists(EXPORT_PATH):
                    raise FileNotFoundError(
                        f"Model export not found at {EXPORT_PATH}."
                    )
                with open(EXPORT_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.categories = data.get("categories", [])
                    self.selected_model_name = data.get(
                        "selectedModelName", type(self.model).__name__
                    )
                expected_classes = list(range(len(self.categories)))
                if self.model.classes_.tolist() != expected_classes:
                    raise ValueError(
                        "Model class indices do not match model_export.json category order."
                    )
                feature_count = len(self.vectorizer.vocabulary_)
                if getattr(self.model, "n_features_in_", None) != feature_count:
                    raise ValueError(
                        "Model feature dimension does not match the saved vectorizer vocabulary."
                    )
                if self.vectorizer.idf_.shape[0] != feature_count:
                    raise ValueError(
                        "Vectorizer IDF dimension does not match its vocabulary."
                    )
                if data.get("featureCount") != feature_count:
                    raise ValueError(
                        "model_export.json feature count does not match the Python vectorizer."
                    )
                if data.get("vocabulary") != self.vectorizer.vocabulary_:
                    raise ValueError(
                        "Python vectorizer vocabulary does not match model_export.json."
                    )
                if not np.allclose(
                    np.asarray(data.get("idf", []), dtype=float),
                    self.vectorizer.idf_,
                    rtol=0.0,
                    atol=1e-12,
                ):
                    raise ValueError(
                        "Python vectorizer IDF values do not match model_export.json."
                    )
        else:
            raise FileNotFoundError(
                f"Model artifacts not found in {ARTIFACTS_DIR}. Please run ml_pipeline/train_and_evaluate.py first."
            )

    def classify(self, text: str) -> Dict[str, Any]:
        """Classifies a legal clause text and returns predicted category, scores, and top features."""
        if not text or not text.strip():
            return {
                "predictedCategory": "Unknown",
                "confidence": 0.0,
                "probabilities": [],
                "topFeatures": []
            }

        clean = text.strip()
        vec = self.vectorizer.transform([clean])

        # Prediction
        pred_idx = int(self.model.predict(vec)[0])
        pred_cat = self.categories[pred_idx] if pred_idx < len(self.categories) else str(pred_idx)

        # Decision scores / probabilities
        scores = []
        confidence = 85.0
        if hasattr(self.model, "decision_function"):
            df = self.model.decision_function(vec)[0]
            # Softmax on decision function for confidence estimate
            import numpy as np
            exp_df = np.exp(df - np.max(df))
            probs = exp_df / np.sum(exp_df)
            confidence = round(float(probs[pred_idx] * 100.0), 2)
            for idx, p in enumerate(probs):
                cat_name = self.categories[idx] if idx < len(self.categories) else f"Class {idx}"
                scores.append({"category": cat_name, "probability": round(float(p * 100.0), 2)})
            scores.sort(key=lambda x: x["probability"], reverse=True)
        elif hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(vec)[0]
            confidence = round(float(probs[pred_idx] * 100.0), 2)
            for idx, p in enumerate(probs):
                cat_name = self.categories[idx] if idx < len(self.categories) else f"Class {idx}"
                scores.append({"category": cat_name, "probability": round(float(p * 100.0), 2)})
            scores.sort(key=lambda x: x["probability"], reverse=True)

        # Extract top matching n-gram features from the clause
        feature_names = self.vectorizer.get_feature_names_out()
        cx = vec.tocoo()
        clause_features = []
        for col, val in zip(cx.col, cx.data):
            clause_features.append((feature_names[col], float(val)))
        clause_features.sort(key=lambda x: x[1], reverse=True)
        top_terms = [t[0] for t in clause_features[:5]]

        return {
            "predictedCategory": pred_cat,
            "confidence": confidence,
            "modelUsed": self.selected_model_name,
            "probabilities": scores[:5],
            "topFeatures": top_terms
        }

if __name__ == "__main__":
    classifier = ClauseClassifier()
    if len(sys.argv) > 1 and sys.argv[1] == "--json-input":
        texts = json.load(sys.stdin)
        if not isinstance(texts, list) or not all(
            isinstance(text, str) for text in texts
        ):
            raise ValueError("JSON input must be an array of clause strings.")
        print(json.dumps({
            "model": {
                "name": classifier.selected_model_name,
                "featureCount": len(classifier.vectorizer.vocabulary_),
                "categories": classifier.categories,
            },
            "predictions": [classifier.classify(text) for text in texts],
        }))
        sys.exit(0)

    sample = "In no event shall Provider's total aggregate liability arising out of or related to this Agreement exceed the total fees actually paid by Customer under this Agreement in the twelve months preceding the incident."
    if len(sys.argv) > 1:
        sample = " ".join(sys.argv[1:])
    result = classifier.classify(sample)
    print(json.dumps(result, indent=2))
