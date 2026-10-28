#!/usr/bin/env python3
"""
LexiGuard Machine Learning Pipeline: Data Preprocessing
-------------------------------------------------------
Reproducible preprocessing for legal clause classification:
1. Ingests raw contracts from data/aok_dataset/master_clauses.csv
2. Handles missing values (filters empty lists, nulls, whitespace-only cells)
3. Detects and removes duplicate records
4. Normalizes text (case, unicode, punctuation, whitespace, stopwords)
5. Contract/Document-level train/test split to prevent data leakage
6. Computes class distribution and balanced class weights
7. Performs dataset validation and exports preprocessed dataset
"""

import os
import re
import csv
import json
import hashlib
from typing import Dict, List, Tuple, Any

# Target commercial clause categories for substantive legal classification
TARGET_CATEGORIES = [
    "Cap On Liability",
    "Governing Law",
    "Termination For Convenience",
    "Audit Rights",
    "Non-Compete",
    "Anti-Assignment",
    "Insurance",
    "License Grant",
    "Renewal Term",
    "Notice Period To Terminate Renewal",
    "Ip Ownership Assignment",
    "Liquidated Damages"
]

# Standard legal & English stop words for normalization
STOPWORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did',
    'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
    'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into',
    'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of',
    'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she',
    'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
    'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
    'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours'
}

def extract_quotes_from_cell(raw: str) -> List[str]:
    """Extract individual clause strings from Python stringified lists in CSV cells."""
    if not raw or raw in ('[]', "['']", '[""]', "None", "nan"):
        return []
    
    trimmed = raw.strip()
    if trimmed.startswith('[') and trimmed.endswith(']'):
        inner = trimmed[1:-1].strip()
        if not inner or inner in ("''", '""'):
            return []
        
        # Match single or double quoted strings
        pattern = r"['\"]([\s\S]*?)['\"](?:\s*,\s*|$)"
        matches = re.findall(pattern, inner)
        cleaned_quotes = []
        for m in matches:
            clean = m.replace('\\n', ' ').replace('\\\'', "'").replace('\\"', '"')
            clean = re.sub(r'\s+', ' ', clean).strip()
            if len(clean) >= 15:
                cleaned_quotes.append(clean)
        
        if cleaned_quotes:
            return cleaned_quotes
        
        # Fallback for unquoted/improperly escaped inner string
        fallback = re.sub(r"^['\"]|['\"]$", '', inner)
        fallback = re.sub(r'\s+', ' ', fallback).strip()
        return [fallback] if len(fallback) >= 15 else []
    
    clean_single = re.sub(r'\s+', ' ', trimmed).strip()
    return [clean_single] if len(clean_single) >= 15 else []

def normalize_text(text: str) -> str:
    """Normalize text: lowercase, remove special characters, collapse whitespace."""
    text_lower = text.lower()
    text_clean = re.sub(r'[^a-z0-9\s]', ' ', text_lower)
    text_norm = re.sub(r'\s+', ' ', text_clean).strip()
    return text_norm

def tokenize_text(text: str) -> List[str]:
    """Tokenize text into unigrams and bigrams, filtering stopwords and short tokens."""
    norm = normalize_text(text)
    words = [w for w in norm.split() if len(w) > 2 and w not in STOPWORDS]
    unigrams_and_bigrams = list(words)
    for i in range(len(words) - 1):
        unigrams_and_bigrams.append(f"{words[i]}_{words[i+1]}")
    return unigrams_and_bigrams

def run_preprocessing_pipeline(
    csv_path: str = "data/aok_dataset/master_clauses.csv",
    output_json_path: str = "data/preprocessed_dataset.json",
    test_split_ratio: float = 0.2,
    random_seed: int = 42
) -> Dict[str, Any]:
    """
    Executes the reproducible data preprocessing pipeline.
    Splits at the contract level to strictly prevent document leakage.
    """
    print(f"[Preprocessing] Ingesting legal clauses from: {csv_path}")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset CSV not found at {csv_path}")

    with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        header = next(reader)
        raw_rows = list(reader)

    print(f"[Preprocessing] Ingested {len(raw_rows)} contract records with {len(header)} columns.")

    # Map target category names to column indices
    cat_to_col = {}
    for c_idx, h in enumerate(header):
        h_clean = h.strip()
        if h_clean in TARGET_CATEGORIES:
            cat_to_col[h_clean] = c_idx

    missing_target_cols = [c for c in TARGET_CATEGORIES if c not in cat_to_col]
    if missing_target_cols:
        raise ValueError(f"Missing target category columns in dataset header: {missing_target_cols}")

    total_cells_scanned = 0
    missing_or_empty_cells = 0
    duplicate_records_found = 0
    seen_hashes = set()

    # Organize clauses contract by contract
    contracts = []
    category_counts_all = {cat: 0 for cat in TARGET_CATEGORIES}

    for r_idx, row in enumerate(raw_rows):
        filename = (row[0] if len(row) > 0 and row[0] else f"doc_{r_idx}").strip()
        contract_id = f"contract-{r_idx+1:04d}"
        contract_clauses = []

        for cat in TARGET_CATEGORIES:
            total_cells_scanned += 1
            col_idx = cat_to_col[cat]
            cell_val = row[col_idx] if col_idx < len(row) else ""
            quotes = extract_quotes_from_cell(cell_val)

            if not quotes:
                missing_or_empty_cells += 1
                continue

            for q in quotes:
                norm = normalize_text(q)
                # Deduplication check using MD5 of normalized text + category
                record_hash = hashlib.md5(f"{cat}:{norm}".encode('utf-8')).hexdigest()
                if record_hash in seen_hashes:
                    duplicate_records_found += 1
                    continue
                
                seen_hashes.add(record_hash)
                category_counts_all[cat] += 1
                contract_clauses.append({
                    "category": cat,
                    "raw_text": q,
                    "normalized_text": norm,
                    "word_count": len(q.split())
                })

        contracts.append({
            "contract_id": contract_id,
            "filename": filename,
            "clauses": contract_clauses
        })

    total_unique_clauses = sum(len(c["clauses"]) for c in contracts)
    print(f"[Preprocessing] Total contract-category cells scanned: {total_cells_scanned}")
    print(f"[Preprocessing] Missing / empty values filtered: {missing_or_empty_cells}")
    print(f"[Preprocessing] Duplicate clause instances removed: {duplicate_records_found}")
    print(f"[Preprocessing] Unique, validated legal clauses: {total_unique_clauses}")

    # Document-level splitting (80% train, 20% test by contract)
    # Using deterministic modular split (every 5th document is test => 20% test split)
    # Ensures zero data leakage between training and testing contract documents
    train_contracts = []
    test_contracts = []
    train_samples = []
    test_samples = []

    for idx, c in enumerate(contracts):
        is_test = (idx % int(1.0 / test_split_ratio) == 0)
        if is_test:
            test_contracts.append(c["contract_id"])
            for cl in c["clauses"]:
                test_samples.append({
                    "contract_id": c["contract_id"],
                    "filename": c["filename"],
                    "category": cl["category"],
                    "text": cl["raw_text"],
                    "normalized_text": cl["normalized_text"],
                    "tokens": tokenize_text(cl["raw_text"])
                })
        else:
            train_contracts.append(c["contract_id"])
            for cl in c["clauses"]:
                train_samples.append({
                    "contract_id": c["contract_id"],
                    "filename": c["filename"],
                    "category": cl["category"],
                    "text": cl["raw_text"],
                    "normalized_text": cl["normalized_text"],
                    "tokens": tokenize_text(cl["raw_text"])
                })

    # Compute class distribution & balanced weights for training set
    train_class_counts = {cat: 0 for cat in TARGET_CATEGORIES}
    for s in train_samples:
        train_class_counts[s["category"]] += 1

    test_class_counts = {cat: 0 for cat in TARGET_CATEGORIES}
    for s in test_samples:
        test_class_counts[s["category"]] += 1

    total_train = len(train_samples)
    n_classes = len(TARGET_CATEGORIES)
    class_weights = {}
    for cat in TARGET_CATEGORIES:
        count = max(1, train_class_counts[cat])
        # Standard balanced weight formula: n_samples / (n_classes * count)
        class_weights[cat] = round(total_train / (n_classes * count), 4)

    dataset_summary = {
        "pipeline_version": "1.0.0",
        "dataset_name": "Atticus Open Contract Dataset (AOK Beta / CUAD v1)",
        "source_file": csv_path,
        "total_contracts": len(contracts),
        "train_contracts": len(train_contracts),
        "test_contracts": len(test_contracts),
        "split_method": "Contract-level deterministic split (Zero Document Leakage)",
        "train_ratio": 1.0 - test_split_ratio,
        "test_ratio": test_split_ratio,
        "total_cells_scanned": total_cells_scanned,
        "missing_filtered": missing_or_empty_cells,
        "duplicates_removed": duplicate_records_found,
        "total_clean_samples": total_unique_clauses,
        "train_samples_count": len(train_samples),
        "test_samples_count": len(test_samples),
        "num_classes": n_classes,
        "categories": TARGET_CATEGORIES,
        "overall_class_distribution": category_counts_all,
        "train_class_distribution": train_class_counts,
        "test_class_distribution": test_class_counts,
        "balanced_class_weights": class_weights
    }

    # Save output dataset JSON
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump({
            "metadata": dataset_summary,
            "train_samples": train_samples,
            "test_samples": test_samples
        }, f, indent=2)

    print(f"[Preprocessing] Saved preprocessed dataset to: {output_json_path}")
    print(f"                Train contracts: {len(train_contracts)} ({len(train_samples)} clauses)")
    print(f"                Test contracts:  {len(test_contracts)} ({len(test_samples)} clauses)")
    return dataset_summary

if __name__ == "__main__":
    summary = run_preprocessing_pipeline()
    print("\nDataset Summary Metadata:")
    print(json.dumps(summary, indent=2))
