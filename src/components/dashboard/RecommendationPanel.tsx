import React from 'react';
import { Recommendation, LegalClause } from '../../types/legal';
import { RiskBadge } from '../common/RiskBadge';
import { CheckCircle2, ArrowRight, AlertTriangle, ShieldCheck, MessageSquare, Lightbulb } from 'lucide-react';

interface RecommendationPanelProps {
  recommendations: Recommendation[];
  clauses: LegalClause[];
  onSelectClause: (clause: LegalClause) => void;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  recommendations,
  clauses,
  onSelectClause,
}) => {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#14B8A6] flex items-center justify-center border border-teal-100">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#10213A]">
              Suggested Improvements &amp; Negotiation Tips
            </h3>
            <p className="text-xs text-[#64748B]">
              Prioritized action items and counter-proposals to protect your rights
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-[#172F50]">
          Action Priorities ({recommendations.length})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((rec) => {
          const matchedClause = clauses.find(
            (c) => c.clauseNumber === rec.relatedClauseNumber || c.title === rec.relatedClauseTitle
          );

          return (
            <div
              key={rec.id}
              className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-[#14B8A6]/60 transition-all flex flex-col justify-between shadow-2xs group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#10213A] text-white font-bold text-xs flex items-center justify-center">
                      {rec.priority}
                    </span>
                    <span className="text-xs font-bold text-[#10213A]">
                      Clause #{rec.relatedClauseNumber}: {rec.relatedClauseTitle}
                    </span>
                  </div>
                  <RiskBadge level={rec.riskLevel} size="sm" />
                </div>

                <div className="mt-2 space-y-2.5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block">
                      Why Prioritized:
                    </span>
                    <p className="text-xs text-[#18283F] font-medium leading-relaxed">
                      {rec.reasonForPrioritization}
                    </p>
                  </div>

                  {/* Suggested Improvement / Next Step */}
                  <div className="p-2.5 rounded-lg bg-[#E6FFFA]/50 border border-teal-200/60 text-xs text-teal-950 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Suggested Improvement:</span> {rec.suggestedNextStep}
                    </div>
                  </div>

                  {/* Practical Negotiation Tip */}
                  {rec.negotiationTip && (
                    <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-950 flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-indigo-900">Negotiation Tip:</span> {rec.negotiationTip}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {matchedClause && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSelectClause(matchedClause)}
                    className="text-xs font-semibold text-[#14B8A6] group-hover:text-[#0f766e] flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect Clause Details</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-[#64748B] italic">
        * Recommendations are AI-assisted analytical suggestions to guide your contract review and negotiation; consult legal counsel for formal representation.
      </p>
    </div>
  );
};
