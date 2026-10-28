# Logistic Regression Regularization Experiment

Generated: 2026-10-27T02:17:15+00:00

## Setup

- Dataset: Atticus Open Contract Dataset (AOK Beta / CUAD v1).
- Split: 295 fit and 73 validation contracts (3064 and 784 clauses), using the seeded split from `train_and_evaluate.py`.
- The held-out test set was not read for evaluation or model selection. All configurations fit TF-IDF on fit clauses only.
- Logistic Regression settings other than C were held at the existing pipeline values (`max_iter=300`, `class_weight='balanced'`, seed 42).

## Results

| C | max_features | Train accuracy | Validation accuracy | Train Macro P/R/F1 | Validation Macro P/R/F1 | Train/val weighted F1 | Accuracy gap (pp) | Macro F1 gap (pp) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1.0 | 3000 | 95.43% | 92.98% | 91.81% / 93.04% / 91.79% | 88.43% / 88.66% / 88.42% | 95.47% / 93.02% | 2.45 | 3.37 |
| 0.5 | 3000 | 94.58% | 92.73% | 90.27% / 92.22% / 90.82% | 87.85% / 88.23% / 87.98% | 94.66% / 92.77% | 1.85 | 2.84 |
| 0.1 | 3000 | 92.56% | 92.35% | 87.92% / 89.87% / 88.39% | 87.10% / 88.61% / 87.50% | 92.62% / 92.36% | 0.21 | 0.89 |
| 1.0 | 1500 | 95.14% | 92.60% | 91.36% / 92.82% / 91.49% | 87.86% / 87.79% / 87.63% | 95.19% / 92.60% | 2.54 | 3.86 |
| 0.5 | 1500 | 94.22% | 92.35% | 89.75% / 91.81% / 90.39% | 87.11% / 87.26% / 87.10% | 94.31% / 92.35% | 1.88 | 3.29 |
| 0.1 | 1500 | 91.97% | 91.71% | 87.15% / 89.24% / 87.68% | 86.68% / 87.54% / 86.95% | 92.06% / 91.70% | 0.26 | 0.72 |

Gaps are train minus validation, in percentage points. Validation Macro F1 is the primary selection metric. Macro precision/recall/F1 include all 12 categories in the dataset category order; `zero_division=0` is used when a category has no predicted or true examples in a split. Weighted F1 uses support weighting.

### Best configuration: validation per-class metrics

| Category | Support | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| Cap On Liability | 102 | 98.02% | 97.06% | 97.54% |
| Governing Law | 74 | 100.00% | 100.00% | 100.00% |
| Termination For Convenience | 41 | 88.10% | 90.24% | 89.16% |
| Audit Rights | 116 | 94.92% | 96.55% | 95.73% |
| Non-Compete | 37 | 76.32% | 78.38% | 77.33% |
| Anti-Assignment | 91 | 97.70% | 93.41% | 95.51% |
| Insurance | 99 | 98.99% | 98.99% | 98.99% |
| License Grant | 118 | 91.30% | 88.98% | 90.13% |
| Renewal Term | 22 | 77.78% | 63.64% | 70.00% |
| Notice Period To Terminate Renewal | 13 | 50.00% | 61.54% | 55.17% |
| Ip Ownership Assignment | 62 | 88.06% | 95.16% | 91.47% |
| Liquidated Damages | 9 | 100.00% | 100.00% | 100.00% |

### Best configuration: validation confusion matrix (nonzero cells)

Rows with the same actual/predicted label are correct classifications; off-diagonal rows are errors. The complete 12×12 matrices for both fit and validation predictions for all six configurations are stored in the JSON.

| Actual category | Predicted category | Count |
|---|---|---:|
| Cap On Liability | Cap On Liability | 99 |
| Cap On Liability | Audit Rights | 1 |
| Cap On Liability | Non-Compete | 1 |
| Cap On Liability | Renewal Term | 1 |
| Governing Law | Governing Law | 74 |
| Termination For Convenience | Termination For Convenience | 37 |
| Termination For Convenience | Audit Rights | 2 |
| Termination For Convenience | Notice Period To Terminate Renewal | 2 |
| Audit Rights | Cap On Liability | 1 |
| Audit Rights | Termination For Convenience | 1 |
| Audit Rights | Audit Rights | 112 |
| Audit Rights | Non-Compete | 1 |
| Audit Rights | Ip Ownership Assignment | 1 |
| Non-Compete | Termination For Convenience | 2 |
| Non-Compete | Non-Compete | 29 |
| Non-Compete | Anti-Assignment | 1 |
| Non-Compete | Insurance | 1 |
| Non-Compete | License Grant | 3 |
| Non-Compete | Ip Ownership Assignment | 1 |
| Anti-Assignment | Non-Compete | 1 |
| Anti-Assignment | Anti-Assignment | 85 |
| Anti-Assignment | License Grant | 4 |
| Anti-Assignment | Ip Ownership Assignment | 1 |
| Insurance | Cap On Liability | 1 |
| Insurance | Insurance | 98 |
| License Grant | Audit Rights | 3 |
| License Grant | Non-Compete | 6 |
| License Grant | Anti-Assignment | 1 |
| License Grant | License Grant | 105 |
| License Grant | Ip Ownership Assignment | 3 |
| Renewal Term | Renewal Term | 14 |
| Renewal Term | Notice Period To Terminate Renewal | 6 |
| Renewal Term | Ip Ownership Assignment | 2 |
| Notice Period To Terminate Renewal | Termination For Convenience | 2 |
| Notice Period To Terminate Renewal | Renewal Term | 3 |
| Notice Period To Terminate Renewal | Notice Period To Terminate Renewal | 8 |
| Ip Ownership Assignment | License Grant | 3 |
| Ip Ownership Assignment | Ip Ownership Assignment | 59 |
| Liquidated Damages | Liquidated Damages | 9 |

## Selection and interpretation

- Selected: **C=1.0, max_features=3000** (validation Macro F1 **88.42%**; validation accuracy 92.98%).
- The selected validation Macro F1 is within the requested 80–90% range.
- Strong-regularization alternative: **C=0.1, max_features=3000** achieves validation Macro F1 87.50% with a 0.89 pp Macro F1 gap, only 0.92 pp below the best validation score.
- Selected train-validation Macro F1 gap: 3.37 pp; accuracy gap: 2.45 pp. Across all six settings, Macro F1 gaps range from 0.72 to 3.86 pp, with no large train-only score inflation on this split.
- Lowest-gap alternative: **C=0.1, max_features=1500** (validation Macro F1 86.95%; train-validation Macro F1 gap 0.72 pp). This trades some validation Macro F1 for a smaller observed gap. The validation holdout is a single split, so it is evidence of generalization, not a guarantee.
- No test-set metrics were used, and production model artifacts were not modified. Review this result before considering a model replacement.

Detailed metrics: `logistic_regression_experiments.json`.

## Follow-up validation and frozen-candidate evaluation

The six configurations above were initially compared on the single seeded 295/73 contract-level train/validation split. A separate five-fold `StratifiedGroupKFold` run on all 3,848 train-group clauses selected **C=1.0, max_features=3000** by mean validation Macro F1 (**86.95% ± 1.29 pp**). This selection used training-partition folds only and fitted TF-IDF separately inside each fold. The full aggregate comparison, per-class results, and pooled out-of-fold confusion matrix are in [the grouped CV report](logistic_regression_grouped_cv_report.md) and [JSON](logistic_regression_grouped_cv.json).

After freezing that candidate from CV, a one-time evaluation on the cached test partition (97 contracts / 825 clauses) measured **94.06% accuracy**, **89.63% Macro precision**, **91.61% Macro recall**, **90.15% Macro F1**, **94.66% weighted precision**, **94.06% weighted recall**, and **94.18% weighted F1**. The project’s historical C=5.0 benchmark had already reported on this same test partition; this is a retrospective same-split comparison, not a globally unseen test. The candidate is slightly lower on accuracy, Macro F1, and weighted F1 than that historical run, and has not been deployed. See [the final test report](logistic_regression_final_test_report.md) for per-class metrics and the confusion matrix. No six-setting validation metric above was selected using the final-test results.
