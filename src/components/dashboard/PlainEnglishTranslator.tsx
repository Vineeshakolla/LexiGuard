import React, { useState } from 'react';
import { LegalClause } from '../../types/legal';
import { RiskBadge, normalizeRiskLabel, RISK_DEFINITIONS } from '../common/RiskBadge';
import {
  BookOpen,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Quote,
  Sparkles,
  Info
} from 'lucide-react';

interface PlainEnglishTranslatorProps {
  clauses: LegalClause[];
  onSelectClause: (clause: LegalClause) => void;
}

export const PlainEnglishTranslator: React.FC<PlainEnglishTranslatorProps> = ({
  clauses,
  onSelectClause,
}) => {
  const [activeClauseId, setActiveClauseId] = useState<string>(clauses[0]?.id || '');
  const activeClause = clauses.find((c) => c.id === activeClauseId) || clauses[0];

  if (!activeClause) return null;

  const quote = activeClause.whatDoesItSay || activeClause.exactQuotation || activeClause.originalText || '';
  const simpleMeaning = activeClause.whatDoesThisMean || activeClause.plainEnglish ||
    'This clause sets rules for how the agreement works and what each party is allowed to do.';
  const consequences = activeClause.howCouldThisAffectYou || activeClause.potentialConsequences ||
    'Depending on the situation, this clause may limit your options or require you to take action before a deadline.';
  const normLvl = normalizeRiskLabel(activeClause.potentialRiskLabel || activeClause.riskLevel);
  const riskReason = activeClause.riskReason || RISK_DEFINITIONS[normLvl];
  const whatShouldYouDo = activeClause.whatShouldYouDo || activeClause.suggestedRevision ||
    'Ask for clarification on any terms you do not understand, or request that the requirement be made mutual before you sign.';

  const exampleIllustration = activeClause.exampleIllustration || (
    activeClause.title.toLowerCase().includes('arbitration')
      ? 'Imagine you have a dispute about an unexpected charge. Under this clause, you cannot join other customers in a group claim or go to a regular local court; you must pay an arbitrator to hear your case individually.'
      : activeClause.title.toLowerCase().includes('renewal')
      ? 'Imagine you sign up for a one-year service and forget to cancel before the deadline. Under this clause, your credit card will be charged automatically for another full year with no refund.'
      : activeClause.title.toLowerCase().includes('liability')
      ? 'Imagine the service malfunctions and causes your business to lose files or work time. Under this clause, the company might only be required to refund you a small amount (like $50), even if your real loss was much higher.'
      : activeClause.title.toLowerCase().includes('termination')
      ? 'Imagine the other party decides to stop working with you. Under this clause, they might be able to cancel immediately without giving you time to prepare or download your files.'
      : 'Imagine a disagreement happens over this part of the agreement. This clause defines who has the final say, what notice is required, or what costs you might have to cover.'
  );

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#14B8A6] flex items-center justify-center border border-teal-100">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#10213A]">
              Simple &amp; Easy-to-Understand Explanations
            </h3>
            <p className="text-xs text-[#64748B]">
              Every clause explained in plain, everyday English with no legal jargon
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80 self-start sm:self-auto">
          Everyday English Guide
        </span>
      </div>

      {/* Clause selector tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar border-b border-slate-100">
        {clauses.map((clause) => {
          const isActive = clause.id === activeClause.id;
          const lvl = normalizeRiskLabel(clause.potentialRiskLabel || clause.riskLevel);
          return (
            <button
              key={clause.id}
              type="button"
              onClick={() => setActiveClauseId(clause.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#10213A] text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-[#172F50] border border-slate-200/80'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  lvl === 'High Risk'
                    ? 'bg-red-500'
                    : lvl === 'Medium Risk'
                    ? 'bg-amber-400'
                    : lvl === 'Not Enough Information'
                    ? 'bg-slate-400'
                    : 'bg-teal-400'
                }`}
              />
              <span>
                Clause #{clause.clauseNumber}: {clause.title.length > 25 ? clause.title.slice(0, 22) + '...' : clause.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Clause 6-Section Breakdown Card */}
      <div className="bg-slate-50/60 rounded-xl border border-slate-200/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-[#172F50] bg-white px-2 py-0.5 rounded border border-slate-200">
                Clause #{activeClause.clauseNumber}
              </span>
              <span className="text-xs text-[#64748B]">{activeClause.category}</span>
            </div>
            <h4 className="text-lg font-bold text-[#10213A]">{activeClause.title}</h4>
          </div>

          <RiskBadge level={normLvl} size="md" score={activeClause.riskScore} />
        </div>

        {/* 1. What does it say? */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#10213A]">
            <Quote className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>1. What does it say?</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs sm:text-[13px] leading-relaxed border border-slate-800">
            "{quote}"
          </div>
          <p className="text-[11px] text-[#64748B] italic">
            * Exact sentence quoted from your document.
          </p>
        </div>

        {/* 2. What does this mean in simple words? & 3. How could this affect you? */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#E6FFFA]/60 border border-teal-200">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-900 mb-2 uppercase tracking-wide">
              <Lightbulb className="w-4 h-4 text-[#14B8A6]" />
              <span>2. What does this mean in simple words?</span>
            </div>
            <p className="text-xs sm:text-sm text-teal-950 font-normal leading-relaxed">
              {simpleMeaning}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 mb-2 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>3. How could this affect you?</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-950 font-normal leading-relaxed">
              {consequences}
            </p>
          </div>
        </div>

        {/* 4. Is there a potential risk? */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#10213A] uppercase tracking-wide">
            <Info className="w-4 h-4 text-[#14B8A6]" />
            <span>4. Is there a potential risk?</span>
          </div>
          <div className="flex items-center gap-3">
            <RiskBadge level={normLvl} size="sm" score={activeClause.riskScore} />
          </div>
          <p className="text-xs sm:text-sm text-[#334155] leading-relaxed">
            <strong>Reason for rating:</strong> {riskReason}
          </p>
        </div>

        {/* 5. What should you do? */}
        <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 mb-2 uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>5. What should you do?</span>
          </div>
          <p className="text-xs sm:text-sm text-indigo-950 font-normal leading-relaxed">
            {whatShouldYouDo}
          </p>
        </div>

        {/* 6. Example */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-[#334155] leading-relaxed">
          <div className="flex items-center gap-2 text-xs font-bold text-[#10213A] mb-2 uppercase tracking-wide">
            <Sparkles className="w-4 h-4 text-[#14B8A6]" />
            <span>6. Example</span>
          </div>
          <div className="inline-block px-2 py-0.5 mb-2 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
            Illustration only — not a fact about your agreement
          </div>
          <p>{exampleIllustration}</p>
        </div>
      </div>
    </div>
  );
};
