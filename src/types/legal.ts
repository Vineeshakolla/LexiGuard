export type RiskLevel =
  | 'High Risk'
  | 'Medium Risk'
  | 'Low Risk'
  | 'Not Enough Information'
  | 'Critical'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'critical'
  | 'high'
  | 'moderate'
  | 'low';

export interface AffectedAspects {
  rights?: string;
  money?: string;
  data?: string;
  flexibility?: string;
}

export interface MissingOrUnclearClause {
  id: string;
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  status: 'Not found in the provided text' | 'Vague or ambiguous in document';
  description: string;
  potentialRisk: string;
  suggestedAddition: string;
}

export interface LegalClause {
  id: string;
  clauseNumber: number;
  title: string;
  category: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100

  // 1. What does it say?
  whatDoesItSay?: string;
  exactQuotation: string; // Exact supporting text quoted from uploaded document
  originalText?: string; // Backwards compatible alias for exactQuotation

  // 2. What does this mean in simple words?
  whatDoesThisMean?: string;
  plainEnglish: string;

  // 3. How could this affect you?
  howCouldThisAffectYou?: string;
  potentialConsequences?: string;

  // 4. Is there a potential risk?
  potentialRiskLabel?: 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Not Enough Information' | string;
  riskReason?: string;

  // 5. What should you do?
  whatShouldYouDo?: string;
  suggestedRevision: string;
  questionsForLawyer: string[];
  suggestedQuestions?: string[]; // Backwards compatible alias

  // 6. Example (Illustration)
  exampleIllustration?: string;

  sourceLocation: string;
  highlightedTerms?: string[];
  whatCompanyIsSaying?: string;
  everydayEnglish?: string;
  whatToCheck?: string;
  affectedAspects?: AffectedAspects;
  rightsAndObligations?: string;

  // Machine Learning Clause Classification (Separated from Risk Scoring)
  mlPredictedCategory?: string;
  mlConfidence?: number; // 0-100%
  mlModelUsed?: string;  // e.g. "Linear SVM (TF-IDF)"
  mlProbabilities?: Array<{ category: string; probability: number }>;
  mlTopFeatures?: string[];
}

export interface Recommendation {
  id: string;
  priority: number;
  riskLevel: RiskLevel;
  relatedClauseNumber: number;
  relatedClauseTitle: string;
  reasonForPrioritization: string;
  suggestedNextStep: string;
  negotiationTip?: string;
}

export interface DocumentSummaryInfo {
  contractType: string;
  primaryPurpose: string;
  partiesOrScope: string;
  executiveSummary: string;
  governingLawOrJurisdiction?: string;
  keyObligationsSummary?: string;

  // Simple and easy-to-understand summary sections
  whatIsThisAbout?: string;
  whatAreYouAgreeingTo?: string[];
  whatToPayAttentionTo?: string[];
  whatToDoBeforeSigning?: string[];
}

export interface ScoreBreakdown {
  formula: string;
  totalScoreSum: number;
  clauseCount: number;
  averageScore: number;
  highRiskContribution: { count: number; weight: number; points: number };
  mediumRiskContribution: { count: number; weight: number; points: number };
  lowRiskContribution: { count: number; weight: number; points: number };
  criticalRiskContribution?: { count: number; weight: number; points: number };
  escalationRuleTriggered?: string | null;
  contributingClauses: Array<{
    clauseNumber: number;
    title: string;
    riskLevel: string;
    riskScore: number;
    riskReason?: string;
    exactQuotation?: string;
  }>;
}

export interface OverallAssessment {
  overallScore: number; // 0-100
  riskLevel: 'Critical Risk' | 'High Risk' | 'Moderate Risk' | 'Low Risk' | string;
  riskLabel?: 'Critical Risk' | 'High Risk' | 'Moderate Risk' | 'Low Risk' | string;
  scoreExplanation: string;
  totalClauses: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  criticalRiskCount: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface CategorySummary {
  category: string;
  count: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  averageRisk: number;
}

export interface DocumentMeta {
  name: string;
  sizeBytes: number;
  formattedSize: string;
  type: string;
  wordCount: number;
  charCount: number;
  uploadedAt: string;
  inputSource?: 'file' | 'direct_text';
  contractTypeHint?: string;
}

export interface AokMatchedCategory {
  aokCategory: string;
  lexiCategory: string;
  prevalencePercent: number;
  sampleReference: string;
  sourceContract: string;
}

export interface AokBenchmarkInfo {
  datasetName: string;
  totalBenchmarkContracts: number;
  totalBenchmarkAnnotations: number;
  matchedCategories: AokMatchedCategory[];
}

export interface AokCategoryStat {
  category: string;
  lexiCategory: string;
  count: number;
  contractCount: number;
  prevalencePercent: number;
  description: string;
  riskNote: string;
}

export interface AokDatasetStatus {
  datasetName: string;
  version: string;
  status: string;
  filePath: string;
  fileExists: boolean;
  totalContracts: number;
  totalAnnotations: number;
  trainContractsCount: number;
  testContractsCount: number;
  categoriesCount: number;
  source: string;
  license: string;
  kaggleUrl: string;
  lastImportedAt: string | null;
  downloadInstructions: string;
}

export interface CategoryEvaluationMetric {
  category: string;
  lexiCategory: string;
  support: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  sampleReference: string;
}

export interface AokEvaluationReport {
  evaluationDate: string;
  datasetName: string;
  splitUsed: string;
  totalTestContracts: number;
  totalTestClauses: number;
  overallPrecision: number;
  overallRecall: number;
  overallF1: number;
  overallAccuracy: number;
  categoryMetrics: CategoryEvaluationMetric[];
  methodology: string;
  domainLimitations: string;
}

export interface AnalysisResult {
  id: string;
  documentMeta: DocumentMeta;
  documentSummary: DocumentSummaryInfo;
  overallAssessment: OverallAssessment;
  clauses: LegalClause[];
  categorySummaries?: CategorySummary[];
  missingOrUnclearClauses: MissingOrUnclearClause[];
  recommendations?: Recommendation[];
  aokBenchmark?: AokBenchmarkInfo;
  analyzedAt: string;
  isAiPowered: boolean;
  isDemonstration?: boolean;
  modelUsed?: string;
  statusMessage?: string;
}

export interface AnalysisHistoryItem {
  id: string;
  documentName: string;
  analyzedAt: string;
  riskScore: number;
  riskLevel: string;
  riskLabel?: string;
  flaggedClausesCount: number;
  totalClauses: number;
  contractType: string;
  inputSource?: 'file' | 'direct_text';
  result: AnalysisResult;
}

export interface MlCategoryMetric {
  category: string;
  support: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface MlModelMetrics {
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  weightedPrecision: number;
  weightedRecall: number;
  weightedF1: number;
  trainingTimeMs?: number;
  latencyPerSampleMs?: number;
  categoryMetrics: MlCategoryMetric[];
  confusionMatrix: number[][];
}

export interface MlEvaluationData {
  generatedAt: string;
  dataset: string;
  trainContracts: number;
  testContracts: number;
  trainSamples: number;
  testSamples: number;
  numClasses: number;
  categories: string[];
  selectedModel: string;
  selectedModelName: string;
  preprocessingSummary?: {
    totalContracts: number;
    totalCellsScanned: number;
    missingValuesFiltered: number;
    duplicatesRemoved: number;
    vocabularyFeatures: number;
    splitMethod: string;
    trainDistribution: Record<string, number>;
    testDistribution: Record<string, number>;
    balancedClassWeights: Record<string, number>;
  };
  algorithms: {
    linearSvm?: MlModelMetrics;
    logisticRegression?: MlModelMetrics;
    multinomialNaiveBayes?: MlModelMetrics;
    knn?: MlModelMetrics;
    [key: string]: MlModelMetrics | undefined;
  };
}

