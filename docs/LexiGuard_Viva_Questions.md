# LexiGuard — Viva Preparation Guide

Answers reflect the checked project code, six-setting Logistic Regression validation experiment, five-fold grouped CV, and one frozen-candidate final evaluation dated October 27, 2026. Do not mix the validation results with the earlier saved production benchmark.

## Q1. What is LexiGuard?

LexiGuard is a React/TypeScript application with an Express backend and Python/scikit-learn training code. It extracts contract text, supports clause categorization, gives a heuristic risk overview, and offers an optional Gemini assistant.

## Q2. What problem does it address?

Contracts can contain lengthy, specialized language. LexiGuard is intended to help a user find and understand selected clause types and potential issues as a preliminary review aid. It does not provide legal advice or establish that a contract is safe.

## Q3. What dataset is used?

The project’s Atticus Open Contract Dataset / CUAD v1 CSV contains 510 contract rows and 83 columns. The project identifies the source as SEC EDGAR commercial agreements and records CC BY 4.0; check the upstream distribution for license terms.

## Q4. What do the model input and target represent?

The input is an extracted clause quote string. The target label is the name of the selected category field that contained that quote. `Filename`, document metadata, and the paired `*-Answer` fields are not features in this classifier.

## Q5. What are the 12 target categories?

Cap On Liability; Governing Law; Termination For Convenience; Audit Rights; Non-Compete; Anti-Assignment; Insurance; License Grant; Renewal Term; Notice Period To Terminate Renewal; Ip Ownership Assignment; Liquidated Damages.

## Q6. What preprocessing is implemented?

The Python code reads selected category fields, filters empty/short content, extracts quoted values where represented as lists, collapses whitespace, lowercases and replaces non-ASCII-alphanumeric characters with spaces, then deduplicates on category plus normalized text. It assigns whole contracts to train or test groups. It does not implement Unicode NFC canonicalization or explicit smart-quote normalization, despite older report claims.

## Q7. How large is the cleaned dataset?

It scans 6,120 selected contract/category cells. 3,625 are empty, and 77 duplicate category-text records are removed. The cached data contains 4,673 clause examples: 3,848 in the train group and 825 in the held-out test group.

## Q8. Why split at contract level?

Clauses from one contract may share templates and wording. Keeping all clauses from the same contract in one partition helps prevent the model from appearing to generalize by recognizing material from a document it has already seen.

## Q9. How are the current validation partitions formed?

The preprocessor assigns whole contracts deterministically (every fifth source row is held out for test). The training script sorts train-side contract IDs, shuffles them with seed 42, then reserves the first 20% for validation. For the cached nonempty sample groups, this is 295 fit and 73 validation contracts (3,064 and 784 clauses). Some assigned contracts have no retained clauses, so sample-bearing ID counts differ from the 408/102 record assignments.

## Q10. What is TF-IDF and how is it configured?

TF-IDF weights terms based on their frequency in a clause and rarity across fit documents. The project uses unigrams and bigrams, `min_df=3`, sublinear term frequency, L2 normalization, a custom stopword list, and a 3,000-feature default. The six-run experiment also tests a 1,500-feature cap. Each vectorizer is fitted only on its fit partition; validation text is transformed using that fitted vocabulary.

## Q11. Which algorithms are in the full pipeline?

Logistic Regression, LinearSVC, Multinomial Naive Bayes, and K-Nearest Neighbors with cosine distance. The latest isolated comparison varies only Logistic Regression's C and vectorizer feature cap.

## Q12. What is C in Logistic Regression?

In scikit-learn, C is the inverse regularization strength. Lower C applies stronger regularization. Here the six settings are C=1.0, 0.5, or 0.1 crossed with 3,000 or 1,500 TF-IDF features. `max_iter=300`, balanced class weights, and seed 42 are held constant.

## Q13. What was the selection criterion?

Validation Macro F1. Macro F1 gives each class equal weight, which is informative when class supports differ. The held-out test set was not used for hyperparameter tuning or model selection.

## Q14. What are the six experiment results?

| C | Features | Train accuracy | Validation accuracy | Train Macro F1 | Validation Macro F1 | Macro F1 gap |
|---:|---:|---:|---:|---:|---:|---:|
| 1.0 | 3000 | 95.43% | 92.98% | 91.79% | **88.42%** | 3.37 pp |
| 0.5 | 3000 | 94.58% | 92.73% | 90.82% | 87.98% | 2.84 pp |
| 0.1 | 3000 | 92.56% | 92.35% | 88.39% | 87.50% | 0.89 pp |
| 1.0 | 1500 | 95.14% | 92.60% | 91.49% | 87.63% | 3.86 pp |
| 0.5 | 1500 | 94.22% | 92.35% | 90.39% | 87.10% | 3.29 pp |
| 0.1 | 1500 | 91.97% | 91.71% | 87.68% | 86.95% | **0.72 pp** |

## Q15. Which configuration is best?

By validation Macro F1, C=1.0 and 3,000 features are best at 88.42%. The lowest observed Macro F1 gap is 0.72 pp for C=0.1 and 1,500 features, but its validation Macro F1 is lower at 86.95%. Score and gap answer different questions.

## Q16. Does this show overfitting?

Training Macro F1 exceeds validation Macro F1 by 0.72–3.86 pp. Training-validation accuracy gaps are 0.21–2.54 pp. Lower C generally lowers the gap in these runs, with a modest validation-score decrease. These results do not prove overfitting is absent or guarantee external generalization. Every tested configuration has both training and validation accuracy above 90%; none has both below 90%.

## Q17. Which additional diagnostics were measured, and was the test set used?

The original six-setting holdout experiment did not calculate test metrics. It recorded train/validation accuracy, Macro precision/recall/F1, weighted precision/recall/F1, per-class support/precision/recall/F1, and confusion matrices. A separate five-fold contract-grouped CV on the 3,848 train-group clauses selected C=1.0, 3,000 features by mean validation Macro F1 (86.95% ± 1.29 pp). After freezing that candidate, it was evaluated once on the cached test partition: 94.06% accuracy, 89.63% Macro precision, 91.61% Macro recall, 90.15% Macro F1, 94.66% weighted precision, 94.06% weighted recall, and 94.18% weighted F1. The CV choice did not use test metrics.

The project’s historical C=5.0 benchmark had already reported on this same test partition. The new evaluation is therefore a fresh score for the frozen candidate on the existing split, but not a globally unseen test set. See the grouped CV and final test reports for class-level results and confusion matrices.

## Q18. What is the deployed runtime model?

`data/model_artifacts/model_export.json` currently identifies Logistic Regression and 3,000 features. This is the earlier saved artifact, not the new C=1.0 experimental candidate by promotion. The earlier saved training-results JSON records C=5.0 and its separate validation/test measurements. The experiment intentionally did not overwrite the runtime export or Joblib files.

## Q19. What is accuracy versus Macro F1?

Accuracy is the share of all predictions that are correct. Macro F1 is the unweighted mean of per-category F1 scores, which makes it more sensitive to low-support categories. Both are useful; they are not interchangeable.

## Q20. What does the risk score mean?

It is a heuristic aggregate of clause scores. The service averages supplied/default clause scores, rounds and clamps the result from 0 to 100, then applies thresholds: High at score ≥60, two high/critical clauses, or any critical clause; otherwise Medium at score ≥35 or two medium clauses; otherwise Low. It is not a probability or expert-validated prediction of legal harm.

## Q21. How does document analysis and the assistant work?

TXT/Markdown and DOCX can be extracted in the browser; PDFs are sent to the server parser. The analysis endpoint uses Gemini if configured, otherwise a rule/pattern-based fallback. The assistant has a Gemini call with an eight-second timeout and uses a deterministic knowledge-base fallback if unavailable. Scanned PDFs have no OCR support.

## Q22. Are confidence values calibrated probabilities?

No. Runtime code applies softmax to model decision scores to produce relative confidence-like values. There is no calibration procedure reported, so these must not be interpreted as empirical probabilities.

## Q23. What testing was run for model parity?

The test sends 24 identical probes through Python and TypeScript inference and compares predicted labels and confidence values. They agree on 24/24 labels and 24/24 confidence values within 0.02 percentage points. Separately, the strict expected-label count is 23/24; an evidence-backed acceptable-label check is 24/24.

## Q24. Why is the Renewal Term probe also accepted as a notice-period prediction?

The synthetic probe combines the length of an automatic renewal term with the deadline to opt out. The exact synthetic sentence is not in the cache, but 82 distinct normalized training texts appear under both `Renewal Term` and `Notice Period To Terminate Renewal`. The model’s decision scores for this probe are higher for Notice Period To Terminate Renewal (5.77822) than Renewal Term (4.83615). Python and TypeScript agree on that result, so this is not a runtime parity defect; it is a genuine overlapping-label probe. The strict 23/24 figure remains reported rather than being hidden.

## Q25. What limitations should be stated?

The corpus is finite and domain-specific and classes are imbalanced. Grouped CV estimates performance across folds, but still uses this one corpus. The cached test split had already been reported in the historical benchmark; it is not globally unseen. Scanned PDF OCR is unsupported, assistant output depends on API configuration and can be wrong, confidence is uncalibrated, and risk scoring lacks expert-labeled validation. The parity probes do not prove general correctness. LexiGuard is not a substitute for counsel.

## Q26. What should happen next?

Review the lower-support Renewal Term and Notice Period results with domain experts, collect additional labeled contracts, and assess risk scoring only after obtaining expert risk labels. Keep the current production model until the new candidate is reviewed; it slightly trails the historical benchmark on accuracy, Macro F1, and weighted F1 on the same cached test partition. Do not claim a model replacement based on the CV or this retrospective test comparison alone.

## Q27. Where are full project details and commands?

See [the final report](LexiGuard_Final_Project_Report.md), [the experiment report](../data/logistic_regression_experiments_report.md), and [README](../README.md). Run `python ml_pipeline\experiment_logistic_regression.py` for the six-run experiment; it does not overwrite deployment artifacts. `npm test`, `npm run lint`, and `npm run build` are the application checks.
