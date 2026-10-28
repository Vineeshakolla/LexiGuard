#!/usr/bin/env python3
"""Evaluate the six LR configurations with reproducible contract-grouped CV."""

import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import StratifiedGroupKFold

from experiment_logistic_regression import (
    CONFIGURATIONS,
    DATA_PATH,
    metrics,
)
from train_and_evaluate import RANDOM_SEED, TS_STOPWORDS


ROOT_DIR = Path(__file__).resolve().parents[1]
RESULTS_PATH = ROOT_DIR / "data" / "logistic_regression_grouped_cv.json"
REPORT_PATH = ROOT_DIR / "data" / "logistic_regression_grouped_cv_report.md"
N_SPLITS = 5


def mean_std(values: list[float]) -> dict[str, float]:
    return {
        "mean": float(np.mean(values)),
        "std": float(np.std(values, ddof=1)),
    }


def aggregate_fold_metrics(
    fold_metrics: list[dict[str, Any]], categories: list[str]
) -> dict[str, Any]:
    aggregate: dict[str, Any] = {}
    metric_names = (
        "accuracy",
        "macro_precision",
        "macro_recall",
        "macro_f1",
        "weighted_precision",
        "weighted_recall",
        "weighted_f1",
    )
    for metric_name in metric_names:
        aggregate[metric_name] = mean_std(
            [fold[metric_name] for fold in fold_metrics]
        )

    per_class = []
    for category_index, category in enumerate(categories):
        fold_class_metrics = [
            fold["per_class"][category_index] for fold in fold_metrics
        ]
        per_class.append(
            {
                "category": category,
                "support_total": sum(
                    item["support"] for item in fold_class_metrics
                ),
                "support_per_fold": mean_std(
                    [float(item["support"]) for item in fold_class_metrics]
                ),
                "precision": mean_std(
                    [item["precision"] for item in fold_class_metrics]
                ),
                "recall": mean_std(
                    [item["recall"] for item in fold_class_metrics]
                ),
                "f1": mean_std([item["f1"] for item in fold_class_metrics]),
            }
        )
    aggregate["per_class"] = per_class
    aggregate["confusion_matrix_out_of_fold"] = np.sum(
        [fold["confusion_matrix"] for fold in fold_metrics], axis=0
    ).astype(int).tolist()
    return aggregate


def main() -> None:
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"Cached dataset not found: {DATA_PATH}")
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    metadata = data["metadata"]
    categories = metadata["categories"]
    category_to_id = {category: index for index, category in enumerate(categories)}
    samples = data["train_samples"]

    texts = [sample["text"] for sample in samples]
    labels = np.asarray([category_to_id[sample["category"]] for sample in samples])
    groups = np.asarray([sample["contract_id"] for sample in samples])
    splitter = StratifiedGroupKFold(
        n_splits=N_SPLITS, shuffle=True, random_state=RANDOM_SEED
    )
    folds = list(splitter.split(texts, labels, groups))
    expected_labels = set(range(len(categories)))
    fold_metadata = []
    for fold_number, (train_indices, validation_indices) in enumerate(folds, 1):
        training_groups = set(groups[train_indices])
        validation_groups = set(groups[validation_indices])
        if training_groups & validation_groups:
            raise AssertionError(f"Contract leakage detected in fold {fold_number}.")
        if set(labels[train_indices]) != expected_labels:
            raise ValueError(f"Fold {fold_number} training partition lacks a category.")
        if set(labels[validation_indices]) != expected_labels:
            raise ValueError(
                f"Fold {fold_number} validation partition lacks a category."
            )
        fold_metadata.append(
            {
                "fold": fold_number,
                "train_contracts": len(training_groups),
                "validation_contracts": len(validation_groups),
                "train_clauses": len(train_indices),
                "validation_clauses": len(validation_indices),
                "contract_overlap": 0,
            }
        )

    configurations = []
    for config in CONFIGURATIONS:
        fold_results = []
        for fold_number, (train_indices, validation_indices) in enumerate(folds, 1):
            train_texts = [texts[index] for index in train_indices]
            validation_texts = [texts[index] for index in validation_indices]
            train_labels = labels[train_indices].tolist()
            validation_labels = labels[validation_indices].tolist()

            vectorizer = TfidfVectorizer(
                ngram_range=(1, 2),
                sublinear_tf=True,
                min_df=3,
                max_features=config["max_features"],
                norm="l2",
                stop_words=TS_STOPWORDS,
            )
            train_matrix = vectorizer.fit_transform(train_texts)
            validation_matrix = vectorizer.transform(validation_texts)
            classifier = LogisticRegression(
                C=config["C"],
                max_iter=300,
                class_weight="balanced",
                random_state=RANDOM_SEED,
            )
            classifier.fit(train_matrix, train_labels)
            train_metrics = metrics(
                train_labels, classifier.predict(train_matrix).tolist(), categories
            )
            validation_predictions = classifier.predict(validation_matrix).tolist()
            validation_metrics = metrics(
                validation_labels, validation_predictions, categories
            )
            validation_metrics["confusion_matrix"] = confusion_matrix(
                validation_labels,
                validation_predictions,
                labels=list(range(len(categories))),
            ).tolist()
            fold_results.append(
                {
                    "fold": fold_number,
                    "vocabulary_size": len(vectorizer.vocabulary_),
                    "train_metrics": train_metrics,
                    "validation_metrics": validation_metrics,
                    "macro_f1_gap_train_minus_validation": (
                        train_metrics["macro_f1"] - validation_metrics["macro_f1"]
                    ),
                }
            )

        validation_aggregate = aggregate_fold_metrics(
            [fold["validation_metrics"] for fold in fold_results], categories
        )
        train_aggregate = aggregate_fold_metrics(
            [fold["train_metrics"] for fold in fold_results], categories
        )
        gaps = [
            fold["macro_f1_gap_train_minus_validation"] for fold in fold_results
        ]
        configurations.append(
            {
                **config,
                "folds": fold_results,
                "validation_aggregate": validation_aggregate,
                "train_aggregate": train_aggregate,
                "macro_f1_gap_train_minus_validation": mean_std(gaps),
            }
        )

    best = max(
        configurations,
        key=lambda result: (
            result["validation_aggregate"]["macro_f1"]["mean"],
            -result["validation_aggregate"]["macro_f1"]["std"],
            -abs(result["macro_f1_gap_train_minus_validation"]["mean"]),
        ),
    )
    best_low_support = sorted(
        best["validation_aggregate"]["per_class"],
        key=lambda item: (item["f1"]["mean"], item["support_total"]),
    )[:3]
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": metadata["dataset_name"],
        "cached_dataset": str(DATA_PATH.relative_to(ROOT_DIR)),
        "category_order": categories,
        "software": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
        },
        "split": {
            "method": "StratifiedGroupKFold",
            "n_splits": N_SPLITS,
            "shuffle": True,
            "random_state": RANDOM_SEED,
            "group_column": "contract_id",
            "input": "preprocessor train_samples only; held-out test_samples are not loaded or scored",
            "fit_scope": "TF-IDF and Logistic Regression are fitted independently within each fold",
            "total_contracts": len(set(groups)),
            "total_clauses": len(samples),
            "folds": fold_metadata,
            "all_categories_present_in_each_train_and_validation_fold": True,
        },
        "metric_aggregation": {
            "mean_std": "arithmetic mean and sample standard deviation (ddof=1) across five folds",
            "per_class": "per-fold precision/recall/F1 summarized as mean and sample standard deviation; support total and per-fold mean/std also included",
            "confusion_matrix": "sum of validation-fold confusion matrices; each train-side clause is predicted once out of fold",
            "zero_division": 0,
        },
        "selection": {
            "primary_metric": "highest mean validation Macro F1",
            "tie_breaker": [
                "lowest sample standard deviation of validation Macro F1",
                "smallest absolute mean train-validation Macro F1 gap",
            ],
            "selected_configuration": {
                "C": best["C"],
                "max_features": best["max_features"],
            },
            "mean_validation_macro_f1": best["validation_aggregate"]["macro_f1"]["mean"],
            "validation_macro_f1_std": best["validation_aggregate"]["macro_f1"]["std"],
            "lowest_mean_validation_f1_categories": best_low_support,
            "test_set_used": False,
            "production_artifacts_modified": False,
        },
        "configurations": configurations,
    }
    RESULTS_PATH.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

    rows = [
        "| C | Features | Accuracy mean ± SD | Macro P mean ± SD | "
        "Macro R mean ± SD | Macro F1 mean ± SD | Weighted P mean ± SD | "
        "Weighted R mean ± SD | Weighted F1 mean ± SD | "
        "Train−validation Macro F1 gap mean ± SD |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in configurations:
        aggregate = result["validation_aggregate"]

        def display(metric: dict[str, float]) -> str:
            return f"{metric['mean']:.2f} ± {metric['std']:.2f}%"

        gap = result["macro_f1_gap_train_minus_validation"]
        rows.append(
            f"| {result['C']} | {result['max_features']} "
            f"| {display(aggregate['accuracy'])} "
            f"| {display(aggregate['macro_precision'])} "
            f"| {display(aggregate['macro_recall'])} "
            f"| {display(aggregate['macro_f1'])} "
            f"| {display(aggregate['weighted_precision'])} "
            f"| {display(aggregate['weighted_recall'])} "
            f"| {display(aggregate['weighted_f1'])} "
            f"| {gap['mean']:.2f} ± {gap['std']:.2f} pp |"
        )

    class_rows = [
        "| Category | OOF support | Precision mean ± SD | Recall mean ± SD | F1 mean ± SD |",
        "|---|---:|---:|---:|---:|",
    ]
    for item in best["validation_aggregate"]["per_class"]:
        class_rows.append(
            f"| {item['category']} | {item['support_total']} "
            f"| {item['precision']['mean']:.2f} ± {item['precision']['std']:.2f}% "
            f"| {item['recall']['mean']:.2f} ± {item['recall']['std']:.2f}% "
            f"| {item['f1']['mean']:.2f} ± {item['f1']['std']:.2f}% |"
        )
    matrix_rows = [
        "| Actual category | Predicted category | OOF count |",
        "|---|---|---:|",
    ]
    matrix = best["validation_aggregate"]["confusion_matrix_out_of_fold"]
    for actual_index, actual_category in enumerate(categories):
        for predicted_index, predicted_category in enumerate(categories):
            count = matrix[actual_index][predicted_index]
            if count:
                matrix_rows.append(
                    f"| {actual_category} | {predicted_category} | {count} |"
                )
    report = "\n".join(
        [
            "# Grouped Logistic Regression Cross-Validation",
            "",
            f"Generated: {output['generated_at']}",
            "",
            "## Method",
            "",
            f"- Dataset: {metadata['dataset_name']}; only the 3,848 train-group clauses "
            f"from {len(set(groups))} sample-bearing contracts were used.",
            "- Five-fold `StratifiedGroupKFold`, shuffle enabled, random_state=42; "
            "all clauses from a source contract remain together.",
            "- Fold sizes (contracts / clauses): "
            + "; ".join(
                f"fold {fold['fold']}: {fold['train_contracts']}/"
                f"{fold['validation_contracts']} contracts, "
                f"{fold['train_clauses']}/{fold['validation_clauses']} clauses"
                for fold in fold_metadata
            )
            + ".",
            "- Every fold contains all 12 labels in both its training and validation portions.",
            "- A fresh TF-IDF vectorizer (`ngram_range=(1,2)`, `min_df=3`, "
            "`sublinear_tf=True`, L2 norm, shared stopwords) is fitted only on each "
            "fold's training texts. No test samples are loaded or used.",
            "- Each setting uses Logistic Regression with `max_iter=300`, "
            "`class_weight='balanced'`, and random_state 42.",
            "- Mean and sample standard deviation (ddof=1) are across five fold metrics. "
            "Per-class rows summarize each fold's per-class metric; the OOF confusion "
            "matrix pools validation predictions, each training-group clause once.",
            "",
            "## Six-configuration results",
            "",
            *rows,
            "",
            "The primary selection metric is mean validation Macro F1. Ties are "
            "resolved by lower Macro F1 standard deviation and then smaller absolute "
            "mean train/validation Macro F1 gap.",
            "",
            "## Selected setting: validation per-class results",
            "",
            *class_rows,
            "",
            "## Selected setting: out-of-fold confusion matrix (nonzero cells)",
            "",
            *matrix_rows,
            "",
            "## Selection",
            "",
            f"- Selected by CV only: **C={best['C']}, max_features={best['max_features']}**.",
            f"- Mean validation Macro F1: **{best['validation_aggregate']['macro_f1']['mean']:.2f}% "
            f"± {best['validation_aggregate']['macro_f1']['std']:.2f} pp**.",
            "- Held-out test data was not used. This is cross-validation on the "
            "preprocessor's training partition, not a final test result.",
            "- The selected configuration is now frozen for a separate, one-time "
            "final test evaluation. The evaluation script refuses to overwrite an "
            "existing final-test results file.",
            "- Production model artifacts are unchanged.",
            "",
            "Detailed folds and metrics: `logistic_regression_grouped_cv.json`.",
            "",
        ]
    )
    REPORT_PATH.write_text(report, encoding="utf-8")

    print(
        f"Grouped CV: {N_SPLITS} folds, {len(set(groups))} contracts, "
        f"{len(samples)} clauses; test samples not used."
    )
    print(
        "C  Features  Accuracy mean±SD  Macro P/R/F1 mean±SD  "
        "Weighted P/R/F1 mean±SD  Gap mean±SD"
    )
    for result in configurations:
        val = result["validation_aggregate"]
        gap = result["macro_f1_gap_train_minus_validation"]
        print(
            f"{result['C']:<3} {result['max_features']:<9} "
            f"{val['accuracy']['mean']:.2f}±{val['accuracy']['std']:.2f}% "
            f"{val['macro_precision']['mean']:.2f}±{val['macro_precision']['std']:.2f}/"
            f"{val['macro_recall']['mean']:.2f}±{val['macro_recall']['std']:.2f}/"
            f"{val['macro_f1']['mean']:.2f}±{val['macro_f1']['std']:.2f}% "
            f"{val['weighted_precision']['mean']:.2f}±{val['weighted_precision']['std']:.2f}/"
            f"{val['weighted_recall']['mean']:.2f}±{val['weighted_recall']['std']:.2f}/"
            f"{val['weighted_f1']['mean']:.2f}±{val['weighted_f1']['std']:.2f}% "
            f"{gap['mean']:.2f}±{gap['std']:.2f} pp"
        )
    print(
        f"Selected: C={best['C']}, max_features={best['max_features']}; "
        f"mean validation Macro F1 "
        f"{best['validation_aggregate']['macro_f1']['mean']:.2f}%"
    )
    print(f"Saved {RESULTS_PATH}")
    print(f"Saved {REPORT_PATH}")


if __name__ == "__main__":
    main()
