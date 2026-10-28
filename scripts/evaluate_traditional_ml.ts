import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Standard English stopwords for text preprocessing
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did',
  'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of',
  'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours'
]);

interface ClauseRecord {
  contractId: string;
  contractFilename: string;
  category: string;
  rawText: string;
  tokens: string[];
}

// 1. Text extraction from Python stringified lists
function extractQuotesFromList(raw: string): string[] {
  if (!raw || raw === '[]' || raw === "['']") return [];
  const trimmed = raw.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner || inner === "''" || inner === '""') return [];

    const results: string[] = [];
    const quoteRegex = /['"]([\s\S]*?)['"](?:\s*,\s*|$)/g;
    let match;
    while ((match = quoteRegex.exec(inner)) !== null) {
      const clean = match[1]
        .replace(/\\n/g, ' ')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean.length > 5) results.push(clean);
    }
    if (results.length > 0) return results;

    const cleanFallback = inner.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
    return cleanFallback.length > 5 ? [cleanFallback] : [];
  }

  return trimmed.length > 5 ? [trimmed.replace(/\s+/g, ' ')] : [];
}

// 2. Tokenization and N-gram extraction
function tokenizeText(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));

  const unigramsAndBigrams: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    unigramsAndBigrams.push(`${words[i]}_${words[i + 1]}`);
  }
  return unigramsAndBigrams;
}

// 3. TF-IDF Vectorizer fitted STRICTLY on Training Set
class TfidfVectorizer {
  private vocab: Map<string, number> = new Map();
  private idf: Float64Array = new Float64Array(0);
  private maxFeatures: number;
  private minDf: number;

  constructor(maxFeatures: number = 2000, minDf: number = 3) {
    this.maxFeatures = maxFeatures;
    this.minDf = minDf;
  }

  public fit(trainTokensList: string[][]) {
    const docCount = trainTokensList.length;
    const docFreq: Map<string, number> = new Map();

    for (const tokens of trainTokensList) {
      const unique = new Set(tokens);
      for (const t of unique) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
    }

    // Filter by minDf and sort by document frequency
    const candidates: Array<{ token: string; df: number }> = [];
    for (const [token, df] of docFreq.entries()) {
      if (df >= this.minDf) {
        candidates.push({ token, df });
      }
    }

    candidates.sort((a, b) => b.df - a.df);
    const selected = candidates.slice(0, this.maxFeatures);

    this.vocab.clear();
    this.idf = new Float64Array(selected.length);

    selected.forEach((item, idx) => {
      this.vocab.set(item.token, idx);
      // Smooth IDF: ln((1 + N) / (1 + DF)) + 1
      this.idf[idx] = Math.log((1 + docCount) / (1 + item.df)) + 1.0;
    });

    console.log(`[Vectorizer] Fitted on training data: Vocabulary size = ${this.vocab.size} features`);
  }

  public transform(tokens: string[]): { indices: number[]; values: Float64Array; norm: number } {
    const tfMap: Map<number, number> = new Map();
    for (const t of tokens) {
      const idx = this.vocab.get(t);
      if (idx !== undefined) {
        tfMap.set(idx, (tfMap.get(idx) || 0) + 1);
      }
    }

    const indices: number[] = Array.from(tfMap.keys());
    const values = new Float64Array(indices.length);
    let sumSq = 0;

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const count = tfMap.get(idx)!;
      // Sublinear TF: 1 + log(count)
      const sublinearTf = 1 + Math.log(count);
      const tfidf = sublinearTf * this.idf[idx];
      values[i] = tfidf;
      sumSq += tfidf * tfidf;
    }

    const norm = Math.sqrt(sumSq) || 1.0;
    // Normalize to unit L2 norm
    for (let i = 0; i < values.length; i++) {
      values[i] /= norm;
    }

    return { indices, values, norm };
  }

  public getVocabSize(): number {
    return this.vocab.size;
  }
}

// Sparse vector representation
interface SparseVector {
  indices: number[];
  values: Float64Array;
}

function sparseDotProduct(a: SparseVector, b: SparseVector): number {
  let dot = 0;
  let i = 0;
  let j = 0;
  while (i < a.indices.length && j < b.indices.length) {
    if (a.indices[i] === b.indices[j]) {
      dot += a.values[i] * b.values[j];
      i++;
      j++;
    } else if (a.indices[i] < b.indices[j]) {
      i++;
    } else {
      j++;
    }
  }
  return dot;
}

// 4. K-Nearest Neighbors (KNN) Classifier
class KnnClassifier {
  private trainVectors: SparseVector[] = [];
  private trainLabels: number[] = [];
  private k: number;
  private numClasses: number;

  constructor(k: number = 5, numClasses: number) {
    this.k = k;
    this.numClasses = numClasses;
  }

  public fit(vectors: SparseVector[], labels: number[]) {
    this.trainVectors = vectors;
    this.trainLabels = labels;
  }

  public predict(testVector: SparseVector): number {
    // Compute cosine similarity (dot product of L2-normalized sparse vectors)
    const similarities: Array<{ sim: number; label: number }> = [];

    for (let i = 0; i < this.trainVectors.length; i++) {
      const sim = sparseDotProduct(testVector, this.trainVectors[i]);
      similarities.push({ sim, label: this.trainLabels[i] });
    }

    // Top k neighbors
    similarities.sort((a, b) => b.sim - a.sim);
    const topK = similarities.slice(0, this.k);

    // Similarity-weighted voting
    const classScores = new Float64Array(this.numClasses);
    for (const neighbor of topK) {
      classScores[neighbor.label] += Math.max(0.001, neighbor.sim);
    }

    let bestClass = 0;
    let maxScore = -1;
    for (let c = 0; c < this.numClasses; c++) {
      if (classScores[c] > maxScore) {
        maxScore = classScores[c];
        bestClass = c;
      }
    }
    return bestClass;
  }
}

// 5. Multinomial Naive Bayes (MNB)
class MultinomialNaiveBayes {
  private logPriors: Float64Array;
  private logConditionals: Float64Array[]; // [class][feature]
  private numClasses: number;
  private vocabSize: number;
  private alpha: number;

  constructor(numClasses: number, vocabSize: number, alpha: number = 1.0) {
    this.numClasses = numClasses;
    this.vocabSize = vocabSize;
    this.alpha = alpha;
    this.logPriors = new Float64Array(numClasses);
    this.logConditionals = Array.from({ length: numClasses }, () => new Float64Array(vocabSize));
  }

  public fit(vectors: SparseVector[], labels: number[]) {
    const classCounts = new Float64Array(this.numClasses);
    const featureCounts = Array.from({ length: this.numClasses }, () => new Float64Array(this.vocabSize));
    const totalWordsPerClass = new Float64Array(this.numClasses);

    for (let i = 0; i < vectors.length; i++) {
      const c = labels[i];
      classCounts[c]++;
      const vec = vectors[i];
      for (let j = 0; j < vec.indices.length; j++) {
        const featIdx = vec.indices[j];
        const val = vec.values[j];
        featureCounts[c][featIdx] += val;
        totalWordsPerClass[c] += val;
      }
    }

    const totalSamples = vectors.length;
    for (let c = 0; c < this.numClasses; c++) {
      this.logPriors[c] = Math.log((classCounts[c] + 1) / (totalSamples + this.numClasses));
      const denom = totalWordsPerClass[c] + this.alpha * this.vocabSize;
      for (let f = 0; f < this.vocabSize; f++) {
        const num = featureCounts[c][f] + this.alpha;
        this.logConditionals[c][f] = Math.log(num / denom);
      }
    }
  }

  public predict(testVector: SparseVector): number {
    let bestClass = 0;
    let maxLogProb = -Infinity;

    for (let c = 0; c < this.numClasses; c++) {
      let logProb = this.logPriors[c];
      for (let i = 0; i < testVector.indices.length; i++) {
        const fIdx = testVector.indices[i];
        logProb += testVector.values[i] * this.logConditionals[c][fIdx];
      }
      if (logProb > maxLogProb) {
        maxLogProb = logProb;
        bestClass = c;
      }
    }

    return bestClass;
  }
}

// 6. Multi-class Logistic Regression (One-vs-Rest)
class LogisticRegressionOvR {
  private weights: Float64Array[]; // [class][feature]
  private biases: Float64Array;
  private numClasses: number;
  private vocabSize: number;

  constructor(numClasses: number, vocabSize: number) {
    this.numClasses = numClasses;
    this.vocabSize = vocabSize;
    this.weights = Array.from({ length: numClasses }, () => new Float64Array(vocabSize));
    this.biases = new Float64Array(numClasses);
  }

  public fit(vectors: SparseVector[], labels: number[], epochs: number = 60, lr: number = 0.8, lambda: number = 0.0001) {
    const N = vectors.length;

    // Compute class frequencies for class-balanced weighting
    const classCounts = new Float64Array(this.numClasses);
    for (let i = 0; i < N; i++) {
      classCounts[labels[i]]++;
    }

    for (let c = 0; c < this.numClasses; c++) {
      const w = this.weights[c];
      let b = 0;
      const nPos = Math.max(1, classCounts[c]);
      const nNeg = Math.max(1, N - nPos);
      const posWeight = N / (2.0 * nPos);
      const negWeight = N / (2.0 * nNeg);

      for (let epoch = 0; epoch < epochs; epoch++) {
        const gradW = new Float64Array(this.vocabSize);
        let gradB = 0;

        for (let i = 0; i < N; i++) {
          const vec = vectors[i];
          const isPos = (labels[i] === c);
          const y = isPos ? 1.0 : 0.0;
          const sampleWeight = isPos ? posWeight : negWeight;

          // Compute z = w^T x + b
          let z = b;
          for (let j = 0; j < vec.indices.length; j++) {
            z += w[vec.indices[j]] * vec.values[j];
          }

          const clampedZ = Math.max(-25, Math.min(25, z));
          const p = 1.0 / (1.0 + Math.exp(-clampedZ));
          const err = (p - y) * sampleWeight;

          gradB += err;
          for (let j = 0; j < vec.indices.length; j++) {
            gradW[vec.indices[j]] += err * vec.values[j];
          }
        }

        b -= (lr / N) * gradB;
        for (let f = 0; f < this.vocabSize; f++) {
          w[f] -= (lr / N) * (gradW[f] + lambda * w[f]);
        }
      }
      this.biases[c] = b;
    }
  }

  public predict(testVector: SparseVector): number {
    let bestClass = 0;
    let maxScore = -Infinity;

    for (let c = 0; c < this.numClasses; c++) {
      let z = this.biases[c];
      const w = this.weights[c];
      for (let j = 0; j < testVector.indices.length; j++) {
        z += w[testVector.indices[j]] * testVector.values[j];
      }
      if (z > maxScore) {
        maxScore = z;
        bestClass = c;
      }
    }

    return bestClass;
  }
}

// 6b. Linear Support Vector Machine (Linear SVM One-vs-Rest via SGD / Hinge Loss)
class LinearSvmClassifier {
  private weights: Float64Array[]; // [class][feature]
  private biases: Float64Array;
  private numClasses: number;
  private vocabSize: number;

  constructor(numClasses: number, vocabSize: number) {
    this.numClasses = numClasses;
    this.vocabSize = vocabSize;
    this.weights = Array.from({ length: numClasses }, () => new Float64Array(vocabSize));
    this.biases = new Float64Array(numClasses);
  }

  public fit(vectors: SparseVector[], labels: number[], epochs: number = 40, lr: number = 0.5, lambda: number = 0.0001) {
    const N = vectors.length;

    // Compute class frequencies for class-balanced weighting
    const classCounts = new Float64Array(this.numClasses);
    for (let i = 0; i < N; i++) {
      classCounts[labels[i]]++;
    }

    for (let c = 0; c < this.numClasses; c++) {
      const w = this.weights[c];
      let b = 0;
      const nPos = Math.max(1, classCounts[c]);
      const nNeg = Math.max(1, N - nPos);
      const posWeight = N / (2.0 * nPos);
      const negWeight = N / (2.0 * nNeg);

      for (let epoch = 1; epoch <= epochs; epoch++) {
        const currentEta = lr / (1.0 + lambda * epoch);

        for (let i = 0; i < N; i++) {
          const vec = vectors[i];
          const isPos = (labels[i] === c);
          const y = isPos ? 1.0 : -1.0;
          const sampleWeight = isPos ? posWeight : negWeight;

          // Compute score z = w^T x + b
          let z = b;
          for (let j = 0; j < vec.indices.length; j++) {
            z += w[vec.indices[j]] * vec.values[j];
          }

          // Hinge loss condition: 1 - y * z > 0
          if (y * z < 1.0) {
            // Subgradient update
            b += currentEta * y * sampleWeight * 0.01;
            for (let j = 0; j < vec.indices.length; j++) {
              const fIdx = vec.indices[j];
              w[fIdx] = (1.0 - currentEta * lambda) * w[fIdx] + currentEta * y * vec.values[j] * sampleWeight;
            }
          } else {
            // Regularization decay only
            for (let j = 0; j < vec.indices.length; j++) {
              const fIdx = vec.indices[j];
              w[fIdx] *= (1.0 - currentEta * lambda);
            }
          }
        }
      }
      this.biases[c] = b;
    }
  }

  public predict(testVector: SparseVector): number {
    let bestClass = 0;
    let maxScore = -Infinity;

    for (let c = 0; c < this.numClasses; c++) {
      let z = this.biases[c];
      const w = this.weights[c];
      for (let j = 0; j < testVector.indices.length; j++) {
        z += w[testVector.indices[j]] * testVector.values[j];
      }
      if (z > maxScore) {
        maxScore = z;
        bestClass = c;
      }
    }

    return bestClass;
  }
}

// 7. Metric calculation utilities
interface MetricsResult {
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  weightedPrecision: number;
  weightedRecall: number;
  weightedF1: number;
  categoryMetrics: Array<{
    category: string;
    support: number;
    tp: number;
    fp: number;
    fn: number;
    precision: number;
    recall: number;
    f1: number;
  }>;
  confusionMatrix: number[][];
}

function evaluatePredictions(trueLabels: number[], predLabels: number[], categories: string[]): MetricsResult {
  const numClasses = categories.length;
  const confusionMatrix: number[][] = Array.from({ length: numClasses }, () => new Array(numClasses).fill(0));

  for (let i = 0; i < trueLabels.length; i++) {
    confusionMatrix[trueLabels[i]][predLabels[i]]++;
  }

  let totalCorrect = 0;
  const categoryMetrics: MetricsResult['categoryMetrics'] = [];

  for (let c = 0; c < numClasses; c++) {
    const tp = confusionMatrix[c][c];
    totalCorrect += tp;

    let fp = 0;
    for (let r = 0; r < numClasses; r++) {
      if (r !== c) fp += confusionMatrix[r][c];
    }

    let fn = 0;
    for (let col = 0; col < numClasses; col++) {
      if (col !== c) fn += confusionMatrix[c][col];
    }

    const support = tp + fn;
    const prec = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
    const rec = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
    const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;

    categoryMetrics.push({
      category: categories[c],
      support,
      tp,
      fp,
      fn,
      precision: parseFloat(prec.toFixed(2)),
      recall: parseFloat(rec.toFixed(2)),
      f1: parseFloat(f1.toFixed(2))
    });
  }

  const accuracy = (totalCorrect / trueLabels.length) * 100;

  // Macro average (unweighted mean across classes)
  const macroPrecision = categoryMetrics.reduce((s, m) => s + m.precision, 0) / numClasses;
  const macroRecall = categoryMetrics.reduce((s, m) => s + m.recall, 0) / numClasses;
  const macroF1 = categoryMetrics.reduce((s, m) => s + m.f1, 0) / numClasses;

  // Weighted average (weighted by support of each class)
  const totalSupport = trueLabels.length;
  const weightedPrecision = categoryMetrics.reduce((s, m) => s + m.precision * m.support, 0) / totalSupport;
  const weightedRecall = categoryMetrics.reduce((s, m) => s + m.recall * m.support, 0) / totalSupport;
  const weightedF1 = categoryMetrics.reduce((s, m) => s + m.f1 * m.support, 0) / totalSupport;

  return {
    accuracy: parseFloat(accuracy.toFixed(2)),
    macroPrecision: parseFloat(macroPrecision.toFixed(2)),
    macroRecall: parseFloat(macroRecall.toFixed(2)),
    macroF1: parseFloat(macroF1.toFixed(2)),
    weightedPrecision: parseFloat(weightedPrecision.toFixed(2)),
    weightedRecall: parseFloat(weightedRecall.toFixed(2)),
    weightedF1: parseFloat(weightedF1.toFixed(2)),
    categoryMetrics,
    confusionMatrix
  };
}

// MAIN EXECUTION PIPELINE
async function runEvaluation() {
  console.log('======================================================================');
  console.log('   LEXIGUARD: TRADITIONAL MACHINE LEARNING EVALUATION PIPELINE       ');
  console.log('======================================================================');

  const datasetPath = path.resolve(process.cwd(), 'data', 'aok_dataset', 'master_clauses.csv');
  console.log(`[Dataset] Loading dataset from: ${datasetPath}`);

  if (!fs.existsSync(datasetPath)) {
    console.error(`ERROR: Dataset not found at ${datasetPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(datasetPath, 'utf8');
  const rawRows: string[][] = parse(fileContent, { skip_empty_lines: true, relax_column_count: true });

  const headers = rawRows[0];
  console.log(`[Dataset] Total rows in file: ${rawRows.length} (1 header + ${rawRows.length - 1} contracts)`);
  console.log(`[Dataset] Total columns: ${headers.length}`);

  // Identify category columns (excluding -Answer columns and Filename)
  const categoryCols: Array<{ name: string; idx: number }> = [];
  for (let c = 1; c < headers.length; c++) {
    const h = headers[c].trim();
    if (h.endsWith('-Answer') || h.endsWith('- Answer') || h === 'Filename') continue;
    categoryCols.push({ name: h, idx: c });
  }
  console.log(`[Dataset] Identified ${categoryCols.length} legal clause categories in header.`);

  // Focus evaluation on core substantive commercial clause categories with balanced representation
  const targetCategories = [
    'Cap On Liability',
    'Governing Law',
    'Termination For Convenience',
    'Audit Rights',
    'Non-Compete',
    'Anti-Assignment',
    'Insurance',
    'License Grant',
    'Renewal Term',
    'Notice Period To Terminate Renewal',
    'Ip Ownership Assignment',
    'Liquidated Damages'
  ];

  const catToIndex = new Map<string, number>();
  targetCategories.forEach((cat, idx) => catToIndex.set(cat, idx));

  // Extract all clauses by contract to ensure ZERO document data leakage
  const contracts: Array<{ filename: string; id: string; clauses: Array<{ category: string; text: string }> }> = [];

  let totalRawRecordsScanned = 0;
  let totalMissingOrEmptyQuotes = 0;
  let totalExtractedClauses = 0;

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const filename = (row[0] || `doc_${r}`).trim();
    const contractClauses: Array<{ category: string; text: string }> = [];

    for (const cat of categoryCols) {
      totalRawRecordsScanned++;
      if (!catToIndex.has(cat.name)) continue;

      const rawCell = row[cat.idx] || '';
      const quotes = extractQuotesFromList(rawCell);

      if (quotes.length === 0) {
        totalMissingOrEmptyQuotes++;
      } else {
        for (const q of quotes) {
          totalExtractedClauses++;
          contractClauses.push({ category: cat.name, text: q });
        }
      }
    }

    contracts.push({
      filename,
      id: `doc-${r}`,
      clauses: contractClauses
    });
  }

  console.log(`\n[Preprocessing Summary]`);
  console.log(`- Total contracts ingested: ${contracts.length}`);
  console.log(`- Total contract-category cells scanned: ${totalRawRecordsScanned}`);
  console.log(`- Total empty/missing cells skipped: ${totalMissingOrEmptyQuotes}`);
  console.log(`- Usable extracted legal clauses across target categories: ${totalExtractedClauses}`);

  // Document-Level Split: 80% train contracts (every 5th is test => 20% test split)
  const trainRecords: ClauseRecord[] = [];
  const testRecords: ClauseRecord[] = [];
  let trainContractCount = 0;
  let testContractCount = 0;

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
    const isTest = (i % 5 === 0); // Deterministic 80/20 document split

    if (isTest) {
      testContractCount++;
      for (const cl of contract.clauses) {
        testRecords.push({
          contractId: contract.id,
          contractFilename: contract.filename,
          category: cl.category,
          rawText: cl.text,
          tokens: tokenizeText(cl.text)
        });
      }
    } else {
      trainContractCount++;
      for (const cl of contract.clauses) {
        trainRecords.push({
          contractId: contract.id,
          contractFilename: contract.filename,
          category: cl.category,
          rawText: cl.text,
          tokens: tokenizeText(cl.text)
        });
      }
    }
  }

  console.log(`\n[Train/Test Split by Contract (Zero Data Leakage)]`);
  console.log(`- Training Contracts: ${trainContractCount} contracts (80.0%)`);
  console.log(`- Testing Contracts:  ${testContractCount} contracts (20.0%)`);
  console.log(`- Training Samples (Clauses): ${trainRecords.length}`);
  console.log(`- Testing Samples (Clauses):  ${testRecords.length}`);
  console.log(`- Number of Evaluated Categories: ${targetCategories.length}`);

  // Fit Vectorizer ONLY on training tokens
  const vectorizer = new TfidfVectorizer(2500, 3);
  vectorizer.fit(trainRecords.map(r => r.tokens));

  // Transform Training Vectors
  const trainVectors: SparseVector[] = trainRecords.map(r => vectorizer.transform(r.tokens));
  const trainLabels: number[] = trainRecords.map(r => catToIndex.get(r.category)!);

  // Transform Testing Vectors using FROZEN training vectorizer
  const testVectors: SparseVector[] = testRecords.map(r => vectorizer.transform(r.tokens));
  const testLabels: number[] = testRecords.map(r => catToIndex.get(r.category)!);

  console.log(`\n======================================================================`);
  console.log(`   TRAINING AND EVALUATING ALGORITHMS ON HELD-OUT TEST DATA           `);
  console.log(`======================================================================`);

  // 1. K-Nearest Neighbors (KNN, k=5)
  console.log(`\n[1/3] Running K-Nearest Neighbors (KNN, k=5, Cosine Distance)...`);
  const t0Knn = Date.now();
  const knn = new KnnClassifier(5, targetCategories.length);
  knn.fit(trainVectors, trainLabels);
  const knnPreds: number[] = testVectors.map(vec => knn.predict(vec));
  const knnMetrics = evaluatePredictions(testLabels, knnPreds, targetCategories);
  console.log(`      KNN completed in ${Date.now() - t0Knn}ms.`);

  // 2. Multinomial Naive Bayes (MNB)
  console.log(`\n[2/3] Running Multinomial Naive Bayes (Laplace smoothing alpha=1.0)...`);
  const t0Mnb = Date.now();
  const mnb = new MultinomialNaiveBayes(targetCategories.length, vectorizer.getVocabSize(), 1.0);
  mnb.fit(trainVectors, trainLabels);
  const mnbPreds: number[] = testVectors.map(vec => mnb.predict(vec));
  const mnbMetrics = evaluatePredictions(testLabels, mnbPreds, targetCategories);
  console.log(`      MNB completed in ${Date.now() - t0Mnb}ms.`);

  // 3. Multi-Class Logistic Regression (One-vs-Rest)
  console.log(`\n[3/4] Running Multi-Class Logistic Regression (OvR, L2 reg, 45 epochs)...`);
  const t0Lr = Date.now();
  const lr = new LogisticRegressionOvR(targetCategories.length, vectorizer.getVocabSize());
  lr.fit(trainVectors, trainLabels, 45, 0.6, 0.0005);
  const lrPreds: number[] = testVectors.map(vec => lr.predict(vec));
  const lrMetrics = evaluatePredictions(testLabels, lrPreds, targetCategories);
  console.log(`      Logistic Regression completed in ${Date.now() - t0Lr}ms.`);

  // 4. Linear Support Vector Machine (Linear SVM OvR)
  console.log(`\n[4/4] Running Linear Support Vector Machine (Linear SVM OvR)...`);
  const t0Svm = Date.now();
  const svm = new LinearSvmClassifier(targetCategories.length, vectorizer.getVocabSize());
  svm.fit(trainVectors, trainLabels, 40, 0.5, 0.0001);
  const svmPreds: number[] = testVectors.map(vec => svm.predict(vec));
  const svmMetrics = evaluatePredictions(testLabels, svmPreds, targetCategories);
  console.log(`      Linear SVM completed in ${Date.now() - t0Svm}ms.`);

  // PRINT RESULTS
  console.log(`\n======================================================================`);
  console.log(`                        ACTUAL EVALUATION RESULTS                     `);
  console.log(`======================================================================`);

  console.log(`\nSUMMARY TABLE (Macro-Averaged Precision, Recall, F1 & Overall Accuracy):`);
  console.log(`-----------------------------------------------------------------------------------------`);
  console.log(`| Algorithm               | Accuracy (%) | Precision (%) | Recall (%) | F1-score (%) |`);
  console.log(`|-------------------------|-------------:|--------------:|-----------:|-------------:|`);
  console.log(`| Linear SVM              |        ${svmMetrics.accuracy.toFixed(2)} |         ${svmMetrics.macroPrecision.toFixed(2)} |      ${svmMetrics.macroRecall.toFixed(2)} |        ${svmMetrics.macroF1.toFixed(2)} |`);
  console.log(`| Logistic Regression     |        ${lrMetrics.accuracy.toFixed(2)} |         ${lrMetrics.macroPrecision.toFixed(2)} |      ${lrMetrics.macroRecall.toFixed(2)} |        ${lrMetrics.macroF1.toFixed(2)} |`);
  console.log(`| Multinomial Naive Bayes |        ${mnbMetrics.accuracy.toFixed(2)} |         ${mnbMetrics.macroPrecision.toFixed(2)} |      ${mnbMetrics.macroRecall.toFixed(2)} |        ${mnbMetrics.macroF1.toFixed(2)} |`);
  console.log(`| KNN (k=5)               |        ${knnMetrics.accuracy.toFixed(2)} |         ${knnMetrics.macroPrecision.toFixed(2)} |      ${knnMetrics.macroRecall.toFixed(2)} |        ${knnMetrics.macroF1.toFixed(2)} |`);
  console.log(`-----------------------------------------------------------------------------------------`);

  console.log(`\nWEIGHTED-AVERAGED METRICS:`);
  console.log(`- Linear SVM:              Accuracy: ${svmMetrics.accuracy}% | Weighted Prec: ${svmMetrics.weightedPrecision}% | Weighted Rec: ${svmMetrics.weightedRecall}% | Weighted F1: ${svmMetrics.weightedF1}%`);
  console.log(`- Logistic Regression:     Accuracy: ${lrMetrics.accuracy}% | Weighted Prec: ${lrMetrics.weightedPrecision}% | Weighted Rec: ${lrMetrics.weightedRecall}% | Weighted F1: ${lrMetrics.weightedF1}%`);
  console.log(`- Multinomial Naive Bayes: Accuracy: ${mnbMetrics.accuracy}% | Weighted Prec: ${mnbMetrics.weightedPrecision}% | Weighted Rec: ${mnbMetrics.weightedRecall}% | Weighted F1: ${mnbMetrics.weightedF1}%`);
  console.log(`- KNN (k=5):               Accuracy: ${knnMetrics.accuracy}% | Weighted Prec: ${knnMetrics.weightedPrecision}% | Weighted Rec: ${knnMetrics.weightedRecall}% | Weighted F1: ${knnMetrics.weightedF1}%`);

  console.log(`\nPER-CATEGORY METRICS FOR LINEAR SVM:`);
  console.log(`-------------------------------------------------------------------------------------------`);
  console.log(`| Category                             | Support |  TP |  FP |  FN | Precision |  Recall |      F1 |`);
  console.log(`|--------------------------------------|--------:|----:|----:|----:|----------:|--------:|--------:|`);
  for (const cm of svmMetrics.categoryMetrics) {
    const padCat = cm.category.padEnd(36);
    console.log(`| ${padCat} |   ${String(cm.support).padStart(5)} | ${String(cm.tp).padStart(3)} | ${String(cm.fp).padStart(3)} | ${String(cm.fn).padStart(3)} |    ${cm.precision.toFixed(1).padStart(5)}% |  ${cm.recall.toFixed(1).padStart(5)}% |  ${cm.f1.toFixed(1).padStart(5)}% |`);
  }
  console.log(`-------------------------------------------------------------------------------------------`);

  console.log(`\nCONFUSION MATRIX (Linear SVM):`);
  console.log(`Rows = Ground Truth Classes, Columns = Predicted Classes`);
  console.log(`Indices: ` + targetCategories.map((c, i) => `[${i}] ${c}`).join(', '));
  console.log(``);
  for (let r = 0; r < targetCategories.length; r++) {
    const rowStr = svmMetrics.confusionMatrix[r].map(v => String(v).padStart(3)).join(' ');
    console.log(`Class [${String(r).padStart(2)}] (${targetCategories[r].slice(0, 16).padEnd(16)}): [ ${rowStr} ]`);
  }

  // Save results to JSON file for programmatic dashboard usage
  const outPath = path.resolve(process.cwd(), 'data', 'traditional_ml_results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    dataset: 'Atticus Open Contract Dataset (AOK Beta / CUAD v1)',
    trainContracts: trainContractCount,
    testContracts: testContractCount,
    trainSamples: trainRecords.length,
    testSamples: testRecords.length,
    numClasses: targetCategories.length,
    categories: targetCategories,
    selectedModel: 'linearSvm',
    selectedModelName: 'Linear SVM',
    algorithms: {
      linearSvm: svmMetrics,
      logisticRegression: lrMetrics,
      multinomialNaiveBayes: mnbMetrics,
      knn: knnMetrics
    }
  }, null, 2));

  console.log(`\n[Export] Full results written to ${outPath}`);
}

runEvaluation().catch(err => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});
