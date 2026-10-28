import React from 'react';
import { LegalClause } from '../../types/legal';
import { RiskBadge, normalizeRiskLabel, RISK_DEFINITIONS } from '../common/RiskBadge';
import {
  X,
  MapPin,
  Quote,
  Lightbulb,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Bookmark,
  Sparkles,
  Info
} from 'lucide-react';

interface ClauseDetailsPanelProps {
  clause: LegalClause | null;
  onClose: () => void;
  onAskAssistant?: (clause: LegalClause) => void;
}

export const ClauseDetailsPanel: React.FC<ClauseDetailsPanelProps> = ({ clause, onClose, onAskAssistant }) => {
  if (!clause) return null;

  // 1. What does it say?
  const whatDoesItSay = clause.whatDoesItSay || clause.exactQuotation || clause.originalText || '';

  // 2. What does this mean in simple words?
  const whatDoesThisMean = clause.whatDoesThisMean || clause.plainEnglish ||
    'This clause sets rules for how the agreement works and what each party is allowed to do.';

  // 3. How could this affect you?
  const howCouldThisAffectYou = clause.howCouldThisAffectYou || clause.potentialConsequences ||
    'Depending on the situation, this clause may limit your options or require you to take action before a deadline.';

  // 4. Is there a potential risk?
  const riskLabel = normalizeRiskLabel(clause.potentialRiskLabel || clause.riskLevel);
  const riskReason = clause.riskReason || RISK_DEFINITIONS[riskLabel];

  // 5. What should you do?
  const whatShouldYouDo = clause.whatShouldYouDo || clause.suggestedRevision ||
    'Ask for clarification on any terms you do not understand, or request that the requirement be made mutual before you sign.';

  // 6. Example (Illustration)
  const exampleIllustration = clause.exampleIllustration || (
    clause.title.toLowerCase().includes('arbitration')
      ? 'Imagine you have a dispute about an unexpected charge. Under this clause, you cannot join other customers in a group claim or go to a regular local court; you must pay an arbitrator to hear your case individually.'
      : clause.title.toLowerCase().includes('renewal')
      ? 'Imagine you sign up for a one-year service and forget to cancel before the deadline. Under this clause, your credit card will be charged automatically for another full year with no refund.'
      : clause.title.toLowerCase().includes('liability')
      ? 'Imagine the service malfunctions and causes your business to lose files or work time. Under this clause, the company might only be required to refund you a small amount (like $50), even if your real loss was much higher.'
      : clause.title.toLowerCase().includes('termination')
      ? 'Imagine the other party decides to stop working with you. Under this clause, they might be able to cancel immediately without giving you time to prepare or download your files.'
      : clause.title.toLowerCase().includes('intellectual property') || clause.title.toLowerCase().includes('license')
      ? 'Imagine you upload a presentation or creative work to the platform. Under this clause, the service provider may be allowed to use, showcase, or train computer models on your work without paying you.'
      : 'Imagine a disagreement happens over this part of the agreement. This clause defines who has the final say, what notice is required, or what costs you might have to cover.'
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Panel Header */}
        <div className="px-6 py-5 bg-[#10213A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 font-mono font-bold text-sm flex items-center justify-center border border-teal-500/30">
              #{clause.clauseNumber}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight line-clamp-1">
                {clause.title}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                <span className="text-teal-300">{clause.category}</span>
                {clause.sourceLocation && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                      <MapPin className="w-3 h-3 text-[#14B8A6]" />
                      {clause.sourceLocation}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onAskAssistant && (
              <button
                type="button"
                onClick={() => {
                  onAskAssistant(clause);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Open AI Doubt Assistant for this clause"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                <span className="hidden sm:inline">Ask Doubt Assistant</span>
                <span className="sm:hidden">Ask AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel Scrollable Content (6 Formatted Sections) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: What does it say? */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#10213A]">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                1
              </span>
              <Quote className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-sm font-bold text-[#10213A]">What does it say?</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs sm:text-[13px] leading-relaxed border border-slate-800 select-text">
              "{whatDoesItSay}"
            </div>
            <p className="text-[11px] text-[#64748B] italic">
              * Quoted verbatim from your submitted document.
            </p>
          </div>

          {/* Section 2: What does this mean in simple words? */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold shrink-0">
                2
              </span>
              <Lightbulb className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-sm font-bold text-teal-950">What does this mean in simple words?</span>
            </div>
            <div className="p-4 rounded-xl bg-[#E6FFFA]/60 border border-teal-200 text-sm text-teal-950 font-normal leading-relaxed">
              {whatDoesThisMean}
            </div>
          </div>

          {/* Section 3: How could this affect you? */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
              <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold shrink-0">
                3
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-950">How could this affect you?</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-sm text-amber-950 leading-relaxed">
              {howCouldThisAffectYou}
            </div>
          </div>

          {/* Machine Learning Category Prediction Breakdown */}
          {clause.mlPredictedCategory && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-900">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs font-bold shrink-0">
                  ML
                </span>
                <span className="text-sm font-bold text-indigo-950">
                  Trained ML Classification (CUAD / AOK Model)
                </span>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                      Substantive Legal Category
                    </span>
                    <span className="text-base font-bold text-[#10213A] mt-0.5 block">
                      {clause.mlPredictedCategory}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-900 font-mono font-bold text-xs">
                      {clause.mlConfidence}% Confidence
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Engine: {clause.mlModelUsed || 'Linear SVM (TF-IDF)'}
                    </span>
                  </div>
                </div>

                {clause.mlTopFeatures && clause.mlTopFeatures.length > 0 && (
                  <div className="pt-2 border-t border-indigo-200/60 text-xs">
                    <span className="font-semibold text-indigo-900 block mb-1">Contributing TF-IDF Keywords:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {clause.mlTopFeatures.map((feat) => (
                        <span key={feat} className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800 font-mono text-[11px]">
                          "{feat}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 4: Is there a potential risk? */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#10213A]">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                4
              </span>
              <Info className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-sm font-bold text-[#10213A]">Is there a potential risk?</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-3">
                <RiskBadge level={riskLabel} size="md" score={clause.riskScore} />
              </div>
              <p className="text-xs sm:text-sm text-[#334155] leading-relaxed">
                <strong>Why this rating:</strong> {riskReason}
              </p>
            </div>
          </div>

          {/* Section 5: What should you do? */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-900">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs font-bold shrink-0">
                5
              </span>
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-indigo-950">What should you do?</span>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 text-sm text-indigo-950 leading-relaxed font-normal">
              {whatShouldYouDo}
            </div>

            {/* Questions to ask if available */}
            {clause.questionsForLawyer && clause.questionsForLawyer.length > 0 && (
              <div className="mt-3 pt-3 border-t border-indigo-100">
                <p className="text-xs font-bold text-indigo-900 mb-2">Practical questions you can ask:</p>
                <ul className="space-y-1.5 text-xs text-indigo-950">
                  {clause.questionsForLawyer.map((q, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-500 font-bold">•</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Section 6: Example (Illustration) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                6
              </span>
              <Sparkles className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-sm font-bold text-[#10213A]">Example</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-[#334155] leading-relaxed">
              <div className="inline-block px-2 py-0.5 mb-2 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
                Illustration only — not a fact about your agreement
              </div>
              <p>{exampleIllustration}</p>
            </div>
          </div>
        </div>

        {/* Panel Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between">
          <span className="text-xs text-[#64748B]">
            Clause {clause.clauseNumber} · {clause.category}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#10213A] hover:bg-[#172F50] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
