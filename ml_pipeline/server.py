#!/usr/bin/env python3
"""
LexiGuard Machine Learning HTTP Service
---------------------------------------
Lightweight Python HTTP microservice that serves predictions, model evaluation metrics,
and training triggers over REST endpoints (default port 5001):
- GET /health
- GET /evaluation
- POST /classify
- POST /train
"""

import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Import ML pipeline modules
from inference import ClauseClassifier
from train_and_evaluate import train_and_evaluate_all

HOST = "0.0.0.0"
PORT = int(os.environ.get("ML_PORT", 5001))

class MLRequestHandler(BaseHTTPRequestHandler):
    classifier = None

    @classmethod
    def get_classifier(cls):
        if cls.classifier is None:
            try:
                cls.classifier = ClauseClassifier()
            except Exception as e:
                print(f"[ML Service] Error initializing classifier: {e}")
        return cls.classifier

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ("/health", "/api/health"):
            clf = self.get_classifier()
            status_data = {
                "status": "healthy",
                "service": "LexiGuard Python ML Inference Service",
                "modelLoaded": clf is not None,
                "selectedModel": "Linear SVM (TF-IDF)",
                "port": PORT
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(status_data).encode("utf-8"))

        elif path in ("/evaluation", "/api/evaluation"):
            res_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "traditional_ml_results.json")
            if os.path.exists(res_path):
                with open(res_path, "r", encoding="utf-8") as f:
                    eval_data = json.load(f)
                self._set_headers(200)
                self.wfile.write(json.dumps(eval_data).encode("utf-8"))
            else:
                self._set_headers(404)
                self.wfile.write(json.dumps({"error": "Evaluation results not found. Run training first."}).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"

        try:
            req_data = json.loads(body)
        except Exception:
            req_data = {}

        if path in ("/classify", "/api/classify"):
            clause_text = req_data.get("text", "")
            if not clause_text:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Field 'text' is required"}).encode("utf-8"))
                return

            clf = self.get_classifier()
            if not clf:
                self._set_headers(503)
                self.wfile.write(json.dumps({"error": "Model not loaded"}).encode("utf-8"))
                return

            prediction = clf.classify(clause_text)
            self._set_headers(200)
            self.wfile.write(json.dumps(prediction).encode("utf-8"))

        elif path in ("/train", "/api/train"):
            try:
                eval_res = train_and_evaluate_all()
                self.__class__.classifier = ClauseClassifier() # reload
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True, "evaluation": eval_res}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

def run_service():
    print(f"[ML Service] Starting LexiGuard ML HTTP service on {HOST}:{PORT}...")
    server = HTTPServer((HOST, PORT), MLRequestHandler)
    print(f"[ML Service] Listening for classification requests at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[ML Service] Shutting down.")
        server.server_close()

if __name__ == "__main__":
    run_service()
