import React, { useState } from 'react';
import { AnalysisResult, LegalClause, AnalysisHistoryItem, CategorySummary } from '../../types/legal';
import { Logo } from '../common/Logo';
import { RiskOverview } from './RiskOverview';
import { DocumentSummaryCard } from './DocumentSummaryCard';
import { RiskDistributionChart } from './RiskDistributionChart';
import { RiskCategoryChart } from './RiskCategoryChart';
import { ClauseExplorer } from './ClauseExplorer';
import { ClauseTable } from './ClauseTable';
import { MissingClausesPanel } from './MissingClausesPanel';
import { PlainEnglishTranslator } from './PlainEnglishTranslator';
import { AnalysisHistory } from './AnalysisHistory';
import { ClauseDetailsPanel } from './ClauseDetailsPanel';
import { RecommendationPanel } from './RecommendationPanel';
import { AokBenchmarkPanel } from './AokBenchmarkPanel';
import { MlModelHubPanel } from './MlModelHubPanel';
import {
  RotateCcw,
  FileText,
  Calendar,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Download,
  Share2,
  RefreshCw,
  Table,
  BookOpen,
  Layers,
  FileQuestion,
  HelpCircle,
  Database,
  Brain
} from 'lucide-react';

interface ResultsDashboardProps {
  result: AnalysisResult;
  onReset: () => void;
  onAnalyzeAgain: () => void;
  historyItems: AnalysisHistoryItem[];
  onOpenHistoryItem: (item: AnalysisHistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearAllHistory: () => void;
  onOpenDatasetModal?: () => void;
  onAskAssistant?: (clause: LegalClause) => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  result,
  onReset,
  onAnalyzeAgain,
  historyItems,
  onOpenHistoryItem,
  onDeleteHistoryItem,
  onClearAllHistory,
  onOpenDatasetModal,
  onAskAssistant,
}) => {
  const [selectedClause, setSelectedClause] = useState<LegalClause | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'ml' | 'clauses' | 'table' | 'translator' | 'recommendations' | 'benchmark' | 'missing'>('all');

  const {
    documentMeta,
    documentSummary,
    overallAssessment,
    clauses,
    missingOrUnclearClauses = [],
    isAiPowered,
    statusMessage
  } = result;

  // Build category summaries dynamically from actual clauses
  const categorySummaries: CategorySummary[] = React.useMemo(() => {
    if (result.categorySummaries && result.categorySummaries.length > 0) {
      return result.categorySummaries;
    }
    const catMap = new Map<string, { count: number; high: number; mod: number; low: number; totalRisk: number }>();
    clauses.forEach((c) => {
      const cat = c.category || 'General Terms';
      const cur = catMap.get(cat) || { count: 0, high: 0, mod: 0, low: 0, totalRisk: 0 };
      cur.count++;
      const lvl = c.riskLevel.toLowerCase();
      if (lvl === 'high' || lvl === 'critical') cur.high++;
      else if (lvl === 'medium' || lvl === 'moderate') cur.mod++;
      else cur.low++;
      cur.totalRisk += c.riskScore || 50;
      catMap.set(cat, cur);
    });

    return Array.from(catMap.entries()).map(([cat, val]) => ({
      category: cat,
      count: val.count,
      highCount: val.high,
      moderateCount: val.mod,
      lowCount: val.low,
      averageRisk: val.count > 0 ? Math.round(val.totalRisk / val.count) : 0,
    }));
  }, [clauses, result.categorySummaries]);

  // Downloadable Analysis Report Generator
  const handleDownloadReport = () => {
    const reportDate = new Date(result.analyzedAt).toLocaleString();
    const riskLabel = overallAssessment.riskLevel || overallAssessment.riskLabel || 'Low Risk';

    const reportContent = `================================================================================
LEXIGUARD — COMPREHENSIVE LEGAL CLAUSE & RISK ANALYSIS REPORT
AI-Assisted Contract Evaluation · Confidential
================================================================================

DOCUMENT METADATA:
--------------------------------------------------------------------------------
File Name:        ${documentMeta.name}
Submission Method:${documentMeta.inputSource === 'direct_text' ? 'Direct Text Input (Pasted Content)' : 'Uploaded Document File'}
Contract Type:    ${documentSummary.contractType}
File Size:        ${documentMeta.formattedSize}
Word Count:       ${documentMeta.wordCount.toLocaleString()} words
Analyzed On:      ${reportDate}
Analysis Engine:  ${isAiPowered ? 'Gemini 3.8 Flash Legal Intelligence' : 'Grounded Contract Heuristic Parser'}

OVERALL RISK ASSESSMENT:
--------------------------------------------------------------------------------
Overall Risk Score:  ${overallAssessment.overallScore}/100 [${riskLabel.toUpperCase()}]
Total Clauses Found: ${overallAssessment.totalClauses}
- High & Critical:   ${overallAssessment.highRiskCount}
- Moderate Risk:     ${overallAssessment.mediumRiskCount}
- Low Risk:          ${overallAssessment.lowRiskCount}

Executive Summary:
${documentSummary.executiveSummary}

Primary Purpose:
${documentSummary.primaryPurpose}

Parties & Scope:
${documentSummary.partiesOrScope}

================================================================================
MISSING OR UNCLEAR CLAUSE WARNINGS (${missingOrUnclearClauses.length} Flagged):
================================================================================
${missingOrUnclearClauses.length === 0 ? 'No notable standard clauses were flagged as missing.' : missingOrUnclearClauses.map((m, idx) => `
[Warning ${idx + 1}] ${m.title}
Status:               ${m.status}
Severity:             ${m.severity} Risk
Why It's Missing:     ${m.description}
Potential Exposure:   ${m.potentialRisk}
Suggested Addition:   "${m.suggestedAddition}"
`).join('\n--------------------------------------------------------------------------------\n')}

================================================================================
DETECTED LEGAL CLAUSES & DETAILED RISK ANALYSIS (${clauses.length} Clauses):
================================================================================
${clauses.map((c) => `
--------------------------------------------------------------------------------
Clause #${c.clauseNumber}: ${c.title}
Category:             ${c.category}
Risk Severity:        ${c.riskLevel.toUpperCase()} (Score: ${c.riskScore}/100)
Source Location:      ${c.sourceLocation}

EXACT DOCUMENT QUOTATION:
"${c.exactQuotation || c.originalText}"

PLAIN-ENGLISH EXPLANATION:
${c.plainEnglish}

POTENTIAL CONSEQUENCES FOR USER:
${c.potentialConsequences || 'May restrict remedies or increase user obligations.'}

SUGGESTED REVISION / COUNTER-LANGUAGE:
${c.suggestedRevision || 'Seek mutual terms or negotiate explicit opt-out periods.'}

QUESTIONS FOR LEGAL COUNSEL:
${c.questionsForLawyer.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}
`).join('\n')}

================================================================================
LEGAL DISCLAIMER:
This document is generated by LexiGuard's automated preliminary contract analyzer.
It is intended solely to highlight potential areas of interest or negotiation for
your personal review and does NOT constitute formal legal advice, attorney-client
representation, or a guarantee of contractual enforceability. Consult a licensed
attorney for all formal legal determinations.
================================================================================
`;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LexiGuard_Report_${documentMeta.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col selection:bg-[#14B8A6]/20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#10213A] text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Document Title */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <Logo size="md" />
            <div className="h-6 w-px bg-white/15 hidden sm:block" />
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-white truncate max-w-xs font-mono">
                {documentMeta.name}
              </span>
              <span className="text-[11px] text-teal-300 font-medium">
                {documentSummary.contractType} · {documentMeta.formattedSize}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
            {/* Atticus Open Contract Dataset (AOK Beta) explorer button */}
            {onOpenDatasetModal && (
              <button
                type="button"
                onClick={onOpenDatasetModal}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 hover:text-white text-xs font-semibold border border-indigo-400/30 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Explore Atticus Open Contract Dataset (AOK Beta) verified references and evaluation metrics"
              >
                <Database className="w-3.5 h-3.5 text-teal-300" />
                <span className="hidden sm:inline">AOK Dataset</span>
              </button>
            )}

            {/* Download ML Project PDF Report */}
            <a
              href="/api/ml/download-report"
              download="LexiGuard_ML_Project_Report.pdf"
              className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 hover:text-white text-xs font-semibold border border-teal-400/30 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Download formal 12-page Machine Learning Project Report PDF"
            >
              <FileText className="w-3.5 h-3.5 text-teal-300" />
              <span className="hidden sm:inline">ML Project PDF</span>
            </a>

            {/* Download Analysis Report */}
            <button
              type="button"
              onClick={handleDownloadReport}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>Download Report</span>
            </button>

            {/* Analyze Same Document Again */}
            <button
              type="button"
              onClick={onAnalyzeAgain}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Re-run analysis on this document"
            >
              <RefreshCw className="w-3.5 h-3.5 text-teal-300" />
              <span className="hidden sm:inline">Analyze Again</span>
            </button>

            {/* Upload/Enter Another Document (resets to Stage 1) */}
            <button
              type="button"
              onClick={onReset}
              className="px-3.5 py-1.5 rounded-xl bg-[#14B8A6] hover:bg-[#0f766e] text-white text-xs font-bold shadow-md shadow-[#14B8A6]/25 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{documentMeta.inputSource === 'direct_text' ? 'Edit / Enter New Content' : 'Analyze Another Document'}</span>
            </button>
          </div>
        </div>

        {/* Navigation & Status bar */}
        <div className="bg-[#172F50]/90 border-t border-white/10 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-slate-300 font-medium">
                Analysis Grounded in Uploaded Text
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-300 font-mono text-[11px]">
                {statusMessage || (isAiPowered ? 'Gemini 3.8 Flash' : 'Grounded Parser')}
              </span>
            </div>

            {/* View tabs */}
            <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-lg text-[11px] font-semibold flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'all' ? 'bg-[#14B8A6] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('clauses')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'clauses' ? 'bg-[#14B8A6] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Risk Cards ({clauses.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'table' ? 'bg-[#14B8A6] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Clause Table
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('translator')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'translator' ? 'bg-[#14B8A6] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Translator
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('recommendations')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'recommendations' ? 'bg-[#14B8A6] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Recommendations &amp; Tips ({result.recommendations?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ml')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'ml' ? 'bg-[#14B8A6] text-white font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-teal-300" />
                <span>ML Model Hub (4 Models)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('benchmark')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'benchmark' ? 'bg-[#14B8A6] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                AOK Benchmark ({result.aokBenchmark?.matchedCategories?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('missing')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'missing' ? 'bg-[#14B8A6] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Missing Clauses ({missingOrUnclearClauses.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Document Summary Card (Contract Type & Purpose) */}
        <section id="doc-summary">
          <DocumentSummaryCard summary={documentSummary} meta={documentMeta} />
        </section>

        {/* Overall Risk Score & Assessment */}
        <section id="risk-overview">
          <RiskOverview assessment={overallAssessment} />
        </section>

        {/* AOK Beta Benchmark Reference Panel */}
        {(activeTab === 'all' || activeTab === 'benchmark') && result.aokBenchmark && (
          <section id="aok-benchmark">
            <AokBenchmarkPanel
              benchmark={result.aokBenchmark}
              onOpenDatasetModal={onOpenDatasetModal}
            />
          </section>
        )}

        {/* Machine Learning Model Hub & Evaluation Metrics */}
        {(activeTab === 'all' || activeTab === 'ml') && (
          <section id="ml-model-hub">
            <MlModelHubPanel onOpenDatasetModal={onOpenDatasetModal} />
          </section>
        )}

        {/* Suggested Improvements & Negotiation Tips */}
        {(activeTab === 'all' || activeTab === 'recommendations') && result.recommendations && result.recommendations.length > 0 && (
          <section id="recommendations">
            <RecommendationPanel
              recommendations={result.recommendations}
              clauses={clauses}
              onSelectClause={(c) => setSelectedClause(c)}
            />
          </section>
        )}

        {/* Missing or Unclear Clause Warnings */}
        {(activeTab === 'all' || activeTab === 'missing') && (
          <section id="missing-clauses">
            <MissingClausesPanel missingClauses={missingOrUnclearClauses} />
          </section>
        )}

        {/* Risk Distribution Chart (Donut + Category Prevalence) */}
        {(activeTab === 'all' || activeTab === 'clauses') && (
          <section id="risk-charts">
            <RiskDistributionChart
              assessment={overallAssessment}
              categorySummaries={categorySummaries}
            />
          </section>
        )}

        {/* Clause-by-Clause Analysis Table */}
        {(activeTab === 'all' || activeTab === 'table') && (
          <section id="clause-table">
            <ClauseTable
              clauses={clauses}
              onSelectClause={(c) => setSelectedClause(c)}
            />
          </section>
        )}

        {/* Plain-English Legal Translator */}
        {(activeTab === 'all' || activeTab === 'translator') && (
          <section id="translator">
            <PlainEnglishTranslator
              clauses={clauses}
              onSelectClause={(c) => setSelectedClause(c)}
            />
          </section>
        )}

        {/* Detected Clauses Risk Cards Grid */}
        {(activeTab === 'all' || activeTab === 'clauses') && (
          <section id="clause-explorer">
            <ClauseExplorer
              clauses={clauses}
              selectedCategory={selectedCategory}
              onSelectClause={(c) => setSelectedClause(c)}
            />
          </section>
        )}

        {/* Risk Categories Overview Grid */}
        {categorySummaries.length > 0 && (
          <section id="categories-overview">
            <RiskCategoryChart
              categorySummaries={categorySummaries}
              selectedCategory={selectedCategory}
              onSelectCategory={(cat) => setSelectedCategory(cat)}
            />
          </section>
        )}

        {/* Analysis History (Past Analyses in localStorage) */}
        <section id="history">
          <AnalysisHistory
            currentResultId={result.id}
            historyItems={historyItems}
            onOpenHistory={onOpenHistoryItem}
            onDeleteHistory={onDeleteHistoryItem}
            onClearAll={onClearAllHistory}
          />
        </section>
      </main>

      {/* Deep-Dive Clause Side Panel */}
      <ClauseDetailsPanel
        clause={selectedClause}
        onClose={() => setSelectedClause(null)}
        onAskAssistant={onAskAssistant}
      />

      {/* Footer with Legal Disclaimer */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-slate-400">|</span>
            <span>Automated Legal Clause &amp; Risk Intelligence</span>
          </div>
          <p className="max-w-xl text-center sm:text-right">
            LexiGuard provides preliminary risk detection for informational review only and does not constitute formal legal advice or substitute for professional legal counsel.
          </p>
        </div>
      </footer>
    </div>
  );
};
