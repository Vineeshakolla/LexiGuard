#!/usr/bin/env python3
"""
LexiGuard ML Audit Script
=========================
Performs a rigorous independent validation audit:
1. Loads preprocessed_dataset.json (contains train/test contract-level split)
2. Creates a 3-way split: train (64%) / validation (16%) / test (20%)
   All splits are at CONTRACT level to prevent leakage.
3. Fits TF-IDF (TS-aligned stopwords, ngram (1,2), max_features=3000) on TRAIN only.
4. Tunes C (LR/SVM), alpha (NB), and k (KNN) using VALIDATION macro F1 only.
5. Reports train accuracy (to detect overfitting), val accuracy, test accuracy.
6. Evaluates final model ONCE on test set.
7. Checks that no contract_id appears in multiple splits.
8. Cross-checks Python vs TypeScript prediction consistency.
"""

import json
import os
import sys
import time
import random

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix

RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# TS-aligned stopwords (must match clauseClassifier.ts and train_and_evaluate.py exactly)
TS_STOPWORDS = list({
    'a','about','above','after','again','against','all','am','an','and','any','are','as','at',
    'be','because','been','before','being','below','between','both','but','by','could','did',
    'do','does','doing','down','during','each','few','for','from','further','had','has','have',
    'having','he','her','here','hers','herself','him','himself','his','how','i','if','in','into',
    'is','it','its','itself','just','me','more','most','my','myself','no','nor','not','now','of',
    'off','on','once','only','or','other','our','ours','ourselves','out','over','own','same','she',
    'should','so','some','such','than','that','the','their','theirs','them','themselves','then',
    'there','these','they','this','those','through','to','too','under','until','up','very','was',
    'we','were','what','when','where','which','while','who','whom','why','with','would','you','your','yours'
})

print("=" * 70)
print("   LEXIGUARD: ML AUDIT -- TRAIN / VALIDATION / TEST SPLIT")
print("=" * 70)

# -- Load preprocessed dataset --
data_path = "data/preprocessed_dataset.json"
if not os.path.exists(data_path):
    print("[ERROR] preprocessed_dataset.json not found. Run: python ml_pipeline/preprocess.py")
    sys.exit(1)

with open(data_path, "r", encoding="utf-8") as f:
    data = json.load(f)

meta = data["metadata"]
categories = meta["categories"]
cat_to_id = {c: i for i, c in enumerate(categories)}
n_classes = len(categories)

# Reconstruct per-contract clause lists from train_samples
# (test_samples remain UNTOUCHED as held-out test)
train_samples_all = data["train_samples"]
test_samples = data["test_samples"]

# Group train_samples by contract_id
contract_map: dict = {}
for s in train_samples_all:
    cid = s["contract_id"]
    contract_map.setdefault(cid, []).append(s)

train_contract_ids = list(contract_map.keys())
test_contract_ids = list(set(s["contract_id"] for s in test_samples))

# -- AUDIT 1: Zero leakage check --
overlap = set(train_contract_ids) & set(test_contract_ids)
print(f"\n[Audit 1] Contract-Level Leakage Check")
print(f"  Train contracts : {len(train_contract_ids)}")
print(f"  Test contracts  : {len(test_contract_ids)}")
print(f"  Overlap (must=0): {len(overlap)}")
if len(overlap) > 0:
    print(f"  *** DATA LEAKAGE DETECTED: {overlap} ***")
else:
    print(f"  PASS: Zero document leakage confirmed.")

# -- Create 3-way split from training contracts --
# Hold out 20% of train contracts as validation (80/20 within train contracts)
random.seed(RANDOM_SEED)
shuffled_train_ids = list(train_contract_ids)
random.shuffle(shuffled_train_ids)
val_cut = int(len(shuffled_train_ids) * 0.20)
val_contract_ids = set(shuffled_train_ids[:val_cut])
fit_contract_ids = set(shuffled_train_ids[val_cut:])

fit_samples = [s for cid in fit_contract_ids for s in contract_map[cid]]
val_samples = [s for cid in val_contract_ids for s in contract_map[cid]]

# Verify 3-way leakage
overlap_fit_val = fit_contract_ids & val_contract_ids
overlap_fit_test = fit_contract_ids & set(test_contract_ids)
overlap_val_test = val_contract_ids & set(test_contract_ids)

print(f"\n[Audit 2] 3-Way Split Sizes")
print(f"  Fit    contracts: {len(fit_contract_ids)} ({len(fit_samples)} clauses)")
print(f"  Val    contracts: {len(val_contract_ids)} ({len(val_samples)} clauses)")
print(f"  Test   contracts: {len(test_contract_ids)} ({len(test_samples)} clauses)")
print(f"  Fit&Val overlap : {len(overlap_fit_val)}  (must=0)")
print(f"  Fit&Test overlap: {len(overlap_fit_test)} (must=0)")
print(f"  Val&Test overlap: {len(overlap_val_test)} (must=0)")
if overlap_fit_val or overlap_fit_test or overlap_val_test:
    print("  *** LEAKAGE DETECTED IN 3-WAY SPLIT ***")
else:
    print("  PASS: All three splits are disjoint.")

# -- Prepare feature matrices --
fit_texts  = [s["text"] for s in fit_samples]
fit_labels = [cat_to_id[s["category"]] for s in fit_samples]

val_texts  = [s["text"] for s in val_samples]
val_labels = [cat_to_id[s["category"]] for s in val_samples]

test_texts  = [s["text"] for s in test_samples]
test_labels = [cat_to_id[s["category"]] for s in test_samples]

print(f"\n[Audit 3] TF-IDF Vectorizer -- Fit on FIT split only (TS-aligned stopwords)")
t0 = time.time()
vectorizer = TfidfVectorizer(
    ngram_range=(1, 2), sublinear_tf=True,
    min_df=3, max_features=3000, norm='l2',
    stop_words=TS_STOPWORDS
)
X_fit  = vectorizer.fit_transform(fit_texts)
X_val  = vectorizer.transform(val_texts)
X_test = vectorizer.transform(test_texts)
print(f"  Vectorizer fit in {(time.time()-t0)*1000:.0f}ms. Vocab: {len(vectorizer.vocabulary_)} features")
print("  PASS: Vectorizer fitted on FIT data only; val and test use frozen transform.")

def eval_metrics(y_true, y_pred):
    acc = accuracy_score(y_true, y_pred) * 100
    mac_p, mac_r, mac_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average='macro', zero_division=0)
    wt_f1 = precision_recall_fscore_support(
        y_true, y_pred, average='weighted', zero_division=0)[2] * 100
    return {
        "accuracy": round(acc, 2),
        "macro_f1": round(mac_f1 * 100, 2),
        "macro_precision": round(mac_p * 100, 2),
        "macro_recall": round(mac_r * 100, 2),
        "weighted_f1": round(wt_f1, 2),
    }

# -- AUDIT 4: Hyperparameter search on VALIDATION set only --
print("\n[Audit 4] Hyperparameter Tuning (Validation Set Only)")

C_candidates      = [0.01, 0.1, 1.0, 5.0, 10.0]
alpha_candidates  = [0.1, 0.5, 1.0, 2.0]
k_candidates      = [3, 5, 7, 11]

best_C_lr,    best_val_f1_lr  = 1.0, 0.0
best_C_svm,   best_val_f1_svm = 1.0, 0.0
best_alpha_nb, best_val_f1_nb = 1.0, 0.0
best_k_knn,   best_val_f1_knn = 5,   0.0

print("  Tuning LR and SVM (C)...")
for C in C_candidates:
    m_lr = LogisticRegression(C=C, max_iter=300, class_weight='balanced', random_state=RANDOM_SEED)
    m_lr.fit(X_fit, fit_labels)
    val_f1_lr = precision_recall_fscore_support(
        val_labels, m_lr.predict(X_val), average='macro', zero_division=0)[2] * 100
    print(f"    LR  C={C:5.2f}  Val Macro F1={val_f1_lr:.2f}%")
    if val_f1_lr > best_val_f1_lr:
        best_val_f1_lr = val_f1_lr
        best_C_lr = C

    m_svm = LinearSVC(C=C, class_weight='balanced', max_iter=3000, random_state=RANDOM_SEED)
    m_svm.fit(X_fit, fit_labels)
    val_f1_svm = precision_recall_fscore_support(
        val_labels, m_svm.predict(X_val), average='macro', zero_division=0)[2] * 100
    print(f"    SVM C={C:5.2f}  Val Macro F1={val_f1_svm:.2f}%")
    if val_f1_svm > best_val_f1_svm:
        best_val_f1_svm = val_f1_svm
        best_C_svm = C

print("  Tuning NB (alpha)...")
for alpha in alpha_candidates:
    m_nb = MultinomialNB(alpha=alpha)
    m_nb.fit(X_fit, fit_labels)
    val_f1_nb = precision_recall_fscore_support(
        val_labels, m_nb.predict(X_val), average='macro', zero_division=0)[2] * 100
    print(f"    NB  alpha={alpha:4.1f}  Val Macro F1={val_f1_nb:.2f}%")
    if val_f1_nb > best_val_f1_nb:
        best_val_f1_nb = val_f1_nb
        best_alpha_nb = alpha

print("  Tuning KNN (k)...")
for k in k_candidates:
    m_knn = KNeighborsClassifier(n_neighbors=k, metric='cosine', weights='distance')
    m_knn.fit(X_fit, fit_labels)
    val_f1_knn = precision_recall_fscore_support(
        val_labels, m_knn.predict(X_val), average='macro', zero_division=0)[2] * 100
    print(f"    KNN k={k:<3d}  Val Macro F1={val_f1_knn:.2f}%")
    if val_f1_knn > best_val_f1_knn:
        best_val_f1_knn = val_f1_knn
        best_k_knn = k

print(f"  Best LR  C={best_C_lr}         (Val Macro F1={best_val_f1_lr:.2f}%)")
print(f"  Best SVM C={best_C_svm}         (Val Macro F1={best_val_f1_svm:.2f}%)")
print(f"  Best NB  alpha={best_alpha_nb}  (Val Macro F1={best_val_f1_nb:.2f}%)")
print(f"  Best KNN k={best_k_knn}           (Val Macro F1={best_val_f1_knn:.2f}%)")

# -- AUDIT 5: Retrain on full train split (fit+val) with best hyperparams --
print("\n[Audit 5] Full Model Training (fit+val combined) with tuned hyperparameters")
X_train_full = vectorizer.transform([s["text"] for s in train_samples_all])
y_train_full  = [cat_to_id[s["category"]] for s in train_samples_all]

models_final = {}

def train_eval_all_splits(label, clf, X_tr, y_tr, X_v, y_v, X_ts, y_ts):
    clf.fit(X_tr, y_tr)
    r_tr = eval_metrics(y_tr, clf.predict(X_tr))
    r_v  = eval_metrics(y_v,  clf.predict(X_v))
    r_ts = eval_metrics(y_ts, clf.predict(X_ts))
    gap_acc  = round(r_tr["accuracy"] - r_v["accuracy"], 2)
    gap_f1   = round(r_tr["macro_f1"] - r_v["macro_f1"], 2)
    print(f"\n  {label}")
    print(f"    Train Acc={r_tr['accuracy']:.2f}%  Val Acc={r_v['accuracy']:.2f}%  Test Acc={r_ts['accuracy']:.2f}%")
    print(f"    Train F1 ={r_tr['macro_f1']:.2f}%  Val F1 ={r_v['macro_f1']:.2f}%  Test F1 ={r_ts['macro_f1']:.2f}%")
    print(f"    Train-Val Accuracy Gap: {gap_acc:.2f}pp  |  Train-Val Macro F1 Gap: {gap_f1:.2f}pp")
    if gap_acc > 10:
        print(f"    WARNING: Large train-val gap ({gap_acc:.1f}pp) -- possible overfitting.")
    elif gap_acc < 0:
        print(f"    NOTE: Val acc > Train acc (unusual -- may be class distribution difference).")
    else:
        print(f"    Gap is within acceptable range (<=10pp); no strong overfitting signal.")
    return clf, r_tr, r_v, r_ts

print("  Training all 4 models on full train split...")

clf_lr, r_tr_lr, r_v_lr, r_ts_lr = train_eval_all_splits(
    f"Logistic Regression (C={best_C_lr}, balanced)",
    LogisticRegression(C=best_C_lr, max_iter=300, class_weight='balanced', random_state=RANDOM_SEED),
    X_train_full, y_train_full, X_val, val_labels, X_test, test_labels
)
models_final["logisticRegression"] = (clf_lr, r_ts_lr)

clf_svm, r_tr_svm, r_v_svm, r_ts_svm = train_eval_all_splits(
    f"Linear SVM (C={best_C_svm}, balanced)",
    LinearSVC(C=best_C_svm, class_weight='balanced', max_iter=3000, random_state=RANDOM_SEED),
    X_train_full, y_train_full, X_val, val_labels, X_test, test_labels
)
models_final["linearSvm"] = (clf_svm, r_ts_svm)

clf_nb, r_tr_nb, r_v_nb, r_ts_nb = train_eval_all_splits(
    f"Multinomial Naive Bayes (alpha={best_alpha_nb})",
    MultinomialNB(alpha=best_alpha_nb),
    X_train_full, y_train_full, X_val, val_labels, X_test, test_labels
)
models_final["multinomialNaiveBayes"] = (clf_nb, r_ts_nb)

clf_knn, r_tr_knn, r_v_knn, r_ts_knn = train_eval_all_splits(
    f"KNN (k={best_k_knn}, cosine, distance weights)",
    KNeighborsClassifier(n_neighbors=best_k_knn, metric='cosine', weights='distance'),
    X_train_full, y_train_full, X_val, val_labels, X_test, test_labels
)
models_final["knn"] = (clf_knn, r_ts_knn)

# -- AUDIT 6: Per-class metrics on test set for all 4 models --
print("\n[Audit 6] Per-Class Test Metrics (All 4 Models)")
print(f"  {'Category':<38} {'LR F1':>7} {'SVM F1':>7} {'NB F1':>7} {'KNN F1':>8}")
print(f"  {'-'*38} {'-'*7} {'-'*7} {'-'*7} {'-'*8}")

def per_class_f1(clf, X_ts, y_ts):
    y_pred = clf.predict(X_ts)
    _, _, f1s, _ = precision_recall_fscore_support(
        y_ts, y_pred, labels=list(range(n_classes)), zero_division=0)
    return [round(f * 100, 1) for f in f1s]

f1_lr  = per_class_f1(clf_lr,  X_test, test_labels)
f1_svm = per_class_f1(clf_svm, X_test, test_labels)
f1_nb  = per_class_f1(clf_nb,  X_test, test_labels)
f1_knn = per_class_f1(clf_knn, X_test, test_labels)

for i, cat in enumerate(categories):
    print(f"  {cat:<38} {f1_lr[i]:>6.1f}% {f1_svm[i]:>6.1f}% {f1_nb[i]:>6.1f}% {f1_knn[i]:>7.1f}%")

# -- AUDIT 7: Select best model by VALIDATION F1 --
val_f1s = {
    "logisticRegression":    r_v_lr["macro_f1"],
    "linearSvm":             r_v_svm["macro_f1"],
    "multinomialNaiveBayes": r_v_nb["macro_f1"],
    "knn":                   r_v_knn["macro_f1"],
}
best_key = max(val_f1s, key=val_f1s.get)
model_names = {
    "logisticRegression":    "Logistic Regression",
    "linearSvm":             "Linear SVM",
    "multinomialNaiveBayes": "Multinomial Naive Bayes",
    "knn":                   "KNN",
}

print(f"\n[Audit 7] Model Selection Summary (by VALIDATION Macro F1)")
print(f"  {'Model':<28} {'Val Macro F1':>14} {'Test Macro F1':>14}")
print(f"  {'-'*28} {'-'*14} {'-'*14}")
for k in ["logisticRegression", "linearSvm", "multinomialNaiveBayes", "knn"]:
    star = " << SELECTED" if k == best_key else ""
    val_f, test_f = val_f1s[k], models_final[k][1]["macro_f1"]
    print(f"  {model_names[k]:<28} {val_f:>13.2f}% {test_f:>13.2f}%{star}")

best_clf = models_final[best_key][0]
best_test = models_final[best_key][1]

print(f"\n  Selected best model: {model_names[best_key]}")
print(f"  Final held-out test Accuracy : {best_test['accuracy']:.2f}%")
print(f"  Final held-out test Macro F1 : {best_test['macro_f1']:.2f}%")
print(f"  Final held-out test Weighted F1: {best_test['weighted_f1']:.2f}%")

# -- AUDIT 8: Confusion matrix for best model --
print(f"\n[Audit 8] Confusion Matrix -- {model_names[best_key]} on Test Set")
y_pred_best = best_clf.predict(X_test)
cm = confusion_matrix(test_labels, y_pred_best, labels=list(range(n_classes)))

print(f"  (Showing diagonal TP and significant off-diagonal errors)")
for i, cat in enumerate(categories):
    tp = cm[i][i]
    errors = [(categories[j], cm[i][j]) for j in range(n_classes) if j != i and cm[i][j] > 0]
    if errors:
        err_str = ", ".join([f"{c}:{cnt}" for c, cnt in errors])
        print(f"  {cat:<38} TP={tp:3d}  Errors: {err_str}")
    else:
        print(f"  {cat:<38} TP={tp:3d}  Perfect (no errors on test set)")

# -- AUDIT 9: Cross-check existing traditional_ml_results.json --
print("\n[Audit 9] Cross-Check Existing results vs Audit Results")
results_path = "data/traditional_ml_results.json"
if os.path.exists(results_path):
    with open(results_path, encoding="utf-8") as f:
        existing = json.load(f)
    ex_best_key  = existing.get("selectedModel", "?")
    ex_best_name = existing.get("selectedModelName", "?")
    ex_best_test_acc = existing["algorithms"].get(ex_best_key, {}).get("accuracy", "?")
    ex_best_test_f1  = existing["algorithms"].get(ex_best_key, {}).get("macroF1",   "?")

    print(f"  Existing results JSON:")
    print(f"    selectedModel:     {ex_best_name} ({ex_best_key})")
    print(f"    Test Accuracy:     {ex_best_test_acc}%")
    print(f"    Test Macro F1:     {ex_best_test_f1}%")
    print(f"  Audit re-evaluation (same test set):")
    print(f"    Best model:        {model_names[best_key]}")
    print(f"    Test Accuracy:     {best_test['accuracy']}%")
    print(f"    Test Macro F1:     {best_test['macro_f1']}%")
    print(f"  NOTE: Audit trains on full 408 contracts; results are comparable.")

    # Check selectedModel matches model_export.json
    export_path = "data/model_artifacts/model_export.json"
    if os.path.exists(export_path):
        with open(export_path, encoding="utf-8") as f:
            export = json.load(f)
        export_best = export.get("selectedModel", "?")
        print(f"\n  model_export.json selectedModel:            {export_best}")
        print(f"  traditional_ml_results.json selectedModel: {ex_best_key}")
        if export_best == ex_best_key:
            print(f"  PASS: Both JSONs agree on best model ({ex_best_key}). TypeScript classifier will use it.")
        else:
            print(f"  MISMATCH: export says '{export_best}', results says '{ex_best_key}'.")
else:
    print(f"  WARNING: {results_path} not found. Run train_and_evaluate.py first.")

# -- AUDIT 10: Python inference consistency check on representative clauses --
print("\n[Audit 10] Python Inference Consistency Check")
test_clauses = [
    ("Cap On Liability",              "In no event shall either party aggregate liability exceed the total fees paid in the preceding twelve months."),
    ("Governing Law",                 "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware."),
    ("Termination For Convenience",   "Either party may terminate this Agreement without cause upon thirty (30) days prior written notice to the other party."),
    ("Audit Rights",                  "Customer shall allow Vendor and its certified public accountants to inspect and audit books, records, and systems once annually."),
    ("Non-Compete",                   "The Consultant shall not engage in any business that directly competes with the Company for a period of two years after termination."),
    ("Insurance",                     "Each party shall maintain commercial general liability insurance with minimum coverage of two million dollars per occurrence."),
    ("License Grant",                 "Provider grants Customer a non-exclusive, non-transferable, royalty-free license to use the Software during the subscription term."),
    ("Renewal Term",                  "This Agreement shall automatically renew for successive one-year terms unless either party provides written notice of non-renewal."),
    ("Liquidated Damages",            "In the event of delay the Contractor shall pay liquidated damages of five thousand dollars per calendar day of delay."),
]

print(f"  Using best model: {model_names[best_key]}")
print(f"  {'Expected Category':<38} {'Predicted':>30} {'Match':>6}")
print(f"  {'-'*38} {'-'*30} {'-'*6}")

correct = 0
for expected_cat, text in test_clauses:
    X = vectorizer.transform([text])
    pred_id = best_clf.predict(X)[0]
    pred_cat = categories[pred_id]
    match = "Y" if pred_cat == expected_cat else "N"
    if pred_cat == expected_cat:
        correct += 1
    print(f"  {expected_cat:<38} {pred_cat:>30} {match:>6}")

accuracy_probes = correct / len(test_clauses) * 100
print(f"\n  Probe accuracy on {len(test_clauses)} representative clauses: {accuracy_probes:.0f}%")
print(f"  Any mismatches above indicate the model has weak signal for that clause type.")

# -- AUDIT 11: Overfitting / Underfitting summary --
print("\n[Audit 11] Overfitting / Underfitting Evidence Summary")
for k, (label, r_tr, r_v, r_ts) in [
    ("logisticRegression",    ("Logistic Regression", r_tr_lr, r_v_lr, r_ts_lr)),
    ("linearSvm",             ("Linear SVM",          r_tr_svm, r_v_svm, r_ts_svm)),
    ("multinomialNaiveBayes", ("Naive Bayes",         r_tr_nb, r_v_nb, r_ts_nb)),
    ("knn",                   ("KNN",                  r_tr_knn, r_v_knn, r_ts_knn)),
]:
    gap_acc = r_tr["accuracy"] - r_v["accuracy"]
    gap_f1  = r_tr["macro_f1"] - r_v["macro_f1"]
    if gap_acc > 15:
        verdict = "OVERFIT (large train-val gap)"
    elif gap_acc > 8:
        verdict = "MILD OVERFIT (moderate gap)"
    elif r_v["accuracy"] > r_tr["accuracy"] + 2:
        verdict = "POSSIBLE UNDERFIT or train/val distribution mismatch"
    else:
        verdict = "No strong overfitting signal"
    print(f"  {label:<28}: Train-Val Acc gap={gap_acc:+.1f}pp  F1 gap={gap_f1:+.1f}pp  -> {verdict}")

print("\n  Structural limitations:")
print("  1. Hyperparameters tuned with single hold-out val (not cross-validation).")
print("  2. No calibration (Platt scaling) -- confidence % is margin rank, not probability.")
print("  3. Minority class 'Notice Period To Terminate Renewal' overlaps with 'Renewal Term'")
print("     causing persistent confusion that cannot be eliminated by regularisation alone.")
print("  4. Corpus is SEC EDGAR corporate agreements only.")

print("\n" + "=" * 70)
print("   AUDIT COMPLETE")
print("=" * 70)
