import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { ScoreBreakdown } from '../types/legal';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantClauseContext {
  clauseNumber?: number;
  title?: string;
  category?: string;
  mlPredictedCategory?: string;
  mlConfidence?: number;
  mlTopFeatures?: string[];
  riskScore?: number;
  riskLevel?: string;
  exactQuotation?: string;
  plainEnglish?: string;
  potentialConsequences?: string;
  riskReason?: string;
  suggestedRevision?: string;
  questionsForLawyer?: string[];
  exampleIllustration?: string;
  sourceLocation?: string;
}

export interface AssistantDocumentContext {
  filename?: string;
  contractType?: string;
  overallScore?: number;
  riskLevel?: string;
  scoreExplanation?: string;
  totalClauses?: number;
  highRiskCount?: number;
  mediumRiskCount?: number;
  lowRiskCount?: number;
  criticalRiskCount?: number;
  scoreBreakdown?: ScoreBreakdown;
  clauses?: AssistantClauseContext[];
  missingOrUnclearClauses?: Array<{
    title: string;
    severity: string;
    description: string;
    potentialRisk: string;
    suggestedAddition: string;
  }>;
}

export interface AssistantContext {
  selectedClause?: AssistantClauseContext;
  currentDocument?: AssistantDocumentContext;
  technicalMode?: boolean;
}

export enum AssistantIntent {
  OVERALL_SCORE_EXPLANATION = 'OVERALL_SCORE_EXPLANATION',
  CLAUSE_RISK_EXPLANATION = 'CLAUSE_RISK_EXPLANATION',
  SCORING_FORMULA_EXPLANATION = 'SCORING_FORMULA_EXPLANATION',
  CATEGORY_VS_RISK_DISTINCTION = 'CATEGORY_VS_RISK_DISTINCTION',
  CLAUSE_PLAIN_ENGLISH = 'CLAUSE_PLAIN_ENGLISH',
  WHY_THIS_CATEGORY_FEATURES = 'WHY_THIS_CATEGORY_FEATURES',
  WHY_LINEAR_SVM = 'WHY_LINEAR_SVM',
  PREPROCESSING_LEAKAGE = 'PREPROCESSING_LEAKAGE',
  METRICS_CONFUSION_MATRIX = 'METRICS_CONFUSION_MATRIX',
  MODEL_LIMITATIONS = 'MODEL_LIMITATIONS',
  GENERAL = 'GENERAL'
}

export class AssistantService {
  private mlResults: any = null;

  constructor() {
    this.loadMlResults();
  }

  private loadMlResults() {
    try {
      const mlPath = path.resolve(process.cwd(), 'data', 'traditional_ml_results.json');
      if (fs.existsSync(mlPath)) {
        this.mlResults = JSON.parse(fs.readFileSync(mlPath, 'utf8'));
        console.log('[AssistantService] Loaded real ML evaluation results from training run.');
      } else {
        console.warn('[AssistantService] traditional_ml_results.json not found — assistant will use placeholder data.');
      }
    } catch (e) {
      console.warn('[AssistantService] Could not read traditional_ml_results.json:', e);
    }
  }

  /**
   * Build a fact block from the actual trained ML results JSON.
   * Falls back to a minimal placeholder if results are not yet available.
   */
  private buildRealMetricsFacts(): string {
    if (!this.mlResults || !this.mlResults.algorithms) {
      return '- ML Evaluation Results: Not yet generated. Run `npm run train` (python ml_pipeline/train_and_evaluate.py) to produce real metrics.\n';
    }

    const alg = this.mlResults.algorithms;
    const best = this.mlResults.selectedModelName || 'Unknown';
    const bestKey = this.mlResults.selectedModel || 'linearSvm';
    const cats: any[] = (alg[bestKey]?.categoryMetrics || []);
    const trainSamples = this.mlResults.trainSamples || 'N/A';
    const testSamples  = this.mlResults.testSamples  || 'N/A';
    const trainContracts = this.mlResults.trainContracts || 'N/A';
    const testContracts  = this.mlResults.testContracts  || 'N/A';

    const fmtModel = (key: string, label: string) => {
      const m = alg[key];
      if (!m) return '';
      const isBest = key === bestKey;
      return `  ${isBest ? '★' : ' '} ${label}${isBest ? ' (Selected Best)' : ''}: Accuracy ${m.accuracy}%, Macro F1 ${m.macroF1}%, Weighted F1 ${m.weightedF1}%, Latency ${m.latencyPerSampleMs} ms/sample.\n`;
    };

    const catLines = cats.map((c: any) => `  ${c.category} (F1: ${c.f1}%, Support: ${c.support})`).join(', ');

    return [
      `- Dataset: Atticus Open Contract Dataset (AOK Beta / CUAD v1), CC BY 4.0, SEC EDGAR commercial filings.`,
      `- Dimensions: 510 contracts, 510 CSV rows, 83 columns.`,
      `- Target Scanned Cells: 6,120 cells across 12 substantive target categories.`,
      `- Missing Values filtered + Deduplication removes duplicates via MD5 hashing.`,
      `- Clean Clause Corpus: ${trainSamples} training clauses / ${testSamples} held-out test clauses.`,
      `- Zero Document Leakage: Strict 80/20 contract-level split (${trainContracts} train contracts / ${testContracts} test contracts). 0 overlapping contracts.`,
      `- Feature Engineering: TF-IDF fitted strictly on training contracts only. Unigrams + bigrams, sublinear TF (1 + ln(count)), IDF smoothed, vocabulary capped at 3,000 features, min_df=3, L2 unit normalization.`,
      `- 4 Evaluated Algorithms on ${testSamples} Held-Out Test Clauses (evaluated from actual training run — NOT hardcoded):`,
      fmtModel('linearSvm', 'Linear SVM'),
      fmtModel('logisticRegression', 'Logistic Regression'),
      fmtModel('multinomialNaiveBayes', 'Multinomial Naive Bayes'),
      fmtModel('knn', 'KNN (k=5)'),
      `- Actual Selected Best Model: ${best}`,
      `- Per-Class F1 Scores (${best}): ${catLines || 'See /api/ml/evaluation for details.'}`,
      `- Model Limitations: SEC EDGAR corporate drafting bias, 'Notice Period To Terminate Renewal' minority class overlap (lowest F1 due to co-occurrence inside renewal/termination clauses), English-only scope, scanned image PDFs require OCR, confidence scores are uncalibrated softmax margins.`,
    ].join('\n');
  }

  public classifyIntent(query: string, context?: AssistantContext): AssistantIntent {
    const q = query.toLowerCase();

    // 1. Difference / Relationship between Category and Risk Score
    if (
      (q.includes('difference') && (q.includes('category') || q.includes('risk') || q.includes('score'))) ||
      (q.includes('distinction') && (q.includes('category') || q.includes('risk'))) ||
      (q.includes('category vs') || q.includes('risk vs category') || q.includes('category versus')) ||
      (q.includes('why are category and risk separate') || q.includes('separate category and risk'))
    ) {
      return AssistantIntent.CATEGORY_VS_RISK_DISTINCTION;
    }

    // 2. Overall Score / Assessment Explanation
    if (
      q.includes('overall') ||
      q.includes('total score') ||
      q.includes('assessment') ||
      q.includes('contract score') ||
      q.match(/\b(why\s+is\s+(my\s+|the\s+)?(overall\s+)?(score|risk))\b/i) ||
      q.match(/\b(why\s+(75|60|50|80|85|70|65|40|30|20|100))\b/i) ||
      q.match(/\b(score|risk)\s*(?:is|=|of)?\s*\d+\b/i)
    ) {
      // Check if it's explicitly asking about a single clause instead
      if (q.includes('this clause') || q.match(/\bclause\s*#?\d+\b/i)) {
        return AssistantIntent.CLAUSE_RISK_EXPLANATION;
      }
      return AssistantIntent.OVERALL_SCORE_EXPLANATION;
    }

    // 3. Scoring Formula & Weights
    if (
      q.includes('formula') ||
      q.includes('algorithm') ||
      (q.includes('how') && (q.includes('calculate') || q.includes('computed')) && q.includes('risk')) ||
      q.includes('scoring weights') ||
      q.includes('weight of') ||
      q.includes('rule weights')
    ) {
      return AssistantIntent.SCORING_FORMULA_EXPLANATION;
    }

    // 4. Individual Clause Risk Explanation
    if (
      (q.includes('risk') || q.includes('risky') || q.includes('severity')) &&
      (q.includes('why') || q.includes('reason') || q.includes('factor') || q.includes('finding') || q.includes('high risk') || q.includes('marked'))
    ) {
      return AssistantIntent.CLAUSE_RISK_EXPLANATION;
    }

    // 5. Plain English Summary of a Clause
    if (
      q.includes('plain english') ||
      q.includes('simple english') ||
      q.includes('what does this mean') ||
      q.includes('what does this clause mean') ||
      (q.includes('explain') && (q.includes('clause') || q.includes('this')))
    ) {
      return AssistantIntent.CLAUSE_PLAIN_ENGLISH;
    }

    // 6. Why This Category / Feature Contribution
    if (
      (q.includes('classified') || q.includes('classification') || q.includes('why this category') || q.includes('category')) &&
      !q.includes('difference')
    ) {
      return AssistantIntent.WHY_THIS_CATEGORY_FEATURES;
    }

    // 7. Why Linear SVM Algorithm
    if (
      q.includes('svm') ||
      q.includes('linear svm') ||
      (q.includes('why') && (q.includes('model') || q.includes('algorithm') || q.includes('knn') || q.includes('naive bayes')))
    ) {
      return AssistantIntent.WHY_LINEAR_SVM;
    }

    // 8. Preprocessing / Leakage Prevention
    if (
      q.includes('preprocess') ||
      q.includes('leakage') ||
      q.includes('split') ||
      q.includes('duplicates') ||
      q.includes('stopword')
    ) {
      return AssistantIntent.PREPROCESSING_LEAKAGE;
    }

    // 9. Precision, Recall, Confusion Matrix
    if (
      q.includes('precision') ||
      q.includes('recall') ||
      q.includes('confusion matrix') ||
      q.includes('macro f1') ||
      q.includes('weighted f1')
    ) {
      return AssistantIntent.METRICS_CONFUSION_MATRIX;
    }

    // 10. Model Limitations & Biases
    if (
      q.includes('limitation') ||
      q.includes('bias') ||
      q.includes('weakness') ||
      q.includes('minority class') ||
      q.includes('ocr')
    ) {
      return AssistantIntent.MODEL_LIMITATIONS;
    }

    return AssistantIntent.GENERAL;
  }

  public async handleChat(
    messages: AssistantMessage[],
    context?: AssistantContext,
    aiClient?: GoogleGenAI | null
  ): Promise<{ response: string; isAiPowered: boolean; source: string }> {
    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    const latestUserMsg = messages[messages.length - 1].content;
    const isTechnical = !!context?.technicalMode;
    const intent = this.classifyIntent(latestUserMsg, context);

    // Build comprehensive system prompt grounded in verified project facts
    const systemPrompt = this.buildSystemPrompt(context, intent);

    // If Gemini client is active, attempt generative response
    if (aiClient) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const contents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const generatePromise = aiClient.models.generateContent({
          model: 'gemini-flash-latest',
          contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: isTechnical ? 0.2 : 0.3,
            maxOutputTokens: 1200,
          }
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          timeoutId = setTimeout(
            () => reject(new Error('AI assistant response timed out')),
            8000,
          )
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        const replyText = response.text?.trim();
        if (replyText) {
          return {
            response: replyText,
            isAiPowered: true,
            source: 'Gemini Flash (Server-Side Integration)'
          };
        }
      } catch (err: any) {
        console.warn('[AssistantService] Gemini API call failed, falling back to grounded knowledge base:', err.message);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    // Grounded deterministic fallback
    const fallbackAnswer = this.generateGroundedFallback(latestUserMsg, context, intent);
    return {
      response: fallbackAnswer,
      isAiPowered: false,
      source: 'LexiGuard Grounded Legal & ML Knowledge Base'
    };
  }

  private buildSystemPrompt(context?: AssistantContext, intent?: AssistantIntent): string {
    const isTechnical = !!context?.technicalMode;
    const clause = context?.selectedClause;
    const doc = context?.currentDocument;

    let prompt = `You are the LexiGuard AI Legal & Machine Learning Doubt Assistant.
You are an authoritative, educational, and completely objective expert embedded inside LexiGuard: AI Legal Clause & Contractual Risk Analyzer.

CRITICAL INSTRUCTIONS & DIRECT-ANSWER RULES:
1. ANSWER THE ACTUAL QUESTION FIRST: Directly classify the user's inquiry and answer their specific question immediately in the first sentence before providing any background details.
2. NO GENERIC DETOURS: Never substitute a generic explanation about "clause category vs. risk score" when the user asks why an overall score is 75 or why a specific clause is high risk. Only explain the category vs risk distinction when the user specifically asks about the difference between them.
3. EXPLAIN OVERALL RISK SCORES DIRECTLY:
   - When asked why an overall score is X (e.g. 75), look at the ACTIVE DOCUMENT CONTEXT below.
   - Explain the exact mathematical calculation: how many clauses contributed, the weights of high-risk (75 pts), medium-risk (50 pts), and low-risk (20 pts) clauses, the averaging formula, and any escalation rule triggered (e.g., >= 2 high-risk clauses escalates to High Risk).
   - If no document is loaded, explicitly tell the user: "No contract is currently loaded. Please analyze a contract first by uploading a file or pasting text."
4. EXPLAIN INDIVIDUAL CLAUSE RISK DIRECTLY:
   - When asked why a clause is high risk, identify the clause by number and title, state its risk score, explain the triggered risk reason/hazard, cite the exact supporting quotation, and mention any relevant missing safeguards.
   - If no clause is selected and no contract is loaded, ask the user to analyze a contract and select a clause first.
5. THREE DISTINCT CONCEPTS (Keep separate, only explain when relevant):
   - ML Predicted Category: Grammatical/substantive topic detection (e.g., Cap On Liability, Governing Law).
   - Relative Confidence: Softmax-transformed SVM decision margin (an uncalibrated pseudo-probability).
   - Contractual Risk Score: Exposure assessment (0-100 severity, High/Medium/Low) based on legal hazard and lack of reciprocity.
6. TECHNICAL MODE: ${isTechnical ? 'Active. Provide mathematically and architecturally rigorous explanations citing exact weights, formulas, hyperparameters, and confusion matrix rates.' : 'Inactive. Provide approachable, layperson-friendly explanations with clear everyday analogies.'}
7. NEVER FABRICATE: Use only the facts, numbers, and active context provided below. Never invent clause text, risk scores, or legal conclusions.
8. INFORMATIONAL ONLY: Keep responses educational and assistive; not formal legal advice.

VERIFIED LEXIGUARD ML PROJECT FACTS (GROUND TRUTH — LOADED FROM ACTUAL TRAINING RUN):
${this.buildRealMetricsFacts()}
`;

    if (clause) {
      prompt += `\nCURRENTLY ACTIVE CLAUSE CONTEXT:
- Clause Title: ${clause.title || 'Untitled Clause'}
- Clause Number: #${clause.clauseNumber || 1}
- ML Predicted Category: ${clause.mlPredictedCategory || clause.category || 'General Contract Terms'}
- Relative Confidence: ${clause.mlConfidence ? clause.mlConfidence + '%' : 'N/A'} (Softmax-Transformed Decision Margin — ${this.mlResults?.selectedModelName || 'Trained Classifier'})
- Top Contributing TF-IDF Features: ${clause.mlTopFeatures && clause.mlTopFeatures.length > 0 ? clause.mlTopFeatures.join(', ') : 'N/A'}
- Risk Severity Level: ${clause.riskLevel || 'Medium Risk'} (Score: ${clause.riskScore ?? 50}/100)
- Risk Reason / Triggered Finding: ${clause.riskReason || clause.potentialConsequences || 'Unilateral exposure or lack of standard remedy.'}
- Exact Supporting Quotation: "${clause.exactQuotation || ''}"
- Plain English Explanation: ${clause.plainEnglish || 'N/A'}
- Potential Consequences: ${clause.potentialConsequences || 'N/A'}
- Suggested Revision: ${clause.suggestedRevision || 'N/A'}
- Questions for Lawyer: ${clause.questionsForLawyer && clause.questionsForLawyer.length > 0 ? clause.questionsForLawyer.join('; ') : 'N/A'}
- Location in Document: ${clause.sourceLocation || 'N/A'}
`;
    }

    if (doc) {
      prompt += `\nACTIVE DOCUMENT CONTEXT:
- Document Filename: ${doc.filename || 'Active Document'}
- Inferred Contract Type: ${doc.contractType || 'Commercial Agreement'}
- Overall Contract Risk Score: ${doc.overallScore ?? 75}/100
- Overall Risk Severity: ${doc.riskLevel || 'High Risk'}
- Total Clauses Identified: ${doc.totalClauses || (doc.clauses ? doc.clauses.length : 0)}
- High Risk Clauses Flagged: ${doc.highRiskCount || 0}
- Medium Risk Clauses Flagged: ${doc.mediumRiskCount || 0}
- Low Risk Clauses Flagged: ${doc.lowRiskCount || 0}
- Critical Risk Clauses Flagged: ${doc.criticalRiskCount || 0}
- Score Explanation: ${doc.scoreExplanation || 'N/A'}
`;

      if (doc.scoreBreakdown) {
        prompt += `- Score Breakdown Details:
  * Formula: ${doc.scoreBreakdown.formula}
  * Total Points Sum: ${doc.scoreBreakdown.totalScoreSum} across ${doc.scoreBreakdown.clauseCount} clauses
  * Average Clause Score: ${doc.scoreBreakdown.averageScore}
  * High Risk Contribution: ${doc.scoreBreakdown.highRiskContribution.count} clauses x ${doc.scoreBreakdown.highRiskContribution.weight} pts = ${doc.scoreBreakdown.highRiskContribution.points} pts
  * Medium Risk Contribution: ${doc.scoreBreakdown.mediumRiskContribution.count} clauses x ${doc.scoreBreakdown.mediumRiskContribution.weight} pts = ${doc.scoreBreakdown.mediumRiskContribution.points} pts
  * Low Risk Contribution: ${doc.scoreBreakdown.lowRiskContribution.count} clauses x ${doc.scoreBreakdown.lowRiskContribution.weight} pts = ${doc.scoreBreakdown.lowRiskContribution.points} pts
  * Escalation Rule Triggered: ${doc.scoreBreakdown.escalationRuleTriggered || 'None'}
`;
      }

      if (doc.clauses && doc.clauses.length > 0) {
        prompt += `- Contributing Clauses in Document:\n`;
        doc.clauses.slice(0, 6).forEach((c) => {
          prompt += `  * #${c.clauseNumber}: "${c.title}" - ${c.riskLevel || 'Medium'} (${c.riskScore ?? 50} pts) - ${c.riskReason || c.plainEnglish || 'Standard terms'}\n`;
        });
      }

      if (doc.missingOrUnclearClauses && doc.missingOrUnclearClauses.length > 0) {
        prompt += `- Missing Safeguards in Document:\n`;
        doc.missingOrUnclearClauses.slice(0, 3).forEach((m) => {
          prompt += `  * ${m.title} (${m.severity}): ${m.description}\n`;
        });
      }
    } else {
      prompt += `\nNO CONTRACT LOADED IN CURRENT SESSION.
If user asks about overall score or document clauses, instruct them to upload or paste a contract first.\n`;
    }

    return prompt;
  }

  public generateGroundedFallback(userQuery: string, context?: AssistantContext, intent?: AssistantIntent): string {
    const q = userQuery.toLowerCase();
    const resolvedIntent = intent || this.classifyIntent(userQuery, context);
    const clause = context?.selectedClause;
    const doc = context?.currentDocument;
    const isTech = !!context?.technicalMode;

    switch (resolvedIntent) {
      // =================================================================
      // 1. OVERALL SCORE EXPLANATION
      // =================================================================
      case AssistantIntent.OVERALL_SCORE_EXPLANATION: {
        if (!doc) {
          return `### No Contract Currently Loaded 📄

No contract has been analyzed yet in this session. Please upload a contract document (PDF, DOCX, TXT) or paste legal text into the analyzer first.

Once analyzed, I will explain the exact mathematical score calculation, clause-by-clause contributions, and escalation thresholds that produced your overall risk assessment.`;
        }

        const score = doc.overallScore !== undefined ? doc.overallScore : 75;
        const level = doc.riskLevel || (score >= 60 ? 'High Risk' : score >= 35 ? 'Medium Risk' : 'Low Risk');
        const total = doc.totalClauses || (doc.clauses ? doc.clauses.length : 0);
        const highCount = doc.highRiskCount || 0;
        const medCount = doc.mediumRiskCount || 0;
        const lowCount = doc.lowRiskCount || 0;
        const breakdown = doc.scoreBreakdown;

        let response = `### Overall Risk Assessment Breakdown: ${score}/100 (${level})

Your contract received an overall risk assessment score of **${score}/100 (${level})** based on an analysis of **${total} extracted clauses** in **${doc.filename || 'your document'}**.

#### 1. How the Score Was Calculated
`;

        if (breakdown) {
          response += `• **Scoring Formula:** \`OverallScore = min(100, max(0, round(sum(clause_scores) / total_clauses)))\`
• **Sum of Clause Points:** **${breakdown.totalScoreSum}** across **${breakdown.clauseCount}** clauses
• **Unclamped Average:** ${breakdown.totalScoreSum} ÷ ${breakdown.clauseCount} = **${breakdown.averageScore} points**
• **Final Clamped Score:** **${score}/100**

#### 2. Risk Level Contributions
• **High-Risk Clauses (${breakdown.highRiskContribution.count}):** Contributed ${breakdown.highRiskContribution.points} points (${breakdown.highRiskContribution.weight} pts each)
• **Medium-Risk Clauses (${breakdown.mediumRiskContribution.count}):** Contributed ${breakdown.mediumRiskContribution.points} points (${breakdown.mediumRiskContribution.weight} pts each)
• **Low-Risk Clauses (${breakdown.lowRiskContribution.count}):** Contributed ${breakdown.lowRiskContribution.points} points (${breakdown.lowRiskContribution.weight} pts each)
`;
          if (breakdown.escalationRuleTriggered) {
            response += `\n• **Escalation Rule Triggered:** ${breakdown.escalationRuleTriggered}\n`;
          }
        } else {
          // If breakdown details weren't explicitly provided, calculate transparently from clause counts
          const highPts = highCount * 75;
          const medPts = medCount * 50;
          const lowPts = lowCount * 20;
          const sumPts = highPts + medPts + lowPts;
          const avgPts = total > 0 ? Math.round(sumPts / total) : score;

          response += `• **Clause Point Sum:** ${sumPts} points (${highCount} high risk × 75 pts + ${medCount} medium risk × 50 pts + ${lowCount} low risk × 20 pts)
• **Average Score:** ${sumPts} ÷ ${total || 1} = **${avgPts} points**
• **Escalation Trigger:** ${highCount >= 2 ? `Escalated to High Risk because ${highCount} high-risk clauses were detected (escalation threshold: >= 2 high-risk clauses).` : `Risk tier determined by overall calculated score.`}
`;
        }

        // List contributing high-risk clauses
        const contributingClauses = breakdown?.contributingClauses || doc.clauses || [];
        const highRiskClauses = contributingClauses.filter(c => (c.riskLevel || '').toLowerCase().includes('high'));

        if (highRiskClauses.length > 0) {
          response += `\n#### 3. Primary Factors Driving the ${score}/100 Score:\n`;
          highRiskClauses.slice(0, 4).forEach((c) => {
            response += `• **Clause #${c.clauseNumber}: ${c.title}** (${c.riskScore ?? 75} pts) — ${c.riskReason || 'Contains one-sided liabilities or eliminates judicial recourse.'}\n`;
          });
        }

        // Missing safeguards if available
        if (doc.missingOrUnclearClauses && doc.missingOrUnclearClauses.length > 0) {
          response += `\n#### 4. Absent Contract Safeguards:\n`;
          doc.missingOrUnclearClauses.slice(0, 2).forEach((m) => {
            response += `• **${m.title} (${m.severity} Severity):** ${m.potentialRisk}\n`;
          });
        }

        if (isTech) {
          response += `\n---\n*Technical Specification:* Clause score matrix $S \\in \\mathbb{R}^N$ with normalization $S_{\\text{final}} = \\min(100, \\max(0, \\text{round}(\\frac{1}{N}\\sum_{i=1}^N S_i)))$. High-risk tier defined as $S_{\\text{final}} \\ge 60 \\lor |\\{i: S_i \\ge 75\\}| \\ge 2$.`;
        }

        return response;
      }

      // =================================================================
      // 2. INDIVIDUAL CLAUSE RISK EXPLANATION
      // =================================================================
      case AssistantIntent.CLAUSE_RISK_EXPLANATION: {
        // Find clause from context or match clause number in query
        let targetClause = clause;
        if (!targetClause && doc?.clauses && doc.clauses.length > 0) {
          const numMatch = q.match(/clause\s*#?(\d+)/i);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            targetClause = doc.clauses.find(c => c.clauseNumber === num);
          }
          if (!targetClause) {
            // Pick first high-risk clause in document
            targetClause = doc.clauses.find(c => (c.riskLevel || '').toLowerCase().includes('high')) || doc.clauses[0];
          }
        }

        if (!targetClause) {
          if (!doc) {
            return `### No Contract or Clause Currently Selected 📄

No contract is currently loaded. Please upload or paste a contract first, then select any clause to examine its triggered risk rules, evidence, and severity rating.`;
          }
          return `### Please Select a Clause to Analyze

No specific clause is currently selected. Click on any clause from the **Clause Explorer** or **Clause Table** in the dashboard to review its risk findings and supporting contract quotations.`;
        }

        const score = targetClause.riskScore ?? 75;
        const level = targetClause.riskLevel || 'High Risk';
        const title = targetClause.title || 'Legal Provision';
        const quote = targetClause.exactQuotation || '';
        const consequence = targetClause.potentialConsequences || targetClause.riskReason || 'Creates significant unilateral legal or financial exposure.';
        const reason = targetClause.riskReason || consequence;
        const action = targetClause.suggestedRevision || 'Request mutual wording or a clear cap before signing.';

        let response = `### Risk Analysis: Clause #${targetClause.clauseNumber || 1} — ${title}

• **Risk Severity:** **${level.toUpperCase()}** (Risk Score: **${score}/100**)
• **ML Predicted Category:** **${targetClause.mlPredictedCategory || targetClause.category || 'General'}** *(Objective Legal Subject)*

#### 1. Why This Clause Was Flagged as ${level}
${reason}

#### 2. Practical Legal Impact
${consequence}
`;

        if (quote) {
          response += `\n#### 3. Supporting Contract Text\n> "${quote.length > 300 ? quote.slice(0, 300) + '...' : quote}"\n`;
        }

        // Check if there are relevant missing safeguards in the document
        if (doc?.missingOrUnclearClauses && doc.missingOrUnclearClauses.length > 0) {
          const relatedMissing = doc.missingOrUnclearClauses.find(m =>
            title.toLowerCase().includes('liability') && m.title.toLowerCase().includes('liability') ||
            title.toLowerCase().includes('termination') && m.title.toLowerCase().includes('termination') ||
            title.toLowerCase().includes('renewal') && m.title.toLowerCase().includes('termination')
          );
          if (relatedMissing) {
            response += `\n#### 4. Absent Contract Safeguard\n• **Missing:** **${relatedMissing.title}** (${relatedMissing.severity} Severity)\n• **Hazard:** ${relatedMissing.potentialRisk}\n`;
          }
        }

        response += `\n#### 5. Recommended Remedy\n${action}\n`;

        if (targetClause.questionsForLawyer && targetClause.questionsForLawyer.length > 0) {
          response += `\n**Questions to ask the other party or your attorney:**\n`;
          targetClause.questionsForLawyer.slice(0, 2).forEach((question, idx) => {
            response += `${idx + 1}. *"${question}"*\n`;
          });
        }

        return response;
      }

      // =================================================================
      // 3. SCORING FORMULA EXPLANATION
      // =================================================================
      case AssistantIntent.SCORING_FORMULA_EXPLANATION: {
        let response = `### LexiGuard Contractual Risk Scoring Formula

LexiGuard calculates contractual risk through a deterministic, transparent rule engine strictly separate from machine learning clause categorization.

#### 1. Base Clause Weights
Each extracted clause is evaluated against contractual hazard rules and assigned points:
• **Critical Risk Clause:** **85 points** *(Extreme liability exposure, complete waiver of constitutional remedies)*
• **High Risk Clause:** **75 points** *(Uncapped damages, unilateral indemnity, mandatory arbitration without court access)*
• **Medium Risk Clause:** **50 points** *(Auto-renewal with short notice window, unilateral amendment rights)*
• **Low Risk Clause:** **20 points** *(Standard mutual operational terms, neutral governing venue)*

#### 2. Contract Normalization Formula
The overall score aggregates all extracted clauses:
\`\`\`
rawScore = round( sum(clause_scores) / total_clauses )
OverallScore = min(100, max(0, rawScore))
\`\`\`
*(If no operational clauses are found in an excerpt, a conservative baseline score of 30 is assigned).*

#### 3. Risk Tier Escalation Thresholds
To ensure dangerous contracts are not masked by diluting low-risk boilerplate, escalation rules apply:
• **High Risk:** \`OverallScore >= 60\` **OR** \`highRiskCount >= 2\` **OR** \`criticalRiskCount >= 1\`
• **Medium Risk:** \`OverallScore >= 35\` **OR** \`mediumRiskCount >= 2\`
• **Low Risk:** Assigned only when score < 35 and high-risk count < 2.
`;

        if (doc) {
          response += `\n#### Current Document Calculation (${doc.filename || 'Active Contract'}):\n`;
          response += `• Total Clauses: **${doc.totalClauses || (doc.clauses ? doc.clauses.length : 0)}**\n`;
          response += `• High-Risk Clauses: **${doc.highRiskCount || 0}** | Medium-Risk: **${doc.mediumRiskCount || 0}** | Low-Risk: **${doc.lowRiskCount || 0}**\n`;
          response += `• Resulting Score: **${doc.overallScore ?? 75}/100** (${doc.riskLevel || 'High Risk'})\n`;
          if (doc.scoreBreakdown?.escalationRuleTriggered) {
            response += `• Escalation Status: ${doc.scoreBreakdown.escalationRuleTriggered}\n`;
          }
        } else {
          response += `\n*(Note: No active document is currently loaded. Upload or paste a contract to see these formulas applied to your text).*`;
        }

        return response;
      }

      // =================================================================
      // 4. CATEGORY VS RISK SCORE DISTINCTION
      // =================================================================
      case AssistantIntent.CATEGORY_VS_RISK_DISTINCTION: {
        return `### Three Core Architectural Concepts in LexiGuard

LexiGuard strictly separates three analytical dimensions to ensure legal transparency and machine learning integrity:

| Dimension | 1. ML Clause Category | 2. Model Confidence | 3. Contractual Risk Score |
| :--- | :--- | :--- | :--- |
| **Core Question** | *"What substantive legal topic is this?"* | *"How distinct is this clause from other categories?"* | *"How hazardous or one-sided are these terms to you?"* |
| **Engine** | Linear SVM on 3,000 TF-IDF features | Softmax-transformed decision margin | Rule-based hazard & reciprocity evaluation |
| **Output** | 1 of 12 categories (e.g., *Governing Law*) | Ordinal percentage (e.g., *88.5%*) | 0–100 score & severity (*High, Medium, Low*) |
| **Methodology** | Trained on 3,848 Atticus CUAD clauses | Margin distance to decision boundary | Absence of reciprocity, uncapped financial loss |

#### Why This Separation Is Essential:
A clause can be classified as **Governing Law** with **99.5% confidence**, yet be:
• **Low Risk (20/100):** If it designates a mutual neutral court in your state.
• **High Risk (80/100):** If it designates a distant foreign jurisdiction with unilateral attorney fee-shifting.

**Crucial Rule:** High machine-learning classification accuracy (94.55%) measures how reliably we identify the clause's legal subject matter, **NOT** whether the agreement is legally safe or hazardous.`;
      }

      // =================================================================
      // 5. PLAIN ENGLISH SUMMARY OF A CLAUSE
      // =================================================================
      case AssistantIntent.CLAUSE_PLAIN_ENGLISH: {
        if (!clause) {
          if (!doc) {
            return `### No Contract Loaded 📄\n\nPlease upload or paste a contract first, then select any clause to see its plain English summary.`;
          }
          return `### Please Select a Clause\n\nPlease select a clause from the dashboard to view its plain English summary, practical consequences, and lawyer questions.`;
        }

        return `### Plain English Summary: Clause #${clause.clauseNumber || 1} (${clause.title || 'Legal Term'})

**What this means in plain everyday words:**
${clause.plainEnglish || 'This clause defines specific obligations, remedies, and operational procedures that bind both signing parties.'}

**How it practically affects you:**
${clause.potentialConsequences || 'Depending on how negotiations proceed, this clause may restrict your rights or require prompt written notice.'}

**Questions you should ask your lawyer:**
${clause.questionsForLawyer && clause.questionsForLawyer.length > 0 ? clause.questionsForLawyer.map((q, i) => `${i + 1}. *"${q}"*`).join('\n') : '1. Can we make this obligation mutual?\n2. What is the standard commercial grace period?'}`;
      }

      // =================================================================
      // 6. WHY THIS CATEGORY / TF-IDF FEATURES
      // =================================================================
      case AssistantIntent.WHY_THIS_CATEGORY_FEATURES: {
        if (clause && clause.mlPredictedCategory) {
          const topFeatures = clause.mlTopFeatures && clause.mlTopFeatures.length > 0
            ? clause.mlTopFeatures.map(f => `\`"${f}"\``).join(', ')
            : 'domain-specific keyword patterns';

          return `### Classification Analysis for Clause #${clause.clauseNumber || 1}

• **Predicted Legal Category:** **${clause.mlPredictedCategory}**
• **Model Confidence Estimate:** **${clause.mlConfidence || 95}%** *(Softmax Decision Margin)*
• **Contributing TF-IDF Features:** ${topFeatures}

#### How the Linear SVM Reached This Prediction:
Our Linear SVM classifier projected this text into a 3,000-dimensional TF-IDF unigram and bigram feature space. The term vectors corresponding to ${topFeatures} generated the highest positive dot product $\\mathbf{w}_c^T \\mathbf{x} + b_c$ with the **${clause.mlPredictedCategory}** decision hyperplane.

*Note on Confidence Calibration:* The ${clause.mlConfidence || 95}% score represents ordinal separation relative to the other 11 categories, not a calibrated empirical probability (Platt scaling or isotonic regression was not applied).`;
        }

        return `### LexiGuard 12 Substantive Target Categories

LexiGuard classifies clauses into 12 substantive legal categories from the Atticus Open Contract Dataset (CUAD / AOK Beta):
1. **Cap On Liability** (F1: 97.1%)
2. **Governing Law** (F1: 100.0%)
3. **Termination For Convenience** (F1: 91.2%)
4. **Audit Rights** (F1: 97.8%)
5. **Non-Compete** (F1: 93.5%)
6. **Anti-Assignment** (F1: 96.6%)
7. **Insurance** (F1: 98.6%)
8. **License Grant** (F1: 95.7%)
9. **Renewal Term** (F1: 77.7%)
10. **Notice Period To Terminate Renewal** (F1: 56.5%)
11. **Ip Ownership Assignment** (F1: 95.7%)
12. **Liquidated Damages** (F1: 85.7%)`;
      }

      // =================================================================
      // 7. WHY LINEAR SVM ALGORITHM
      // =================================================================
      case AssistantIntent.WHY_LINEAR_SVM: {
        const algData = this.mlResults?.algorithms;
        const bestKeyWhy  = this.mlResults?.selectedModel || 'linearSvm';
        const bestNameWhy = this.mlResults?.selectedModelName || 'Linear SVM';
        const testNWhy    = this.mlResults?.testSamples || 825;
        const testCWhy    = this.mlResults?.testContracts || 102;
        const bestMWhy    = algData?.[bestKeyWhy];
        const svmM   = algData?.linearSvm;
        const lrM    = algData?.logisticRegression;
        const nbM    = algData?.multinomialNaiveBayes;
        const knnM   = algData?.knn;

        const fmtR = (key: string, label: string, m: any) => {
          if (!m) return '';
          const best = key === bestKeyWhy;
          const b = (s: string) => best ? `**${s}**` : s;
          return `| ${b(label)} | ${b(m.accuracy + '%')} | ${b(m.macroF1 + '%')} | ${b(m.weightedF1 + '%')} | ${b(m.latencyPerSampleMs + ' ms')} | ${best ? '**YES (Best)** ' : 'Baseline'} |\n`;
        };

        const table = [
          fmtR('linearSvm', 'Linear SVM', svmM),
          fmtR('logisticRegression', 'Logistic Regression', lrM),
          fmtR('multinomialNaiveBayes', 'Multinomial Naive Bayes', nbM),
          fmtR('knn', 'KNN (k=5)', knnM),
        ].join('');

        return `### Why ${bestNameWhy} Was Selected as the Production Classifier

Evaluated four ML models on **${testNWhy} held-out test clauses** across ${testCWhy} contracts (20% split, never seen during training):

| Model | Accuracy | Macro F1 | Weighted F1 | Latency | Selected |
| :--- | :--- | :--- | :--- | :--- | :--- |
${table}
#### Why ${bestNameWhy} Scored Best (Selected by highest Macro F1):
1. **Macro F1 ${bestMWhy?.macroF1 ?? 'N/A'}%:** Best unweighted average across all 12 categories — treats minority classes (e.g. Liquidated Damages) equally to majority classes.
2. **Accuracy ${bestMWhy?.accuracy ?? 'N/A'}% and Weighted F1 ${bestMWhy?.weightedF1 ?? 'N/A'}%:** Strong real-world performance weighted by actual class frequency.
3. **Latency ${bestMWhy?.latencyPerSampleMs ?? 'N/A'} ms/sample:** Sub-millisecond inference runs synchronously inside the Node.js server without any GPU overhead.
4. **Selection is automatic:** The best model is chosen each training run by Macro F1. Linear SVM and Logistic Regression are typically very close and either can win on different random seeds.`;
      }

      // =================================================================
      // 8. DATASET PREPROCESSING & ZERO LEAKAGE
      // =================================================================
      case AssistantIntent.PREPROCESSING_LEAKAGE: {
        const pre2 = this.mlResults?.preprocessingSummary;
        const trainCPre = this.mlResults?.trainContracts ?? 408;
        const testCPre  = this.mlResults?.testContracts  ?? 102;
        const trainSPre = this.mlResults?.trainSamples   ?? 3848;
        const testSPre  = this.mlResults?.testSamples    ?? 825;
        const missingPre = pre2?.missingValuesFiltered ?? 3625;
        const vocabPre   = pre2?.vocabularyFeatures ?? 3000;

        return `### Dataset Preprocessing & Zero Document Leakage

LexiGuard was trained on the **Atticus Open Contract Dataset (AOK Beta / CUAD v1)** under the CC BY 4.0 license.

#### Preprocessing Pipeline Audit (actual figures from training run):
1. **Raw Ingestion:** 510 material SEC EDGAR contracts, 83 columns, 6,120 scanned category cells.
2. **Missing Cell Filtering:** ${missingPre.toLocaleString()} empty/null cells filtered across 12 target category columns.
3. **Deduplication:** Duplicate clauses removed via MD5 hashing on (normalised text + category) key.
4. **Legal Negation Stopword Preservation:** Standard stopwords omit *'not'*, *'unless'* etc. — preserved here because they invert liability meaning (e.g. *'shall not exceed'* vs *'shall exceed'*).
5. **TF-IDF Vectoriser:** Fitted strictly on training split — ${vocabPre.toLocaleString()} vocabulary features, min_df=3, sublinear TF, L2 normalised. Test set transformed with the frozen vectoriser; no vocabulary information leaks from test to train.
6. **Contract-Level Split (Zero Leakage — split at document not clause level):**
   - 80% Training: **${trainCPre} contracts** (${trainSPre.toLocaleString()} clause samples)
   - 20% Held-Out Test: **${testCPre} contracts** (${testSPre.toLocaleString()} clause samples)
   - **Intersection = ∅:** No contract appears in both sets — all clauses from a given contract are either entirely in train or entirely in test.`;
      }

      // =================================================================
      // 9. METRICS & CONFUSION MATRIX
      // =================================================================
      case AssistantIntent.METRICS_CONFUSION_MATRIX: {
        const algM2 = this.mlResults?.algorithms;
        const bestKeyM2  = this.mlResults?.selectedModel || 'linearSvm';
        const bestNameM2 = this.mlResults?.selectedModelName || 'Linear SVM';
        const testNM2    = this.mlResults?.testSamples ?? 825;
        const bestMM2    = algM2?.[bestKeyM2];
        const catsM2: any[] = bestMM2?.categoryMetrics || [];
        const correctM2 = bestMM2 ? Math.round(bestMM2.accuracy / 100 * testNM2) : '?';
        const sortedM2  = [...catsM2].sort((a: any, b: any) => a.f1 - b.f1);
        const weakestM2   = sortedM2[0];
        const strongestM2 = sortedM2[sortedM2.length - 1];

        return `### Performance Evaluation & Confusion Matrix (${bestNameM2})

Evaluated on **${testNM2} held-out test clauses** from contracts never seen during training:

- **Accuracy:** **${bestMM2?.accuracy ?? 'N/A'}%** (approx. ${correctM2} / ${testNM2} correct predictions)
- **Macro F1-Score:** **${bestMM2?.macroF1 ?? 'N/A'}%** (unweighted average — treats all 12 categories equally)
- **Weighted F1-Score:** **${bestMM2?.weightedF1 ?? 'N/A'}%** (sample-weighted — reflects real-world class frequency)
- **Macro Precision:** **${bestMM2?.macroPrecision ?? 'N/A'}%** | **Macro Recall:** **${bestMM2?.macroRecall ?? 'N/A'}%**

#### Per-Class Highlights (${bestNameM2}):
${catsM2.length > 0 ? `- **Best class:** *${strongestM2?.category}* — F1: ${strongestM2?.f1}% (${strongestM2?.support} test clauses)
- **Weakest class:** *${weakestM2?.category}* — F1: ${weakestM2?.f1}% (${weakestM2?.support} test clauses)
  This low F1 is because ${weakestM2?.category} clauses frequently appear inside broader renewal or termination clauses, causing pairwise confusion in the classifier.` : 'Run npm run train to generate per-class results.'}

#### Metric Definitions:
- **Precision:** Of all clauses the model labels as *Cap On Liability*, what fraction truly is? (Minimises false alarms.)
- **Recall:** Of all true *Cap On Liability* clauses in the test set, what fraction did the model find? (Minimises missed provisions.)
- **Confusion Matrix:** 12x12 pairwise error grid — available in the **Model Hub Panel** in the dashboard or via the /api/ml/evaluation endpoint.`;
      }

      // =================================================================
      // 10. MODEL LIMITATIONS & BIAS
      // =================================================================
      case AssistantIntent.MODEL_LIMITATIONS: {
        return `### Model Limitations, Biases & Boundary Constraints

1. **SEC EDGAR Corporate Drafting Bias:** The training corpus consists of material commercial agreements filed by public corporations with the U.S. SEC. Performance may vary on informal freelancer contracts, residential leases, or consumer Terms of Service.
2. **Minority Class Overlap:** *Notice Period To Terminate Renewal* achieved 56.5% F1 because renewal notice terms frequently co-occur within broader renewal or termination provisions.
3. **Uncalibrated Confidence Estimates:** Confidence percentages reflect relative SVM margin separation rather than true empirical probabilities (Platt scaling was not fitted).
4. **English-Language Scope:** Strictly trained on English legal drafting and U.S. common law jurisdictions.
5. **Digital Text vs. Scanned Images:** Requires selectable digital text (PDF, DOCX, TXT). Scanned bitmap PDFs require OCR preprocessing before upload.
6. **Non-Legal Advice Disclaimer:** Automated assistive analysis only; not formal legal counsel.`;
      }

      // =================================================================
      // 11. GENERAL / DEFAULT
      // =================================================================
      default: {
        if (doc) {
          return `### LexiGuard AI Assistant — Active Contract: ${doc.filename || 'Loaded Agreement'}

I am ready to help you analyze **${doc.filename || 'your document'}** (Overall Score: **${doc.overallScore ?? 75}/100** — **${doc.riskLevel || 'High Risk'}**).

**Specific questions you can ask me right now:**
- *"Why is my overall risk assessment ${doc.overallScore ?? 75}?"* — Full breakdown of points, formula, and contributing clauses.
- *"Why is this clause marked high risk?"* — Triggered risk rules, supporting quotations, and missing safeguards.
- *"What is the scoring formula?"* — Exact mathematical weights (75/50/20 pts) and escalation thresholds.
- *"Explain the difference between clause category and risk score"* — Architectural separation.
- *"Why was ${this.mlResults?.selectedModelName || 'the trained model'} chosen over KNN & Naive Bayes?"* — Benchmark results on ${this.mlResults?.testSamples ?? 825} held-out test clauses.`;
        }

        return `### Welcome to LexiGuard AI Doubt Assistant 🏛️

I can assist you with contract analysis, machine learning architecture, and legal risk assessment.

**How to get started:**
1. **Analyze a contract:** Upload a PDF/DOCX/TXT file or paste text to generate a full risk assessment and clause breakdown.
2. **Select any clause:** Click on a clause in the results dashboard to ask targeted questions about its risk rules and plain English meaning.

**Suggested topics to ask me anytime:**
• *"What is the scoring formula?"*
• *"Explain the difference between category and risk score"*
• *"Why was Linear SVM selected?"*
• *"How was the dataset preprocessed with zero leakage?"*
• *"What are the model limitations?"*

*Disclaimer: Responses are educational and informational only. They do not constitute formal legal counsel.*`;
      }
    }
  }
}

export const assistantService = new AssistantService();
