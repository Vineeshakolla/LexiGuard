# Grouped Logistic Regression Cross-Validation

Generated: 2026-10-27T02:57:24+00:00

## Method

- Dataset: Atticus Open Contract Dataset (AOK Beta / CUAD v1); only the 3,848 train-group clauses from 368 sample-bearing contracts were used.
- Five-fold `StratifiedGroupKFold`, shuffle enabled, random_state=42; all clauses from a source contract remain together.
- Fold sizes (contracts / clauses): fold 1: 296/72 contracts, 3078/770 clauses; fold 2: 295/73 contracts, 3078/770 clauses; fold 3: 295/73 contracts, 3078/770 clauses; fold 4: 297/71 contracts, 3079/769 clauses; fold 5: 289/79 contracts, 3079/769 clauses.
- Every fold contains all 12 labels in both its training and validation portions.
- A fresh TF-IDF vectorizer (`ngram_range=(1,2)`, `min_df=3`, `sublinear_tf=True`, L2 norm, shared stopwords) is fitted only on each fold's training texts. No test samples are loaded or used.
- Each setting uses Logistic Regression with `max_iter=300`, `class_weight='balanced'`, and random_state 42.
- Mean and sample standard deviation (ddof=1) are across five fold metrics. Per-class rows summarize each fold's per-class metric; the OOF confusion matrix pools validation predictions, each training-group clause once.

## Six-configuration results

| C | Features | Accuracy mean +/- SD | Macro P mean +/- SD | Macro R mean +/- SD | Macro F1 mean +/- SD | Weighted P mean +/- SD | Weighted R mean +/- SD | Weighted F1 mean +/- SD | Train-validation Macro F1 gap mean +/- SD |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1.0 | 3000 | 92.02 +/- 0.99% | 86.74 +/- 1.30% | 87.53 +/- 1.38% | **86.95 +/- 1.29%** | 92.26 +/- 1.00% | 92.02 +/- 0.99% | 92.04 +/- 0.98% | 5.07 +/- 1.31 pp |
| 0.5 | 3000 | 91.66 +/- 1.00% | 86.38 +/- 1.44% | 87.43 +/- 1.49% | 86.72 +/- 1.45% | 91.99 +/- 1.05% | 91.66 +/- 1.00% | 91.71 +/- 1.02% | 4.41 +/- 1.55 pp |
| 0.1 | 3000 | 90.67 +/- 1.20% | 85.67 +/- 1.80% | 87.00 +/- 1.70% | 85.85 +/- 1.57% | 91.30 +/- 1.27% | 90.67 +/- 1.20% | 90.74 +/- 1.19% | 2.75 +/- 1.79 pp |
| 1.0 | 1500 | 91.68 +/- 1.06% | 86.19 +/- 1.32% | 87.09 +/- 1.32% | 86.50 +/- 1.32% | 91.94 +/- 1.00% | 91.68 +/- 1.06% | 91.72 +/- 1.05% | 5.31 +/- 1.33 pp |
| 0.5 | 1500 | 91.16 +/- 1.04% | 85.54 +/- 1.07% | 86.83 +/- 1.21% | 85.94 +/- 1.12% | 91.61 +/- 1.00% | 91.16 +/- 1.04% | 91.24 +/- 1.04% | 4.66 +/- 1.25 pp |
| 0.1 | 1500 | 90.15 +/- 1.62% | 84.98 +/- 2.08% | 86.40 +/- 2.16% | 85.15 +/- 1.91% | 90.85 +/- 1.71% | 90.15 +/- 1.62% | 90.23 +/- 1.61% | 2.77 +/- 2.28 pp |
The primary selection metric is mean validation Macro F1. Ties are resolved by lower Macro F1 standard deviation and then smaller absolute mean train/validation Macro F1 gap.

## Selected setting: validation per-class results

| Category | OOF support | Precision mean ± SD | Recall mean ± SD | F1 mean ± SD |
|---|---:|---:|---:|---:|
| Cap On Liability | 507 | 97.38 ± 1.34% | 94.67 ± 1.50% | 96.00 ± 0.95% |
| Governing Law | 352 | 100.00 ± 0.00% | 98.58 ± 1.00% | 99.28 ± 0.51% |
| Termination For Convenience | 183 | 80.89 ± 7.28% | 93.42 ± 4.59% | 86.65 ± 5.91% |
| Audit Rights | 522 | 95.89 ± 1.38% | 98.08 ± 0.68% | 96.97 ± 0.85% |
| Non-Compete | 189 | 80.16 ± 2.76% | 85.73 ± 5.41% | 82.82 ± 3.86% |
| Anti-Assignment | 489 | 96.43 ± 1.62% | 92.46 ± 5.06% | 94.32 ± 2.35% |
| Insurance | 423 | 99.30 ± 1.56% | 96.92 ± 1.10% | 98.09 ± 0.77% |
| License Grant | 586 | 93.64 ± 2.56% | 92.50 ± 2.77% | 93.05 ± 2.19% |
| Renewal Term | 157 | 70.97 ± 5.81% | 63.10 ± 8.08% | 66.33 ± 2.79% |
| Notice Period To Terminate Renewal | 96 | 49.96 ± 1.61% | 53.05 ± 10.17% | 51.07 ± 5.50% |
| Ip Ownership Assignment | 247 | 89.01 ± 3.22% | 92.28 ± 5.11% | 90.60 ± 4.07% |
| Liquidated Damages | 97 | 87.30 ± 5.86% | 89.53 ± 7.49% | 88.21 ± 4.76% |

## Selected setting: out-of-fold confusion matrix (nonzero cells)

| Actual category | Predicted category | OOF count |
|---|---|---:|
| Cap On Liability | Cap On Liability | 480 |
| Cap On Liability | Termination For Convenience | 2 |
| Cap On Liability | Audit Rights | 3 |
| Cap On Liability | Non-Compete | 7 |
| Cap On Liability | Anti-Assignment | 1 |
| Cap On Liability | Insurance | 3 |
| Cap On Liability | License Grant | 4 |
| Cap On Liability | Renewal Term | 1 |
| Cap On Liability | Liquidated Damages | 6 |
| Governing Law | Cap On Liability | 3 |
| Governing Law | Governing Law | 347 |
| Governing Law | License Grant | 2 |
| Termination For Convenience | Cap On Liability | 1 |
| Termination For Convenience | Termination For Convenience | 171 |
| Termination For Convenience | Audit Rights | 2 |
| Termination For Convenience | Anti-Assignment | 1 |
| Termination For Convenience | License Grant | 2 |
| Termination For Convenience | Renewal Term | 1 |
| Termination For Convenience | Notice Period To Terminate Renewal | 2 |
| Termination For Convenience | Ip Ownership Assignment | 1 |
| Termination For Convenience | Liquidated Damages | 2 |
| Audit Rights | Termination For Convenience | 1 |
| Audit Rights | Audit Rights | 512 |
| Audit Rights | Non-Compete | 3 |
| Audit Rights | Anti-Assignment | 1 |
| Audit Rights | Renewal Term | 1 |
| Audit Rights | Ip Ownership Assignment | 3 |
| Audit Rights | Liquidated Damages | 1 |
| Non-Compete | Cap On Liability | 1 |
| Non-Compete | Termination For Convenience | 6 |
| Non-Compete | Audit Rights | 4 |
| Non-Compete | Non-Compete | 162 |
| Non-Compete | Anti-Assignment | 5 |
| Non-Compete | License Grant | 8 |
| Non-Compete | Renewal Term | 1 |
| Non-Compete | Ip Ownership Assignment | 2 |
| Anti-Assignment | Cap On Liability | 1 |
| Anti-Assignment | Termination For Convenience | 11 |
| Anti-Assignment | Non-Compete | 7 |
| Anti-Assignment | Anti-Assignment | 452 |
| Anti-Assignment | License Grant | 9 |
| Anti-Assignment | Renewal Term | 2 |
| Anti-Assignment | Ip Ownership Assignment | 6 |
| Anti-Assignment | Liquidated Damages | 1 |
| Insurance | Cap On Liability | 3 |
| Insurance | Termination For Convenience | 2 |
| Insurance | Audit Rights | 3 |
| Insurance | Non-Compete | 1 |
| Insurance | Anti-Assignment | 1 |
| Insurance | Insurance | 410 |
| Insurance | License Grant | 1 |
| Insurance | Renewal Term | 1 |
| Insurance | Ip Ownership Assignment | 1 |
| License Grant | Termination For Convenience | 1 |
| License Grant | Audit Rights | 5 |
| License Grant | Non-Compete | 18 |
| License Grant | Anti-Assignment | 5 |
| License Grant | License Grant | 542 |
| License Grant | Ip Ownership Assignment | 14 |
| License Grant | Liquidated Damages | 1 |
| Renewal Term | Termination For Convenience | 3 |
| Renewal Term | Audit Rights | 3 |
| Renewal Term | Anti-Assignment | 1 |
| Renewal Term | License Grant | 1 |
| Renewal Term | Renewal Term | 99 |
| Renewal Term | Notice Period To Terminate Renewal | 49 |
| Renewal Term | Liquidated Damages | 1 |
| Notice Period To Terminate Renewal | Termination For Convenience | 11 |
| Notice Period To Terminate Renewal | Renewal Term | 34 |
| Notice Period To Terminate Renewal | Notice Period To Terminate Renewal | 51 |
| Ip Ownership Assignment | Cap On Liability | 1 |
| Ip Ownership Assignment | Termination For Convenience | 1 |
| Ip Ownership Assignment | Audit Rights | 2 |
| Ip Ownership Assignment | Non-Compete | 3 |
| Ip Ownership Assignment | Anti-Assignment | 2 |
| Ip Ownership Assignment | License Grant | 9 |
| Ip Ownership Assignment | Ip Ownership Assignment | 228 |
| Ip Ownership Assignment | Liquidated Damages | 1 |
| Liquidated Damages | Cap On Liability | 3 |
| Liquidated Damages | Termination For Convenience | 3 |
| Liquidated Damages | Non-Compete | 1 |
| Liquidated Damages | License Grant | 1 |
| Liquidated Damages | Renewal Term | 1 |
| Liquidated Damages | Ip Ownership Assignment | 1 |
| Liquidated Damages | Liquidated Damages | 87 |

## Selection

- Selected by CV only: **C=1.0, max_features=3000**.
- Mean validation Macro F1: **86.95% ± 1.29 pp**.
- Held-out test data was not used. This is cross-validation on the preprocessor's training partition, not a final test result.
- The selected configuration is now frozen for a separate, one-time final test evaluation. The evaluation script refuses to overwrite an existing final-test results file.
- Production model artifacts are unchanged.

Detailed folds and metrics: `logistic_regression_grouped_cv.json`.
