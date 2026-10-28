#!/usr/bin/env python3
"""Evaluate the CV-frozen Logistic Regression candidate on test exactly once."""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix

from experiment_logistic_regression import metrics
from train_and_evaluate import RANDOM_SEED, TS_STOPWORDS


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT_DIR / "data" / "preprocessed_dataset.json"
CV_PATH = ROOT_DIR / "data" / "logistic_regression_grouped_cv.json"
BASELINE_PATH = ROOT_DIR / "data" / "traditional_ml_results.json"
RESULTS_PATH = ROOT_DIR / "data" / "logistic_regression_final_test.json"
REPORT_PATH = ROOT_DIR / "data" / "logistic_regression_final_test_report.md"


def main() -> None:
    if RESULTS_PATH.exists():
        raise FileExistsError(
            f"Final test evaluation already exists at {RESULTS_PATH}. "
            "Refusing to evaluate the held-out test set a second time."
        )
    if not CV_PATH.is_file():
        raise FileNotFoundError(
            f"Grouped CV selection not found: {CV_PATH}. Run grouped CV first."
        )
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"Cached dataset not found: {DATA_PATH}")

    cv_result = json.loads(CV_PATH.read_text(encoding="utf-8"))
    selection = cv_result["selection"]
    if selection["test_set_used"] is not False:
        raise ValueError("Grouped CV metadata does not certify test isolation.")
    candidate = selection["selected_configuration"]

    # Test data is accessed only after the grouped-CV-selected configuration is frozen.
    dataset = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    metadata = dataset["metadata"]
    categories = metadata["categories"]
    if categories != cv_result["category_order"]:
        raise ValueError("Dataset category order changed since grouped CV.")
    category_to_id = {category: index for index, category in enumerate(categories)}
    train_samples = dataset["train_samples"]
    test_samples = dataset["test_samples"]

    train_groups = {sample["contract_id"] for sample in train_samples}
    test_groups = {sample["contract_id"] for sample in test_samples}
    if train_groups & test_groups:
        raise AssertionError("Training/test contract leakage detected.")
    if len(test_samples) != metadata["test_samples_count"]:
        raise ValueError("Cached test sample count does not match metadata.")

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=3,
        max_features=candidate["max_features"],
        norm="l2",
        stop_words=TS_STOPWORDS,
    )
    train_matrix = vectorizer.fit_transform([sample["text"] for sample in train_samples])
    test_matrix = vectorizer.transform([sample["text"] for sample in test_samples])
    train_labels = [
        category_to_id[sample["category"]] for sample in train_samples
    ]
    test_labels = [category_to_id[sample["category"]] for sample in test_samples]

    classifier = LogisticRegression(
        C=candidate["C"],
        max_iter=300,
        class_weight="balanced",
        random_state=RANDOM_SEED,
    )
    classifier.fit(train_matrix, train_labels)
    test_predictions = classifier.predict(test_matrix).tolist()
    test_metrics = metrics(test_labels, test_predictions, categories)
    test_metrics["confusion_matrix"] = confusion_matrix(
        test_labels, test_predictions, labels=list(range(len(categories)))
    ).tolist()

    baseline: dict[str, Any] | None = None
    comparable = False
    if BASELINE_PATH.is_file():
        saved_benchmark = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
        baseline_model = saved_benchmark["algorithms"]["logisticRegression"]
        comparable = (
            saved_benchmark.get("testSamples") == len(test_samples)
            and saved_benchmark.get("testContracts") == len(test_groups)
            and saved_benchmark.get("categories") == categories
            and "Contract-level" in saved_benchmark.get("splitMethod", "")
        )
        baseline = {
            "generated_at": saved_benchmark.get("generatedAt"),
            "selected_model": saved_benchmark.get("selectedModel"),
            "tuned_C": baseline_model.get("tunedHyperparams", {}).get("C"),
            "test_samples": saved_benchmark.get("testSamples"),
            "test_contracts": saved_benchmark.get("testContracts"),
            "metrics": {
                "accuracy": baseline_model["accuracy"],
                "macro_precision": baseline_model["macroPrecision"],
                "macro_recall": baseline_model["macroRecall"],
                "macro_f1": baseline_model["macroF1"],
                "weighted_precision": baseline_model["weightedPrecision"],
                "weighted_recall": baseline_model["weightedRecall"],
                "weighted_f1": baseline_model["weightedF1"],
            },
            "same_cached_test_split_and_category_order": comparable,
            "note": (
                "Historical benchmark on the same cached held-out test partition; "
                "reference only, not used to select this candidate."
            ),
        }

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "candidate_selection_source": str(CV_PATH.relative_to(ROOT_DIR)),
        "candidate_frozen_before_test_evaluation": candidate,
        "test_split": {
            "source": "preprocessor test_samples",
            "method": metadata["split_method"],
            "test_contracts": len(test_groups),
            "test_clauses": len(test_samples),
            "overlap_with_training_contracts": 0,
            "evaluated_once": True,
            "used_for_candidate_selection": False,
        },
        "preprocessing": {
            "vectorizer": "TfidfVectorizer",
            "ngram_range": [1, 2],
            "min_df": 3,
            "sublinear_tf": True,
            "norm": "l2",
            "max_features": candidate["max_features"],
            "stop_words": "TS-aligned list reused from train_and_evaluate.py",
            "fit_on": "all preprocessor train_samples only",
        },
        "classifier": {
            "class": "LogisticRegression",
            "C": candidate["C"],
            "max_iter": 300,
            "class_weight": "balanced",
            "random_state": RANDOM_SEED,
        },
        "test_metrics": test_metrics,
        "historical_production_benchmark": baseline,
        "production_artifacts_modified": False,
    }

    # Write after the single held-out evaluation; never overwrite this evidence.
    RESULTS_PATH.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

    labels = [str(index + 1).zfill(2) for index in range(len(categories))]
    matrix = test_metrics["confusion_matrix"]
    matrix_rows = [
        "| Actual \\ Predicted | " + " | ".join(labels) + " |",
        "|---|" + "---:|" * len(labels),
    ]
    matrix_rows.extend(
        f"| {str(index + 1).zfill(2)} | "
        + " | ".join(str(value) for value in row)
        + " |"
        for index, row in enumerate(matrix)
    )
    class_rows = [
        "| Category | Support | Precision | Recall | F1 |",
        "|---|---:|---:|---:|---:|",
    ]
    for metric in test_metrics["per_class"]:
        class_rows.append(
            f"| {metric['category']} | {metric['support']} "
            f"| {metric['precision']:.2f}% | {metric['recall']:.2f}% "
            f"| {metric['f1']:.2f}% |"
        )
    report_lines = [
        "# Frozen Logistic Regression Candidate — Final Test Evaluation",
        "",
        f"Generated: {output['generated_at']}",
        "",
        "## Protocol",
        "",
        f"- Candidate frozen from grouped CV: **C={candidate['C']}, "
        f"max_features={candidate['max_features']}**.",
        f"- Selected by mean validation Macro F1: "
        f"{selection['mean_validation_macro_f1']:.2f}% "
        f"(five grouped folds; SD {selection['validation_macro_f1_std']:.2f} pp).",
        f"- Final evaluation used the untouched preprocessor test partition: "
        f"{len(test_groups)} contracts / {len(test_samples)} clauses.",
        "- Candidate selection did not use test metrics. TF-IDF was fitted on all "
        "training clauses and only transformed test clauses.",
        "- Production artifacts were not modified. This candidate is not deployed.",
        "",
        "## Test aggregate metrics",
        "",
        "| Metric | Score |",
        "|---|---:|",
        f"| Accuracy | {test_metrics['accuracy']:.2f}% |",
        f"| Macro precision | {test_metrics['macro_precision']:.2f}% |",
        f"| Macro recall | {test_metrics['macro_recall']:.2f}% |",
        f"| Macro F1 | {test_metrics['macro_f1']:.2f}% |",
        f"| Weighted precision | {test_metrics['weighted_precision']:.2f}% |",
        f"| Weighted recall | {test_metrics['weighted_recall']:.2f}% |",
        f"| Weighted F1 | {test_metrics['weighted_f1']:.2f}% |",
        "",
        "## Per-class test results",
        "",
        *class_rows,
        "",
        "## Test confusion matrix",
        "",
        "Rows and columns are 1-based category indices in the mapping below.",
        "",
        "| Index | Category |",
        "|---:|---|",
        *[f"| {index + 1} | {category} |" for index, category in enumerate(categories)],
        "",
        *matrix_rows,
        "",
    ]
    if baseline:
        report_lines.extend(
            [
                "## Historical production benchmark comparison",
                "",
                (
                    "The saved production benchmark refers to the same cached "
                    "test partition and category order."
                    if comparable
                    else "The saved benchmark's split was not confirmed comparable; "
                    "do not compare its test scores."
                ),
                "",
                f"- Historical LR C: {baseline['tuned_C']}; generated "
                f"{baseline['generated_at']}.",
                f"- Candidate: accuracy {test_metrics['accuracy']:.2f}%, Macro F1 "
                f"{test_metrics['macro_f1']:.2f}%, weighted F1 "
                f"{test_metrics['weighted_f1']:.2f}%.",
                f"- Historical: accuracy {baseline['metrics']['accuracy']:.2f}%, "
                f"Macro F1 {baseline['metrics']['macro_f1']:.2f}%, weighted F1 "
                f"{baseline['metrics']['weighted_f1']:.2f}%.",
                "- This is a retrospective comparison on a test partition already "
                "reported in the historical benchmark; it was not used for this "
                "candidate's selection.",
                "",
            ]
        )
    report_lines.extend(
        [
            "Detailed metrics and full 12×12 confusion matrix: "
            "`logistic_regression_final_test.json`.",
            "",
        ]
    )
    REPORT_PATH.write_text("\n".join(report_lines), encoding="utf-8")
    print(
        f"Frozen candidate C={candidate['C']}, max_features={candidate['max_features']}"
    )
    print(
        f"Final test: {len(test_groups)} contracts / {len(test_samples)} clauses; "
        f"accuracy {test_metrics['accuracy']:.2f}%, Macro F1 "
        f"{test_metrics['macro_f1']:.2f}%, weighted F1 "
        f"{test_metrics['weighted_f1']:.2f}%."
    )
    print(f"Saved {RESULTS_PATH}")
    print(f"Saved {REPORT_PATH}")


if __name__ == "__main__":
    main()
