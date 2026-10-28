# Frozen Logistic Regression Candidate — Final Test Evaluation

Generated: 2026-10-27T02:58:42+00:00

## Protocol

- Candidate frozen from grouped CV: **C=1.0, max_features=3000**.
- Selected by mean validation Macro F1: 86.95% (five grouped folds; SD 1.29 pp).
- Final evaluation used the untouched preprocessor test partition: 97 contracts / 825 clauses.
- Candidate selection did not use test metrics. TF-IDF was fitted on all training clauses and only transformed test clauses.
- Production artifacts were not modified. This candidate is not deployed.

## Test aggregate metrics

| Metric | Score |
|---|---:|
| Accuracy | 94.06% |
| Macro precision | 89.63% |
| Macro recall | 91.61% |
| Macro F1 | 90.15% |
| Weighted precision | 94.66% |
| Weighted recall | 94.06% |
| Weighted F1 | 94.18% |

## Per-class test results

| Category | Support | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| Cap On Liability | 120 | 98.26% | 94.17% | 96.17% |
| Governing Law | 89 | 100.00% | 98.88% | 99.44% |
| Termination For Convenience | 36 | 94.12% | 88.89% | 91.43% |
| Audit Rights | 90 | 97.80% | 98.89% | 98.34% |
| Non-Compete | 38 | 89.47% | 89.47% | 89.47% |
| Anti-Assignment | 101 | 97.03% | 97.03% | 97.03% |
| Insurance | 106 | 98.13% | 99.06% | 98.59% |
| License Grant | 118 | 96.55% | 94.92% | 95.73% |
| Renewal Term | 43 | 84.85% | 65.12% | 73.68% |
| Notice Period To Terminate Renewal | 22 | 51.52% | 77.27% | 61.82% |
| Ip Ownership Assignment | 46 | 91.67% | 95.65% | 93.62% |
| Liquidated Damages | 16 | 76.19% | 100.00% | 86.49% |

## Test confusion matrix

Rows and columns are 1-based category indices in the mapping below.

| Index | Category |
|---:|---|
| 1 | Cap On Liability |
| 2 | Governing Law |
| 3 | Termination For Convenience |
| 4 | Audit Rights |
| 5 | Non-Compete |
| 6 | Anti-Assignment |
| 7 | Insurance |
| 8 | License Grant |
| 9 | Renewal Term |
| 10 | Notice Period To Terminate Renewal |
| 11 | Ip Ownership Assignment |
| 12 | Liquidated Damages |

| Actual \ Predicted | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 01 | 113 | 0 | 0 | 1 | 0 | 0 | 2 | 0 | 0 | 0 | 1 | 3 |
| 02 | 1 | 88 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 03 | 0 | 0 | 32 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 1 |
| 04 | 0 | 0 | 0 | 89 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 05 | 0 | 0 | 0 | 0 | 34 | 1 | 0 | 3 | 0 | 0 | 0 | 0 |
| 06 | 1 | 0 | 0 | 0 | 1 | 98 | 0 | 0 | 0 | 0 | 1 | 0 |
| 07 | 0 | 0 | 1 | 0 | 0 | 0 | 105 | 0 | 0 | 0 | 0 | 0 |
| 08 | 0 | 0 | 0 | 0 | 2 | 1 | 0 | 112 | 0 | 0 | 2 | 1 |
| 09 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 28 | 15 | 0 | 0 |
| 10 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 4 | 17 | 0 | 0 |
| 11 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 44 | 0 |
| 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 16 |

## Historical production benchmark comparison

The saved production benchmark refers to the same cached test partition and category order.

- Historical LR C: 5.0; generated 2026-10-26T16:36:25Z.
- Candidate: accuracy 94.06%, Macro F1 90.15%, weighted F1 94.18%.
- Historical: accuracy 94.30%, Macro F1 90.33%, weighted F1 94.40%.
- This is a retrospective comparison on a test partition already reported in the historical benchmark; it was not used for this candidate's selection.

Detailed metrics and full 12×12 confusion matrix: `logistic_regression_final_test.json`.
