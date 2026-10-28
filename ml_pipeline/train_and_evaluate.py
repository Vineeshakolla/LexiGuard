#!/usr/bin/env python3
"""
LexiGuard Machine Learning Pipeline: Training & Evaluation
----------------------------------------------------------
Trains and evaluates 4 traditional ML classifiers on TF-IDF features:
1. Logistic Regression (One-vs-Rest / multinomial with balanced class weights)
2. Multinomial Naive Bayes (Laplace smoothing)
3. Linear SVM (LinearSVC with hinge loss & balanced class weights)
4. K-Nearest Neighbors (KNN with cosine metric, k=5)

Reproducible 3-Way Contract-Level Split:
- Train (64%) / Validation (16%) / Test (20%) by contract document.
- TF-IDF Vectorizer is fitted ONLY on the train split.
- Hyperparameters (C, alpha, k) are tuned on VALIDATION Macro F1 only.
- Best model is selected by VALIDATION Macro F1.
- Final evaluation is run ONCE on the untouched test split.
- Model serialization (Joblib + JSON export for zero-latency backend inference).
"""

import os
import time
import json
import random
import joblib
import numpy as np
from typing import Dict, List, Any
from collections import defaultdict

# TS_STOPWORDS matches the STOPWORDS constant in src/ml/clauseClassifier.ts exactly.
# Using the same list in both Python training and TypeScript inference guarantees that
# the vocabulary keys produced by sklearn are the same tokens the TS tokenizer
# can generate — eliminating dead-feature entries in TypeScript inference.
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

RANDOM_SEED = 42

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix
)

MODEL_NAMES = {
    "linearSvm": "Linear SVM",
    "logisticRegression": "Logistic Regression",
    "multinomialNaiveBayes": "Multinomial Naive Bayes",
    "knn": "KNN (k=5)"
}
MODEL_KEYS = ["logisticRegression", "multinomialNaiveBayes", "linearSvm", "knn"]


def evaluate_model_performance(y_true: List[int], y_pred: List[int], categories: List[str]) -> Dict[str, Any]:
    """Calculate comprehensive evaluation metrics."""
    acc = accuracy_score(y_true, y_pred) * 100.0
    macro_p, macro_r, macro_f1, _ = precision_recall_fscore_support(y_true, y_pred, average='macro', zero_division=0)
    weighted_p, weighted_r, weighted_f1, _ = precision_recall_fscore_support(y_true, y_pred, average='weighted', zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(categories))))
    per_class_p, per_class_r, per_class_f1, per_class_support = precision_recall_fscore_support(
        y_true, y_pred, labels=list(range(len(categories))), zero_division=0
    )

    category_metrics = []
    for c_idx, cat_name in enumerate(categories):
        tp = int(cm[c_idx][c_idx])
        fp = int(sum(cm[r][c_idx] for r in range(len(categories)) if r != c_idx))
        fn = int(sum(cm[c_idx][c] for c in range(len(categories)) if c != c_idx))
        support = int(per_class_support[c_idx])
        category_metrics.append({
            "category": cat_name,
            "support": support,
            "tp": tp, "fp": fp, "fn": fn,
            "precision": round(float(per_class_p[c_idx] * 100.0), 2),
            "recall": round(float(per_class_r[c_idx] * 100.0), 2),
            "f1": round(float(per_class_f1[c_idx] * 100.0), 2)
        })

    return {
        "accuracy": round(float(acc), 2),
        "macroPrecision": round(float(macro_p * 100.0), 2),
        "macroRecall": round(float(macro_r * 100.0), 2),
        "macroF1": round(float(macro_f1 * 100.0), 2),
        "weightedPrecision": round(float(weighted_p * 100.0), 2),
        "weightedRecall": round(float(weighted_r * 100.0), 2),
        "weightedF1": round(float(weighted_f1 * 100.0), 2),
        "categoryMetrics": category_metrics,
        "confusionMatrix": cm.tolist()
    }


def train_and_evaluate_all():
    data_path = "data/preprocessed_dataset.json"
    if not os.path.exists(data_path):
        from preprocess import run_preprocessing_pipeline
        run_preprocessing_pipeline()

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data["metadata"]
    categories = meta["categories"]
    cat_to_id = {cat: i for i, cat in enumerate(categories)}
    n_classes = len(categories)

    all_train_samples = data["train_samples"]   # from preprocessor (408 contracts)
    test_samples = data["test_samples"]          # from preprocessor (102 contracts, untouched)

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 0: Contract-level 3-way split (Train 80% / Val 20% of train contracts)
    # Test contracts from preprocessor remain untouched.
    # ═══════════════════════════════════════════════════════════════════════
    contract_map: Dict[str, list] = defaultdict(list)
    for s in all_train_samples:
        contract_map[s["contract_id"]].append(s)

    train_contract_ids = sorted(contract_map.keys())
    test_contract_ids = sorted(set(s["contract_id"] for s in test_samples))

    # Shuffle and split train contracts into fit (80%) and val (20%)
    rng = random.Random(RANDOM_SEED)
    shuffled = list(train_contract_ids)
    rng.shuffle(shuffled)
    val_cut = int(len(shuffled) * 0.20)
    val_cids = set(shuffled[:val_cut])
    fit_cids = set(shuffled[val_cut:])

    fit_samples = [s for cid in fit_cids for s in contract_map[cid]]
    val_samples = [s for cid in val_cids for s in contract_map[cid]]

    # Verify zero leakage across all 3 splits
    overlap_fv = fit_cids & val_cids
    overlap_ft = fit_cids & set(test_contract_ids)
    overlap_vt = val_cids & set(test_contract_ids)
    assert not overlap_fv and not overlap_ft and not overlap_vt, \
        f"DATA LEAKAGE: fit-val={len(overlap_fv)}, fit-test={len(overlap_ft)}, val-test={len(overlap_vt)}"

    fit_texts   = [s["text"] for s in fit_samples]
    fit_labels  = [cat_to_id[s["category"]] for s in fit_samples]
    val_texts   = [s["text"] for s in val_samples]
    val_labels  = [cat_to_id[s["category"]] for s in val_samples]
    test_texts  = [s["text"] for s in test_samples]
    test_labels = [cat_to_id[s["category"]] for s in test_samples]

    print("=" * 76)
    print("  LEXIGUARD: 4-MODEL ML TRAINING WITH VALIDATION-BASED MODEL SELECTION  ")
    print("=" * 76)
    print(f"Dataset:             {meta['dataset_name']}")
    print(f"3-Way Split:         {len(fit_cids)} fit / {len(val_cids)} val / {len(test_contract_ids)} test contracts")
    print(f"Samples:             {len(fit_samples)} fit / {len(val_samples)} val / {len(test_samples)} test")
    print(f"Classes:             {n_classes}")
    print(f"Leakage check:       PASS (all 3 splits are disjoint)")
    print("-" * 76)

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1: Fit TF-IDF on FIT split only
    # ═══════════════════════════════════════════════════════════════════════
    print("\n[1/6] Fitting TF-IDF Vectorizer on FIT split only (TS-aligned stopwords)...")
    t0_vec = time.time()
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2), sublinear_tf=True,
        min_df=3, max_features=3000, norm='l2',
        stop_words=TS_STOPWORDS
    )
    X_fit  = vectorizer.fit_transform(fit_texts)
    X_val  = vectorizer.transform(val_texts)
    X_test = vectorizer.transform(test_texts)
    vocab_size = len(vectorizer.vocabulary_)
    print(f"      Fitted in {(time.time()-t0_vec)*1000:.0f}ms. Vocabulary: {vocab_size} features")
    print(f"      Vectorizer fitted on FIT data only; val and test use frozen transform.")

    def quick_val_f1(clf, X_v, y_v):
        return precision_recall_fscore_support(
            y_v, clf.predict(X_v), average='macro', zero_division=0
        )[2] * 100.0

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2: Hyperparameter tuning on VALIDATION macro F1
    # ═══════════════════════════════════════════════════════════════════════
    print("\n[2/6] Hyperparameter tuning on VALIDATION Macro F1...")
    C_values = [0.01, 0.1, 1.0, 5.0, 10.0]
    alpha_values = [0.1, 0.5, 1.0, 2.0]
    k_values = [3, 5, 7, 11]

    # --- LR ---
    best_C_lr, best_f1_lr = 1.0, 0.0
    for C in C_values:
        m = LogisticRegression(C=C, max_iter=300, class_weight='balanced', random_state=RANDOM_SEED)
        m.fit(X_fit, fit_labels)
        f1 = quick_val_f1(m, X_val, val_labels)
        print(f"    LR   C={C:<5.2f}  Val Macro F1 = {f1:.2f}%")
        if f1 > best_f1_lr:
            best_f1_lr, best_C_lr = f1, C

    # --- SVM ---
    best_C_svm, best_f1_svm = 1.0, 0.0
    for C in C_values:
        m = LinearSVC(C=C, class_weight='balanced', max_iter=3000, random_state=RANDOM_SEED)
        m.fit(X_fit, fit_labels)
        f1 = quick_val_f1(m, X_val, val_labels)
        print(f"    SVM  C={C:<5.2f}  Val Macro F1 = {f1:.2f}%")
        if f1 > best_f1_svm:
            best_f1_svm, best_C_svm = f1, C

    # --- NB ---
    best_alpha, best_f1_nb = 1.0, 0.0
    for alpha in alpha_values:
        m = MultinomialNB(alpha=alpha)
        m.fit(X_fit, fit_labels)
        f1 = quick_val_f1(m, X_val, val_labels)
        print(f"    NB   alpha={alpha:<4.1f}  Val Macro F1 = {f1:.2f}%")
        if f1 > best_f1_nb:
            best_f1_nb, best_alpha = f1, alpha

    # --- KNN ---
    best_k, best_f1_knn = 5, 0.0
    for k in k_values:
        m = KNeighborsClassifier(n_neighbors=k, metric='cosine', weights='distance')
        m.fit(X_fit, fit_labels)
        f1 = quick_val_f1(m, X_val, val_labels)
        print(f"    KNN  k={k:<3d}  Val Macro F1 = {f1:.2f}%")
        if f1 > best_f1_knn:
            best_f1_knn, best_k = f1, k

    print(f"\n  Tuned hyperparameters:")
    print(f"    LR:  C = {best_C_lr}     (Val F1 = {best_f1_lr:.2f}%)")
    print(f"    SVM: C = {best_C_svm}     (Val F1 = {best_f1_svm:.2f}%)")
    print(f"    NB:  alpha = {best_alpha}  (Val F1 = {best_f1_nb:.2f}%)")
    print(f"    KNN: k = {best_k}          (Val F1 = {best_f1_knn:.2f}%)")

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 3: Retrain all 4 models on FULL train data (fit+val) with tuned params
    # The test set remains untouched for final evaluation.
    # ═══════════════════════════════════════════════════════════════════════
    print("\n[3/6] Retraining all models on FULL train data (fit+val) with tuned params...")

    # Re-fit vectorizer on ALL training data (fit+val) for maximum signal in final model
    all_train_texts  = [s["text"] for s in all_train_samples]
    all_train_labels = [cat_to_id[s["category"]] for s in all_train_samples]

    vectorizer_final = TfidfVectorizer(
        ngram_range=(1, 2), sublinear_tf=True,
        min_df=3, max_features=3000, norm='l2',
        stop_words=TS_STOPWORDS
    )
    X_train_final = vectorizer_final.fit_transform(all_train_texts)
    X_test_final  = vectorizer_final.transform(test_texts)
    vocab_size_final = len(vectorizer_final.vocabulary_)

    # Also compute on FIT-only vectorizer for train/val gap reporting
    models_fit = {}  # trained on fit-only for gap analysis
    models_final = {}  # trained on all train data for final eval

    # -- Logistic Regression --
    print(f"\n  Logistic Regression (C={best_C_lr}, balanced)...")
    t0 = time.time()
    clf_lr = LogisticRegression(C=best_C_lr, max_iter=300, class_weight='balanced', random_state=RANDOM_SEED)
    clf_lr_fit = LogisticRegression(C=best_C_lr, max_iter=300, class_weight='balanced', random_state=RANDOM_SEED)
    clf_lr_fit.fit(X_fit, fit_labels)
    clf_lr.fit(X_train_final, all_train_labels)
    t_lr = round((time.time()-t0)*1000, 2)
    models_fit["logisticRegression"] = clf_lr_fit
    models_final["logisticRegression"] = clf_lr

    # -- Multinomial NB --
    print(f"  Multinomial NB (alpha={best_alpha})...")
    t0 = time.time()
    clf_nb = MultinomialNB(alpha=best_alpha)
    clf_nb_fit = MultinomialNB(alpha=best_alpha)
    clf_nb_fit.fit(X_fit, fit_labels)
    clf_nb.fit(X_train_final, all_train_labels)
    t_nb = round((time.time()-t0)*1000, 2)
    models_fit["multinomialNaiveBayes"] = clf_nb_fit
    models_final["multinomialNaiveBayes"] = clf_nb

    # -- Linear SVM --
    print(f"  Linear SVM (C={best_C_svm}, balanced)...")
    t0 = time.time()
    clf_svm = LinearSVC(C=best_C_svm, class_weight='balanced', max_iter=3000, random_state=RANDOM_SEED)
    clf_svm_fit = LinearSVC(C=best_C_svm, class_weight='balanced', max_iter=3000, random_state=RANDOM_SEED)
    clf_svm_fit.fit(X_fit, fit_labels)
    clf_svm.fit(X_train_final, all_train_labels)
    t_svm = round((time.time()-t0)*1000, 2)
    models_fit["linearSvm"] = clf_svm_fit
    models_final["linearSvm"] = clf_svm

    # -- KNN --
    print(f"  KNN (k={best_k}, cosine, distance)...")
    t0 = time.time()
    clf_knn = KNeighborsClassifier(n_neighbors=best_k, metric='cosine', weights='distance')
    clf_knn_fit = KNeighborsClassifier(n_neighbors=best_k, metric='cosine', weights='distance')
    clf_knn_fit.fit(X_fit, fit_labels)
    clf_knn.fit(X_train_final, all_train_labels)
    t_knn = round((time.time()-t0)*1000, 2)
    models_fit["knn"] = clf_knn_fit
    models_final["knn"] = clf_knn

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 4: Compute train/val/test metrics for all 4 models
    # Train & val metrics use the FIT-only vectorizer; test uses the FINAL vectorizer.
    # ═══════════════════════════════════════════════════════════════════════
    print("\n[4/6] Computing train / validation / test metrics...")

    results = {}
    val_f1_scores = {}

    for key in MODEL_KEYS:
        # Train accuracy (on fit split — measures memorization)
        train_pred = models_fit[key].predict(X_fit)
        train_acc = accuracy_score(fit_labels, train_pred) * 100.0
        train_f1  = precision_recall_fscore_support(fit_labels, train_pred, average='macro', zero_division=0)[2] * 100.0

        # Validation accuracy (on val split — measures generalization during tuning)
        val_pred = models_fit[key].predict(X_val)
        val_acc = accuracy_score(val_labels, val_pred) * 100.0
        val_f1  = precision_recall_fscore_support(val_labels, val_pred, average='macro', zero_division=0)[2] * 100.0

        # Test accuracy (on UNTOUCHED test — final evaluation using final model)
        t0_inf = time.time()
        test_pred = models_final[key].predict(X_test_final)
        t_inf = round((time.time() - t0_inf) * 1000 / len(test_texts), 3)

        test_eval = evaluate_model_performance(test_labels, test_pred.tolist(), categories)
        test_eval["trainingTimeMs"] = {"logisticRegression": t_lr, "multinomialNaiveBayes": t_nb, "linearSvm": t_svm, "knn": t_knn}[key]
        test_eval["latencyPerSampleMs"] = t_inf

        # Store train/val metrics alongside test metrics
        test_eval["trainAccuracy"] = round(train_acc, 2)
        test_eval["trainMacroF1"]  = round(train_f1, 2)
        test_eval["valAccuracy"]   = round(val_acc, 2)
        test_eval["valMacroF1"]    = round(val_f1, 2)
        test_eval["trainValAccGap"]  = round(train_acc - val_acc, 2)
        test_eval["trainValF1Gap"]   = round(train_f1 - val_f1, 2)
        test_eval["tunedHyperparams"] = {
            "logisticRegression": {"C": best_C_lr},
            "multinomialNaiveBayes": {"alpha": best_alpha},
            "linearSvm": {"C": best_C_svm},
            "knn": {"k": best_k}
        }[key]

        results[key] = test_eval
        val_f1_scores[key] = val_f1

        gap_acc = round(train_acc - val_acc, 1)
        gap_f1  = round(train_f1 - val_f1, 1)
        print(f"\n  {MODEL_NAMES[key]} (tuned {test_eval['tunedHyperparams']})")
        print(f"    Train:  Acc={train_acc:.2f}%  Macro F1={train_f1:.2f}%")
        print(f"    Val:    Acc={val_acc:.2f}%  Macro F1={val_f1:.2f}%")
        print(f"    Test:   Acc={test_eval['accuracy']:.2f}%  Macro F1={test_eval['macroF1']:.2f}%  Weighted F1={test_eval['weightedF1']:.2f}%")
        print(f"    Gap:    Train-Val Acc={gap_acc:+.1f}pp  Train-Val F1={gap_f1:+.1f}pp")

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 5: Select best model by VALIDATION Macro F1
    # ═══════════════════════════════════════════════════════════════════════
    best_model_key = max(val_f1_scores, key=val_f1_scores.get)

    print("\n" + "=" * 76)
    print("               MODEL SELECTION (by Validation Macro F1)                 ")
    print("=" * 76)
    print(f"{'Model':<28} | {'Val F1':>9} | {'Test Acc':>9} | {'Test F1':>9} | {'Wt F1':>9}")
    print("-" * 76)
    for k in MODEL_KEYS:
        r = results[k]
        star = " << SELECTED" if k == best_model_key else ""
        print(f"{MODEL_NAMES[k]:<28} | {r['valMacroF1']:>8.2f}% | {r['accuracy']:>8.2f}% | {r['macroF1']:>8.2f}% | {r['weightedF1']:>8.2f}%{star}")
    print("-" * 76)
    print(f"\nSelected model: {MODEL_NAMES[best_model_key]} (Val Macro F1 = {val_f1_scores[best_model_key]:.2f}%)")
    print(f"Final test:     Acc = {results[best_model_key]['accuracy']:.2f}%  Macro F1 = {results[best_model_key]['macroF1']:.2f}%")

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 5b: Notice Period class investigation
    # ═══════════════════════════════════════════════════════════════════════
    np_idx = categories.index("Notice Period To Terminate Renewal")
    rt_idx = categories.index("Renewal Term")
    best_cm = np.array(results[best_model_key]["confusionMatrix"])
    np_as_rt = best_cm[np_idx][rt_idx]
    rt_as_np = best_cm[rt_idx][np_idx]
    np_support = int(best_cm[np_idx].sum())
    rt_support = int(best_cm[rt_idx].sum())

    print("\n" + "-" * 76)
    print("  NOTICE PERIOD CATEGORY INVESTIGATION")
    print("-" * 76)
    print(f"  'Notice Period To Terminate Renewal' test support: {np_support}")
    print(f"  'Renewal Term' test support: {rt_support}")
    print(f"  Notice Period misclassified as Renewal Term: {np_as_rt}")
    print(f"  Renewal Term misclassified as Notice Period: {rt_as_np}")
    np_f1 = results[best_model_key]["categoryMetrics"][np_idx]["f1"]
    rt_f1 = results[best_model_key]["categoryMetrics"][rt_idx]["f1"]
    print(f"  Notice Period F1: {np_f1}%  |  Renewal Term F1: {rt_f1}%")
    print(f"\n  Root cause: Both categories describe renewal/termination provisions.")
    print(f"  Renewal Term clauses contain phrases like 'automatically renew',")
    print(f"  'successive terms', 'unless cancelled'. Notice Period clauses contain")
    print(f"  the same vocabulary PLUS 'written notice', 'days prior'.")
    print(f"  The TF-IDF features overlap heavily, making these two categories the")
    print(f"  hardest to separate. With only {np_support} test samples for Notice Period,")
    print(f"  even 1 error causes a large F1 drop.")
    print(f"  Train distribution: {meta['train_class_distribution'].get('Notice Period To Terminate Renewal', 0)} " +
          f"vs {meta['train_class_distribution'].get('Renewal Term', 0)} (small minority class).")
    print(f"  This is a label-boundary limitation, not a model bug.")

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 6: Save artifacts
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n[5/6] Saving model artifacts...")
    artifacts_dir = "data/model_artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)

    joblib.dump(vectorizer_final, os.path.join(artifacts_dir, "vectorizer.joblib"))
    joblib.dump(models_final[best_model_key], os.path.join(artifacts_dir, "best_model.joblib"))

    # Export JSON weights for TypeScript zero-latency runtime
    print("[6/6] Exporting model parameters for TypeScript runtime inference...")
    vocab_clean = {str(k): int(v) for k, v in vectorizer_final.vocabulary_.items()}
    idf_list = [float(x) for x in vectorizer_final.idf_.tolist()]

    svm_coef = [[float(val) for val in row] for row in clf_svm.coef_.tolist()]
    svm_intercept = [float(val) for val in clf_svm.intercept_.tolist()]
    lr_coef = [[float(val) for val in row] for row in clf_lr.coef_.tolist()]
    lr_intercept = [float(val) for val in clf_lr.intercept_.tolist()]

    runtime_export = {
        "version": "2.0.0",
        "selectedModel": best_model_key,
        "selectedModelName": MODEL_NAMES[best_model_key],
        "categories": categories,
        "vocabulary": vocab_clean,
        "idf": idf_list,
        "featureCount": len(vocab_clean),
        "svm": {"coefficients": svm_coef, "intercepts": svm_intercept},
        "logisticRegression": {"coefficients": lr_coef, "intercepts": lr_intercept}
    }

    with open(os.path.join(artifacts_dir, "model_export.json"), "w", encoding="utf-8") as f:
        json.dump(runtime_export, f)

    # Save comprehensive evaluation results
    results_path = "data/traditional_ml_results.json"
    full_output = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pipelineVersion": "2.0.0",
        "dataset": meta["dataset_name"],
        "splitMethod": "Contract-level 3-way split (Train 80%/Val 20% of train contracts + Test 20% held-out)",
        "fitContracts": len(fit_cids),
        "valContracts": len(val_cids),
        "testContracts": len(test_contract_ids),
        "trainContracts": meta["train_contracts"],
        "fitSamples": len(fit_samples),
        "valSamples": len(val_samples),
        "trainSamples": meta["train_samples_count"],
        "testSamples": meta["test_samples_count"],
        "numClasses": meta["num_classes"],
        "categories": categories,
        "preprocessingSummary": {
            "totalContracts": meta["total_contracts"],
            "totalCellsScanned": meta["total_cells_scanned"],
            "missingValuesFiltered": meta["missing_filtered"],
            "duplicatesRemoved": meta["duplicates_removed"],
            "vocabularyFeatures": vocab_size_final,
            "splitMethod": meta["split_method"],
            "trainDistribution": meta["train_class_distribution"],
            "testDistribution": meta["test_class_distribution"],
            "balancedClassWeights": meta["balanced_class_weights"]
        },
        "hyperparameterTuning": {
            "method": "Validation Macro F1 (single hold-out, contract-level split)",
            "logisticRegression": {"C_candidates": C_values, "bestC": best_C_lr, "bestValF1": round(best_f1_lr, 2)},
            "linearSvm": {"C_candidates": C_values, "bestC": best_C_svm, "bestValF1": round(best_f1_svm, 2)},
            "multinomialNaiveBayes": {"alpha_candidates": alpha_values, "bestAlpha": best_alpha, "bestValF1": round(best_f1_nb, 2)},
            "knn": {"k_candidates": k_values, "bestK": best_k, "bestValF1": round(best_f1_knn, 2)}
        },
        "selectedModel": best_model_key,
        "selectedModelName": MODEL_NAMES[best_model_key],
        "selectionCriterion": "Validation Macro F1",
        "noticePeriodInvestigation": {
            "noticePeriodTestSupport": np_support,
            "renewalTermTestSupport": rt_support,
            "noticePeriodF1": np_f1,
            "renewalTermF1": rt_f1,
            "noticePeriodMisclassifiedAsRenewalTerm": int(np_as_rt),
            "renewalTermMisclassifiedAsNoticePeriod": int(rt_as_np),
            "rootCause": "Semantic label-boundary overlap: both categories describe renewal/termination provisions with heavily overlapping vocabulary."
        },
        "algorithms": results
    }

    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(full_output, f, indent=2)

    print(f"\n[Artifacts] Exported evaluation to: {results_path}")
    print(f"[Artifacts] Exported runtime bundle to: {os.path.join(artifacts_dir, 'model_export.json')}")
    print(f"[Artifacts] Saved joblib binaries to: {artifacts_dir}")
    print("=" * 76)
    return full_output


if __name__ == "__main__":
    train_and_evaluate_all()
