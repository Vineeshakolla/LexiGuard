# LexiGuard — Documentation and Verification Audit

**Audit date:** October 27, 2026  
**Scope:** Dataset and cached splits, Logistic Regression holdout and grouped-CV experiments, frozen-candidate evaluation, Python/TypeScript inference, API and assistant behavior, build, and report outputs.

## Verified state

| Topic | Finding |
|---|---|
| Source data and splits | 4,673 cached clauses: 3,848 train-group clauses from 368 sample-bearing contracts and 825 test-group clauses from 97 contracts. Contract groups are disjoint. |
| Six-setting holdout experiment | Best validation Macro F1 88.42% at C=1.0 / 3,000 features. Smallest Macro F1 gap 0.72 pp at C=0.1 / 1,500 features (validation Macro F1 86.95%). This experiment did not calculate test metrics. |
| Grouped CV | Five seeded `StratifiedGroupKFold` folds on train-group examples; folds keep contract IDs intact, contain all 12 labels, and fit TF-IDF within each training fold. Best mean validation Macro F1 is 86.95% ± 1.29 pp at C=1.0 / 3,000 features. Mean train/validation Macro F1 gap is 5.07 ± 1.31 pp. |
| Frozen candidate test evaluation | The CV-selected C=1.0 / 3,000-feature candidate was evaluated once on the cached test partition after selection: accuracy 94.06%, Macro precision 89.63%, Macro recall 91.61%, Macro F1 90.15%, weighted precision 94.66%, weighted recall 94.06%, weighted F1 94.18%. |
| Test-set caveat | The historical C=5.0 benchmark had already reported on this same test partition (94.30% accuracy, 90.33% Macro F1, 94.40% weighted F1). The new test evaluation did not influence candidate selection, but this partition is not globally unseen. The candidate is slightly lower on those three aggregate metrics and is not deployed. |
| Production model artifacts | Existing runtime export and Joblib artifacts were not replaced. |
| Renewal/Notice probe | Python and TypeScript agree on all 24 predictions and confidences. Strict expected-label match is 23/24; evidence-backed acceptable labels match 24/24. The unmatched synthetic sentence mixes renewal duration and its opt-out deadline; 82 normalized training texts occur with both labels. The exact synthetic sentence is not in the cache. |
| Assistant and API | Assistant fallback is covered for disabled, provider-error, and timeout cases. Isolated API integration covers TXT, DOCX, searchable/image-only/corrupt PDF, unsupported/oversized/empty input, classification, analysis, assistant fallback, and PDF download. |
| Remaining product limitations | Live Gemini was not tested; OCR is not implemented. Confidence is uncalibrated and risk scoring lacks expert-labeled validation. |

## Commands run and outcomes

| Command/check | Outcome |
|---|---|
| `python ml_pipeline\experiment_logistic_regression.py` | Completed the six validation-only settings and wrote the original experiment JSON/Markdown report. |
| `npm run ml:grouped-cv` | Exit 0; five-fold grouped CV completed for all six configurations and saved the CV results/report. |
| `npm run ml:evaluate-frozen` | Exit 0 once after freezing the CV selection; saved final test metrics. The command refuses to overwrite the existing output and was not rerun. |
| `npm test` | Exit 0; all five stages passed: risk scoring, ML/assistant, Python/TypeScript parity, assistant fallback, and API integration. |
| `npm run lint` | Exit 0; `tsc --noEmit` passed. |
| `npm run build` | Exit 0; 2,504 modules transformed. Output chunks were 610.10 kB and 508.18 kB; Vite reported its >500 kB advisory. |
| `python -m py_compile ml_pipeline\grouped_cv_logistic_regression.py ml_pipeline\evaluate_frozen_logistic_regression.py ml_pipeline\generate_pdf_report.py ml_pipeline\inference.py ml_pipeline\experiment_logistic_regression.py` | Exit 0; all listed Python modules compiled. |
| `npm run report:pdf` | Regenerated the three PDF destinations from the final Markdown and JSON diagnostics. |
| PDF verification | All three PDFs have valid headers/EOF markers and are byte-identical; extracted text was checked for the grouped-CV comparison, frozen test metrics, class mapping, and probe explanation. |
| Browser check at `http://localhost:3000` | Main page loaded; an intercepted simulated `/api/analyze` 503 was surfaced as “Analysis Could Not Complete” with the error message. No HMR handshake error was observed in this session. A warning seen earlier on the stopped temporary port 3001 was not diagnosed or claimed fixed. |

## Artifacts and reports

- `data/logistic_regression_experiments.json` and `data/logistic_regression_experiments_report.md` retain the single-split six-setting validation experiment.
- `data/logistic_regression_grouped_cv.json` and `data/logistic_regression_grouped_cv_report.md` record fold results and the CV-selected candidate.
- `data/logistic_regression_final_test.json` and `data/logistic_regression_final_test_report.md` record the one-time evaluation of the frozen candidate.
- `data/ts_parity_results.txt` records the current parity and evidence-backed label results.
- `docs/LexiGuard_Final_Project_Report.pdf`, `docs/LexiGuard_ML_Project_Report.pdf`, and `public/LexiGuard_ML_Project_Report.pdf` are generated report copies.

## Recommendation

Do not replace the production model based on these results alone. The CV-selected candidate is slightly below the historical C=5.0 model on three aggregate test metrics from the same cached split. Review class-level errors, especially `Renewal Term` and `Notice Period To Terminate Renewal`, and consider a genuinely new external test set before any deployment decision.
