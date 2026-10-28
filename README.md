# LexiGuard — AI-Powered Legal Clause Classification and Contractual Risk Analysis

LexiGuard is a React/TypeScript application with an Express backend and a Python/scikit-learn training pipeline. It supports searchable contract text extraction, clause categorization, a heuristic risk overview, and an optional Gemini-powered assistant. It is an educational and preliminary-review tool, not legal advice.

See the [complete academic project report](docs/LexiGuard_Final_Project_Report.md), [formatted report PDF](docs/LexiGuard_Final_Project_Report.pdf), [experiment comparison](data/logistic_regression_experiments_report.md), [viva guide](docs/LexiGuard_Viva_Questions.md), and [verification audit](docs/LexiGuard_Final_Audit.md).

## Current ML status

The latest isolated Logistic Regression experiment used a seeded contract-level validation split (295 fit / 73 validation contracts; 3,064 / 784 clauses). It did not use the test set and did not update deployed artifacts.

| C | max_features | Training accuracy | Validation accuracy | Training Macro F1 | Validation Macro F1 | Macro F1 gap |
|---:|---:|---:|---:|---:|---:|---:|
| 1.0 | 3000 | 95.43% | 92.98% | 91.79% | **88.42%** | 3.37 pp |
| 0.5 | 3000 | 94.58% | 92.73% | 90.82% | 87.98% | 2.84 pp |
| 0.1 | 3000 | 92.56% | 92.35% | 88.39% | 87.50% | 0.89 pp |
| 1.0 | 1500 | 95.14% | 92.60% | 91.49% | 87.63% | 3.86 pp |
| 0.5 | 1500 | 94.22% | 92.35% | 90.39% | 87.10% | 3.29 pp |
| 0.1 | 1500 | 91.97% | 91.71% | 87.68% | 86.95% | **0.72 pp** |

The best validation Macro F1 is 88.42% (`C=1.0`, 3,000 features); the smallest train/validation Macro F1 gap is 0.72 pp (`C=0.1`, 1,500 features). These are validation measurements, not test scores. All six configurations have training and validation accuracies above 90%; a small observed gap is not proof of generalization.

### Grouped cross-validation and frozen test evaluation

The six settings were also compared using five-fold `StratifiedGroupKFold` (seed 42) on the 3,848 train-group clauses from 368 source contracts. All clauses from a source contract stayed in one fold; TF-IDF was refitted only on each fold’s training portion. The test samples were not used for CV or configuration selection.

| C | Features | Accuracy | Macro P | Macro R | Macro F1 | Weighted P | Weighted R | Weighted F1 | Train−validation Macro F1 gap |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1.0 | 3000 | 92.02 ± 0.99% | 86.74 ± 1.30% | 87.53 ± 1.38% | **86.95 ± 1.29%** | 92.26 ± 1.00% | 92.02 ± 0.99% | 92.04 ± 0.98% | 5.07 ± 1.31 pp |
| 0.5 | 3000 | 91.66 ± 1.00% | 86.38 ± 1.44% | 87.43 ± 1.49% | 86.72 ± 1.45% | 91.99 ± 1.05% | 91.66 ± 1.00% | 91.71 ± 1.02% | 4.41 ± 1.55 pp |
| 0.1 | 3000 | 90.67 ± 1.20% | 85.67 ± 1.80% | 87.00 ± 1.70% | 85.85 ± 1.57% | 91.30 ± 1.27% | 90.67 ± 1.20% | 90.74 ± 1.19% | 2.75 ± 1.79 pp |
| 1.0 | 1500 | 91.68 ± 1.06% | 86.19 ± 1.32% | 87.09 ± 1.32% | 86.50 ± 1.32% | 91.94 ± 1.00% | 91.68 ± 1.06% | 91.72 ± 1.05% | 5.31 ± 1.33 pp |
| 0.5 | 1500 | 91.16 ± 1.04% | 85.54 ± 1.07% | 86.83 ± 1.21% | 85.94 ± 1.12% | 91.61 ± 1.00% | 91.16 ± 1.04% | 91.24 ± 1.04% | 4.66 ± 1.25 pp |
| 0.1 | 1500 | 90.15 ± 1.62% | 84.98 ± 2.08% | 86.40 ± 2.16% | 85.15 ± 1.91% | 90.85 ± 1.71% | 90.15 ± 1.62% | 90.23 ± 1.61% | 2.77 ± 2.28 pp |

The CV-selected candidate was frozen at **C=1.0, 3,000 features**, based on highest mean validation Macro F1. A separate one-time evaluation then scored that frozen candidate on the 97-contract / 825-clause held-out test partition: accuracy **94.06%**, Macro precision **89.63%**, Macro recall **91.61%**, Macro F1 **90.15%**, weighted precision **94.66%**, weighted recall **94.06%**, weighted F1 **94.18%**. The previously saved production benchmark (C=5.0) is from the same cached test partition and reported 94.30% accuracy / 90.33% Macro F1 / 94.40% weighted F1. This is a retrospective reference only; test results did not influence the new CV selection. The new candidate is not deployed.

See the [grouped CV report](data/logistic_regression_grouped_cv_report.md) and [frozen test report](data/logistic_regression_final_test_report.md) for per-class metrics and confusion matrices.

**Deployment distinction:** `data/model_artifacts/model_export.json` still selects Logistic Regression from the earlier saved full run. `data/traditional_ml_results.json` records that separate run as C=5.0; its validation/test scores do not belong to the six configurations above. The experiment leaves production artifacts untouched. Review the report before considering a replacement.

## Dataset and ML pipeline

- Dataset: project-provided Atticus Open Contract Dataset (AOK/CUAD v1) CSV; 510 rows × 83 columns.
- Twelve selected categories, 4,673 cleaned clause samples; 3,848 train-group and 825 test-group samples.
- Preprocessing treats absent target annotations as empty cells, extracts quote text, normalizes by lowercase ASCII alphanumeric regex, and deduplicates on category + normalized text.
- Contract assignment is deterministic (every fifth source record is held out for test). The 408/102 record split differs from the 368/97 represented contract IDs because some records have no retained clauses.
- TF-IDF uses unigrams/bigrams, `min_df=3`, sublinear TF, L2 normalization, the shared custom stopword list, and a 3,000-feature default. The isolated experiment fits the vectorizer on fit data only.
- Training pipeline compares Logistic Regression, LinearSVC, Multinomial Naive Bayes, and cosine-distance KNN. Runtime model export currently selects Logistic Regression.
- The risk score is a separate heuristic and is not trained on expert risk labels.
- Runtime risk-score inputs use a finite positive supplied score capped at 100; otherwise the severity default is used.

## Run locally

Prerequisites: Node.js/npm and Python with the project’s ML dependencies (scikit-learn, NumPy, joblib). The repo contains `package-lock.json`; no Python requirements/lock file is present.

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

The training/experiment dataset cache is already provided. The six-run experiment can be reproduced without touching deployment artifacts:

```powershell
python ml_pipeline\experiment_logistic_regression.py
npm run ml:grouped-cv
npm run ml:evaluate-frozen
npm run report:pdf
```

The first command writes the six-setting holdout experiment. The grouped CV command selects a configuration using training-partition folds only. Run the frozen evaluation only after reviewing grouped CV; it saves the one-time final test metrics and refuses to overwrite an existing final test output. The PDF command renders the final Markdown report and appends the CV and test diagnostics. The separate full pipeline can regenerate production artifacts; do not run it solely to repeat these isolated experiments:

```powershell
python ml_pipeline\preprocess.py
python ml_pipeline\train_and_evaluate.py
```

## Tests and checks

```powershell
npm test
npm run lint
npm run build
npx tsx test/ts-inference-crosscheck.ts
```

The crosscheck runs the same 24 probe clauses through Python and TypeScript inference and fails on prediction or confidence disagreement. The current artifacts agree on all 24 predicted labels and confidence values (within 0.02 percentage points); the strict expected-label check is 23/24. The unmatched synthetic fixture combines a renewal duration with a notice-to-cancel deadline; the cached training partition contains 82 distinct normalized texts labeled in both renewal-related categories, and the test checks this as an evidence-backed ambiguity without erasing the strict score. `test/risk-scoring.test.ts` exercises the production `calculateRiskScoreBreakdown` service, including defaults, non-finite/out-of-range scores, rounding, and escalation thresholds.

The test runner starts an isolated no-key Express instance and exercises TXT, DOCX, searchable/image-only PDF extraction, malformed/unsupported/oversized inputs, classify/analyze/assistant routes, and PDF download.

## Application routes

| Method | Route | Function |
|---|---|---|
| POST | `/api/analyze` | Analyze pasted/uploaded text; Gemini if configured, otherwise a grounded heuristic. |
| POST | `/api/extract-text` | Extract searchable PDF, DOCX, or text file contents. |
| POST | `/api/ml/classify` | Categorize one clause using the TypeScript runtime model. |
| GET | `/api/ml/evaluation` | Return the earlier full-run benchmark JSON. |
| POST | `/api/assistant/chat` | Contextual assistant with Gemini/fallback behavior. |
| GET | `/api/dataset/status`, `/categories`, `/search`, `/evaluation`, `/explorer` | Dataset status, categories, search, and explorer data. |

## Configuration and limitations

- `GEMINI_API_KEY` is optional. A real key enables Gemini requests; missing, placeholder, failed, or timed-out calls use local grounded fallbacks. Never commit a real key.
- `PORT` optionally changes the Express port (default `3000`).
- Maximum browser upload size is 25 MB. Image-only/scanned PDFs need OCR; OCR is not included.
- The 12-category model is trained on SEC EDGAR commercial contracts; other domains and languages are unverified.
- TypeScript confidence values are softmax-normalized decision margins, not calibrated probabilities.
- Risk scores and AI explanations are not legally validated. A qualified legal professional should review consequential decisions.

## Key files

| Path | Role |
|---|---|
| `server.ts` | Express APIs, Gemini document analysis, grounded fallback. |
| `src/App.tsx`, `src/components/` | React application and dashboard. |
| `src/ml/clauseClassifier.ts` | In-process TypeScript model inference. |
| `src/server/riskScoringService.ts` | Heuristic score aggregation and tiers. |
| `src/server/assistantService.ts` | Assistant intents, Gemini call and grounded fallback. |
| `src/utils/documentProcessor.ts` | Browser-side document extraction. |
| `ml_pipeline/preprocess.py` | CSV processing and contract train/test assignment. |
| `ml_pipeline/train_and_evaluate.py` | Four-model training, validation selection and artifact export. |
| `ml_pipeline/experiment_logistic_regression.py` | Isolated six-setting LR validation experiment. |
| `data/model_artifacts/` | Existing runtime model artifacts; not changed by the experiment. |
| `test/` | ML assertions, production risk-scoring tests, and Python/TypeScript inference parity probes. |
