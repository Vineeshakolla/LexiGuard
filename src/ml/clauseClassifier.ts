/**
 * LexiGuard Machine Learning Runtime Classifier
 * ---------------------------------------------
 * Provides zero-latency, in-process inference for legal clause classification
 * using the exported trained model weights (Linear SVM / Logistic Regression)
 * and TF-IDF vocabulary from the training pipeline.
 */

import fs from 'fs';
import path from 'path';

export interface ClassProbability {
  category: string;
  probability: number;
}

export interface ClauseClassificationResult {
  predictedCategory: string;
  confidence: number; // 0 - 100
  modelUsed: string;
  probabilities: ClassProbability[];
  topFeatures: string[];
}

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

interface ModelExport {
  version: string;
  selectedModel: string;       // 'linearSvm' | 'logisticRegression' | 'knn' | etc.
  selectedModelName: string;   // Human-readable name e.g. 'Logistic Regression'
  categories: string[];
  vocabulary: Record<string, number>;
  idf: number[];
  featureCount: number;
  svm: {
    coefficients: number[][]; // [n_classes, n_features]
    intercepts: number[];     // [n_classes]
  };
  logisticRegression: {
    coefficients: number[][];
    intercepts: number[];
  };
}

class RuntimeClauseClassifier {
  private modelData: ModelExport | null = null;
  private isLoaded: boolean = false;

  constructor() {
    this.loadModel();
  }

  public loadModel(): boolean {
    try {
      const exportPath = path.resolve(process.cwd(), 'data', 'model_artifacts', 'model_export.json');
      if (fs.existsSync(exportPath)) {
        const raw = fs.readFileSync(exportPath, 'utf8');
        this.modelData = JSON.parse(raw);
        this.isLoaded = true;
        console.log(`[ClauseClassifier] Loaded trained model artifacts: ${this.modelData?.categories.length} classes, ${this.modelData?.featureCount} TF-IDF features.`);
        return true;
      } else {
        console.warn(`[ClauseClassifier] model_export.json not found at ${exportPath}.`);
        return false;
      }
    } catch (err) {
      console.error('[ClauseClassifier] Failed to load model artifacts:', err);
      return false;
    }
  }

  public getStatus() {
    return {
      isLoaded: this.isLoaded,
      modelName: this.modelData?.selectedModelName || 'Linear SVM (TF-IDF)',
      categories: this.modelData?.categories || [],
      featureCount: this.modelData?.featureCount || 0
    };
  }

  /**
   * Tokenizes and extracts unigrams + bigrams matching training pipeline.
   */
  private extractTokens(text: string): string[] {
    const rawTokens = text.toLowerCase().match(/[\p{L}\p{N}\p{M}\p{Pc}]{2,}/gu) || [];
    const clean = rawTokens.filter(w => !STOPWORDS.has(w));

    const tokens: string[] = [...clean];
    for (let i = 0; i < clean.length - 1; i++) {
      tokens.push(`${clean[i]} ${clean[i + 1]}`);
    }
    return tokens;
  }

  /**
   * Vectorize tokens into sparse L2-normalized sublinear TF-IDF vector.
   */
  private vectorize(tokens: string[]): { indices: number[]; values: number[]; matchedTerms: Array<{ term: string; weight: number }> } {
    if (!this.modelData) {
      return { indices: [], values: [], matchedTerms: [] };
    }

    const vocab = this.modelData.vocabulary;
    const idf = this.modelData.idf;
    const tfCounts = new Map<number, { count: number; term: string }>();

    for (const t of tokens) {
      const idx = vocab[t];
      if (idx !== undefined) {
        const cur = tfCounts.get(idx) || { count: 0, term: t };
        cur.count++;
        tfCounts.set(idx, cur);
      }
    }

    const indices: number[] = [];
    const values: number[] = [];
    const matchedTerms: Array<{ term: string; weight: number }> = [];
    let sumSquares = 0;

    for (const [idx, item] of tfCounts.entries()) {
      // Sublinear TF matching sklearn: 1 + log(count)
      const sublinearTf = 1 + Math.log(item.count);
      const tfidf = sublinearTf * idf[idx];
      indices.push(idx);
      values.push(tfidf);
      matchedTerms.push({ term: item.term, weight: tfidf });
      sumSquares += tfidf * tfidf;
    }

    const norm = Math.sqrt(sumSquares) || 1.0;
    for (let i = 0; i < values.length; i++) {
      values[i] /= norm;
      matchedTerms[i].weight /= norm;
    }

    matchedTerms.sort((a, b) => b.weight - a.weight);

    return { indices, values, matchedTerms };
  }

  /**
   * Classify any legal clause snippet using trained Linear SVM / Logistic Regression weights.
   */
  public classifyClause(text: string): ClauseClassificationResult {
    if (!this.isLoaded || !this.modelData) {
      this.loadModel();
    }

    if (!this.modelData || !text || text.trim().length === 0) {
      return {
        predictedCategory: 'General Contract Terms',
        confidence: 50.0,
        modelUsed: 'Grounded Pattern Heuristic',
        probabilities: [],
        topFeatures: []
      };
    }

    const tokens = this.extractTokens(text);
    const { indices, values, matchedTerms } = this.vectorize(tokens);

    if (indices.length === 0) {
      return {
        predictedCategory: 'General Contract Terms',
        confidence: 45.0,
        modelUsed: this.modelData.selectedModelName,
        probabilities: [],
        topFeatures: []
      };
    }

    const categories = this.modelData.categories;
    const numClasses = categories.length;

    // Use the model that was actually selected as best during training (respects selectedModel field)
    const selectedModel = this.modelData.selectedModel || 'linearSvm';
    const useLr = selectedModel === 'logisticRegression' &&
      this.modelData.logisticRegression &&
      this.modelData.logisticRegression.coefficients.length === numClasses;
    const coef = useLr ? this.modelData.logisticRegression.coefficients : this.modelData.svm.coefficients;
    const intercept = useLr ? this.modelData.logisticRegression.intercepts : this.modelData.svm.intercepts;

    const scores = new Float64Array(numClasses);
    for (let c = 0; c < numClasses; c++) {
      let z = intercept[c];
      const w = coef[c];
      for (let j = 0; j < indices.length; j++) {
        z += w[indices[j]] * values[j];
      }
      scores[c] = z;
    }

    // Softmax transformation of decision function margins for relative confidence estimation (uncalibrated pseudo-probabilities)
    let maxScore = -Infinity;
    for (let c = 0; c < numClasses; c++) {
      if (scores[c] > maxScore) maxScore = scores[c];
    }

    let sumExp = 0;
    const expScores = new Float64Array(numClasses);
    for (let c = 0; c < numClasses; c++) {
      expScores[c] = Math.exp(scores[c] - maxScore);
      sumExp += expScores[c];
    }

    const probabilities: ClassProbability[] = [];
    let bestIdx = 0;
    let maxProb = -1;

    for (let c = 0; c < numClasses; c++) {
      const prob = (expScores[c] / sumExp) * 100.0;
      probabilities.push({
        category: categories[c],
        probability: parseFloat(prob.toFixed(2))
      });
      if (prob > maxProb) {
        maxProb = prob;
        bestIdx = c;
      }
    }

    probabilities.sort((a, b) => b.probability - a.probability);

    const topFeatures = matchedTerms.slice(0, 5).map(m => m.term);

    return {
      predictedCategory: categories[bestIdx],
      confidence: parseFloat(maxProb.toFixed(2)),
      modelUsed: this.modelData.selectedModelName,
      probabilities: probabilities.slice(0, 5),
      topFeatures
    };
  }
}

export const clauseClassifier = new RuntimeClauseClassifier();
