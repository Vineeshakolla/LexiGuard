#!/usr/bin/env python3
"""Compare Logistic Regression regularization and TF-IDF vocabulary sizes."""

import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)

from train_and_evaluate import RANDOM_SEED, TS_STOPWORDS


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT_DIR / "data" / "preprocessed_dataset.json"
RESULTS_PATH = ROOT_DIR / "data" / "logistic_regression_experiments.json"
REPORT_PATH = ROOT_DIR / "data" / "logistic_regression_experiments_report.md"
CONFIGURATIONS = [
    {"C": 1.0, "max_features": 3000},
    {"C": 0.5, "max_features": 3000},
    {"C": 0.1, "max_features": 3000},
    {"C": 1.0, "max_features": 1500},
    {"C": 0.5, "max_features": 1500},
    {"C": 0.1, "max_features": 1500},
]


def metrics(
    y_true: list[int], y_pred: list[int], categories: list[str]
) -> dict[str, Any]:
    labels = list(range(len(categories)))
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, average="macro", zero_division=0
    )
    weighted_precision, weighted_recall, weighted_f1, _ = (
        precision_recall_fscore_support(
            y_true, y_pred, labels=labels, average="weighted", zero_division=0
        )
    )
    class_precision, class_recall, class_f1, class_support = (
        precision_recall_fscore_support(
            y_true, y_pred, labels=labels, average=None, zero_division=0
        )
    )
    return {
        "accuracy": accuracy_score(y_true, y_pred) * 100.0,
        "macro_precision": macro_precision * 100.0,
        "macro_recall": macro_recall * 100.0,
        "macro_f1": macro_f1 * 100.0,
        "weighted_precision": weighted_precision * 100.0,
        "weighted_recall": weighted_recall * 100.0,
        "weighted_f1": weighted_f1 * 100.0,
        "per_class": [
            {
                "category": category,
                "support": int(class_support[index]),
                "precision": float(class_precision[index] * 100.0),
                "recall": float(class_recall[index] * 100.0),
                "f1": float(class_f1[index] * 100.0),
            }
            for index, category in enumerate(categories)
        ],
        "confusion_matrix": confusion_matrix(
            y_true, y_pred, labels=labels
        ).tolist(),
    }


def pct(value: float) -> str:
    return f"{value:.2f}%"


def main() -> None:
    if not DATA_PATH.is_file():
        raise FileNotFoundError(
            f"Cached preprocessed dataset not found: {DATA_PATH}. "
            "Run ml_pipeline/preprocess.py first."
        )

    with DATA_PATH.open("r", encoding="utf-8") as file:
        data: dict[str, Any] = json.load(file)

    metadata = data["metadata"]
    categories = metadata["categories"]
    category_to_id = {category: index for index, category in enumerate(categories)}
    train_samples = data["train_samples"]

    samples_by_contract: dict[str, list[dict[str, Any]]] = {}
    for sample in train_samples:
        samples_by_contract.setdefault(sample["contract_id"], []).append(sample)

    contract_ids = sorted(samples_by_contract)
    shuffled_contract_ids = list(contract_ids)
    random.Random(RANDOM_SEED).shuffle(shuffled_contract_ids)
    validation_cut = int(len(shuffled_contract_ids) * 0.20)
    validation_contract_ids = shuffled_contract_ids[:validation_cut]
    fit_contract_ids = shuffled_contract_ids[validation_cut:]

    fit_samples = [
        sample
        for contract_id in fit_contract_ids
        for sample in samples_by_contract[contract_id]
    ]
    validation_samples = [
        sample
        for contract_id in validation_contract_ids
        for sample in samples_by_contract[contract_id]
    ]
    assert not (set(fit_contract_ids) & set(validation_contract_ids))

    fit_texts = [sample["text"] for sample in fit_samples]
    fit_labels = [category_to_id[sample["category"]] for sample in fit_samples]
    validation_texts = [sample["text"] for sample in validation_samples]
    validation_labels = [
        category_to_id[sample["category"]] for sample in validation_samples
    ]

    results = []
    for max_features in (3000, 1500):
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=3,
            max_features=max_features,
            norm="l2",
            stop_words=TS_STOPWORDS,
        )
        fit_matrix = vectorizer.fit_transform(fit_texts)
        validation_matrix = vectorizer.transform(validation_texts)

        for config in CONFIGURATIONS:
            if config["max_features"] != max_features:
                continue
            classifier = LogisticRegression(
                C=config["C"],
                max_iter=300,
                class_weight="balanced",
                random_state=RANDOM_SEED,
            )
            classifier.fit(fit_matrix, fit_labels)
            train_metrics = metrics(
                fit_labels, classifier.predict(fit_matrix), categories
            )
            validation_metrics = metrics(
                validation_labels,
                classifier.predict(validation_matrix),
                categories,
            )
            results.append(
                {
                    **config,
                    "vocabulary_size": len(vectorizer.vocabulary_),
                    "train_metrics": train_metrics,
                    "validation_metrics": validation_metrics,
                    "train_accuracy": train_metrics["accuracy"],
                    "validation_accuracy": validation_metrics["accuracy"],
                    "train_macro_f1": train_metrics["macro_f1"],
                    "validation_macro_f1": validation_metrics["macro_f1"],
                    "accuracy_gap_train_minus_validation": (
                        train_metrics["accuracy"] - validation_metrics["accuracy"]
                    ),
                    "macro_precision_gap_train_minus_validation": (
                        train_metrics["macro_precision"]
                        - validation_metrics["macro_precision"]
                    ),
                    "macro_recall_gap_train_minus_validation": (
                        train_metrics["macro_recall"]
                        - validation_metrics["macro_recall"]
                    ),
                    "macro_f1_gap_train_minus_validation": (
                        train_metrics["macro_f1"] - validation_metrics["macro_f1"]
                    ),
                    "weighted_f1_gap_train_minus_validation": (
                        train_metrics["weighted_f1"]
                        - validation_metrics["weighted_f1"]
                    ),
                }
            )

    best = max(
        results,
        key=lambda result: (
            result["validation_macro_f1"],
            -abs(result["macro_f1_gap_train_minus_validation"]),
        ),
    )
    lowest_gap = min(
        results, key=lambda result: abs(result["macro_f1_gap_train_minus_validation"])
    )
    strong_regularization = next(
        result
        for result in results
        if result["C"] == 0.1 and result["max_features"] == 3000
    )
    in_target_range = 80.0 <= best["validation_macro_f1"] <= 90.0
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": metadata["dataset_name"],
        "cached_dataset": str(DATA_PATH.relative_to(ROOT_DIR)),
        "category_order": categories,
        "split": {
            "method": "Same seeded split as train_and_evaluate.py: sorted training contract IDs shuffled with seed 42, then 80% fit / 20% validation",
            "fit_contracts": len(fit_contract_ids),
            "validation_contracts": len(validation_contract_ids),
            "fit_samples": len(fit_samples),
            "validation_samples": len(validation_samples),
            "test_set_used": False,
            "leakage_check": "pass; fit and validation contract IDs are disjoint",
        },
        "preprocessing": {
            "vectorizer": "TfidfVectorizer",
            "ngram_range": [1, 2],
            "sublinear_tf": True,
            "min_df": 3,
            "norm": "l2",
            "stop_words": "TS-aligned list reused from train_and_evaluate.py",
            "fit_on": "fit/training portion only for each max_features value",
        },
        "classifier": {
            "class": "LogisticRegression",
            "max_iter": 300,
            "class_weight": "balanced",
            "random_state": RANDOM_SEED,
        },
        "selection": {
            "primary_metric": "validation_macro_f1",
            "tie_breaker": "smallest absolute train-validation Macro F1 gap",
            "best_configuration": {
                "C": best["C"],
                "max_features": best["max_features"],
            },
            "best_validation_macro_f1": best["validation_macro_f1"],
            "best_validation_macro_f1_in_80_to_90_percent": in_target_range,
            "lowest_macro_f1_gap_configuration": {
                "C": lowest_gap["C"],
                "max_features": lowest_gap["max_features"],
                "validation_macro_f1": lowest_gap["validation_macro_f1"],
                "macro_f1_gap_train_minus_validation": (
                    lowest_gap["macro_f1_gap_train_minus_validation"]
                ),
            },
            "strong_regularization_configuration": {
                "C": strong_regularization["C"],
                "max_features": strong_regularization["max_features"],
                "validation_macro_f1": strong_regularization["validation_macro_f1"],
                "macro_f1_gap_train_minus_validation": (
                    strong_regularization["macro_f1_gap_train_minus_validation"]
                ),
            },
        },
        "configurations": results,
        "production_artifacts_modified": False,
    }
    RESULTS_PATH.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

    gap_note = (
        "The selected validation Macro F1 is within the requested 80–90% range."
        if in_target_range
        else "No selected validation Macro F1 in the requested 80–90% range; "
        "the actual best validation result is reported."
    )
    table_rows = [
        "| C | max_features | Train accuracy | Validation accuracy | "
        "Train Macro P/R/F1 | Validation Macro P/R/F1 | Train/val weighted F1 | "
        "Accuracy gap (pp) | Macro F1 gap (pp) |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        train = result["train_metrics"]
        validation = result["validation_metrics"]
        table_rows.append(
            f"| {result['C']:.1f} | {result['max_features']} "
            f"| {pct(result['train_accuracy'])} "
            f"| {pct(result['validation_accuracy'])} "
            f"| {pct(train['macro_precision'])} / {pct(train['macro_recall'])} / "
            f"{pct(train['macro_f1'])} "
            f"| {pct(validation['macro_precision'])} / {pct(validation['macro_recall'])} / "
            f"{pct(validation['macro_f1'])} "
            f"| {pct(train['weighted_f1'])} / {pct(validation['weighted_f1'])} "
            f"| {result['accuracy_gap_train_minus_validation']:.2f} "
            f"| {result['macro_f1_gap_train_minus_validation']:.2f} |"
        )
    best_validation = best["validation_metrics"]
    class_rows = [
        "| Category | Support | Precision | Recall | F1 |",
        "|---|---:|---:|---:|---:|",
    ]
    for metric in best_validation["per_class"]:
        class_rows.append(
            f"| {metric['category']} | {metric['support']} "
            f"| {pct(metric['precision'])} | {pct(metric['recall'])} "
            f"| {pct(metric['f1'])} |"
        )
    matrix_rows = [
        "| Actual category | Predicted category | Count |",
        "|---|---|---:|",
    ]
    for actual_index, actual_category in enumerate(categories):
        for predicted_index, predicted_category in enumerate(categories):
            count = best_validation["confusion_matrix"][actual_index][predicted_index]
            if count:
                matrix_rows.append(
                    f"| {actual_category} | {predicted_category} | {count} |"
                )
    report = "\n".join(
        [
            "# Logistic Regression Regularization Experiment",
            "",
            f"Generated: {output['generated_at']}",
            "",
            "## Setup",
            "",
            f"- Dataset: {metadata['dataset_name']}.",
            f"- Split: {len(fit_contract_ids)} fit and "
            f"{len(validation_contract_ids)} validation contracts "
            f"({len(fit_samples)} and {len(validation_samples)} clauses), "
            "using the seeded split from `train_and_evaluate.py`.",
            "- The held-out test set was not read for evaluation or model selection. "
            "All configurations fit TF-IDF on fit clauses only.",
            "- Logistic Regression settings other than C were held at the existing "
            "pipeline values (`max_iter=300`, `class_weight='balanced'`, seed 42).",
            "",
            "## Results",
            "",
            *table_rows,
            "",
            "Gaps are train minus validation, in percentage points. Validation Macro "
            "F1 is the primary selection metric. Macro precision/recall/F1 include all "
            "12 categories in the dataset category order; `zero_division=0` is used "
            "when a category has no predicted or true examples in a split. Weighted "
            "F1 uses support weighting.",
            "",
            "### Best configuration: validation per-class metrics",
            "",
            *class_rows,
            "",
            "### Best configuration: validation confusion matrix (nonzero cells)",
            "",
            "Rows with the same actual/predicted label are correct classifications; "
            "off-diagonal rows are errors. The complete 12×12 matrices for both fit "
            "and validation predictions for all six configurations are stored in the JSON.",
            "",
            *matrix_rows,
            "",
            "## Selection and interpretation",
            "",
            f"- Selected: **C={best['C']}, max_features={best['max_features']}** "
            f"(validation Macro F1 **{pct(best['validation_macro_f1'])}**; "
            f"validation accuracy {pct(best['validation_accuracy'])}).",
            f"- {gap_note}",
            f"- Strong-regularization alternative: **C=0.1, max_features=3000** "
            f"achieves validation Macro F1 {pct(strong_regularization['validation_macro_f1'])} "
            f"with a {strong_regularization['macro_f1_gap_train_minus_validation']:.2f} pp "
            f"Macro F1 gap, only "
            f"{best['validation_macro_f1'] - strong_regularization['validation_macro_f1']:.2f} "
            "pp below the best validation score.",
            f"- Selected train-validation Macro F1 gap: "
            f"{best['macro_f1_gap_train_minus_validation']:.2f} pp; accuracy gap: "
            f"{best['accuracy_gap_train_minus_validation']:.2f} pp. "
            "Across all six settings, Macro F1 gaps range from "
            f"{min(abs(r['macro_f1_gap_train_minus_validation']) for r in results):.2f} "
            "to "
            f"{max(abs(r['macro_f1_gap_train_minus_validation']) for r in results):.2f} "
            "pp, with no large train-only score inflation on this split.",
            f"- Lowest-gap alternative: **C={lowest_gap['C']}, "
            f"max_features={lowest_gap['max_features']}** (validation Macro F1 "
            f"{pct(lowest_gap['validation_macro_f1'])}; train-validation Macro F1 "
            f"gap {lowest_gap['macro_f1_gap_train_minus_validation']:.2f} pp). "
            "This trades some validation Macro F1 for a smaller observed gap. "
            "The validation holdout is a single split, so it is evidence of "
            "generalization, not a guarantee.",
            "- No test-set metrics were used, and production model artifacts were "
            "not modified. Review this result before considering a model replacement.",
            "",
            "Detailed metrics: `logistic_regression_experiments.json`.",
            "",
        ]
    )
    REPORT_PATH.write_text(report, encoding="utf-8")

    print(
        f"Split: {len(fit_contract_ids)} fit / {len(validation_contract_ids)} "
        f"validation contracts; {len(fit_samples)} / {len(validation_samples)} clauses"
    )
    print(
        "C  max_features  Train Acc  Val Acc  Train Macro F1  Val Macro F1  "
        "Acc Gap  Macro F1 Gap"
    )
    for result in results:
        print(
            f"{result['C']:<3} {result['max_features']:<13} "
            f"{result['train_accuracy']:>8.2f}% "
            f"{result['validation_accuracy']:>7.2f}% "
            f"{result['train_macro_f1']:>14.2f}% "
            f"{result['validation_macro_f1']:>12.2f}% "
            f"{result['accuracy_gap_train_minus_validation']:>7.2f} "
            f"{result['macro_f1_gap_train_minus_validation']:>12.2f}"
        )
    print(
        f"Best validation Macro F1: C={best['C']}, "
        f"max_features={best['max_features']}, "
        f"{best['validation_macro_f1']:.2f}%"
    )
    print(f"Saved results: {RESULTS_PATH}")
    print(f"Saved report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
