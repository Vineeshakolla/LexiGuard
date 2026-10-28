import React from 'react';
import { MissingOrUnclearClause } from '../../types/legal';
import { AlertCircle, PlusCircle, ShieldAlert, FileQuestion } from 'lucide-react';

interface MissingClausesPanelProps {
  missingClauses: MissingOrUnclearClause[];
}

export const MissingClausesPanel: React.FC<MissingClausesPanelProps> = ({ missingClauses }) => {
  if (!missingClauses || missingClauses.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <FileQuestion className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#10213A]">
              Missing or Unclear Clause Warnings
            </h3>
            <p className="text-xs text-[#64748B]">
              Standard consumer and commercial protections absent or vaguely stated in this document
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
          {missingClauses.length} Flagged
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {missingClauses.map((clause) => {
          const isNotFound = clause.status === 'Not found in the provided text';

          return (
            <div
              key={clause.id}
              className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-xs font-bold text-[#10213A] leading-snug">
                    {clause.title}
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      clause.severity === 'High'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {clause.severity}
                  </span>
                </div>

                {/* Status Badge */}
                <div className="mb-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-200">
                    <AlertCircle className="w-3 h-3 text-amber-700" />
                    <span>{clause.status}</span>
                  </span>
                </div>

                <p className="text-xs text-[#18283F] leading-relaxed mb-3">
                  {clause.description}
                </p>

                <div className="space-y-1.5 text-xs">
                  <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                    Potential Risk:
                  </p>
                  <p className="text-xs text-red-900/90 leading-relaxed bg-red-50/70 p-2 rounded border border-red-100">
                    {clause.potentialRisk}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-amber-200/60">
                <p className="text-[11px] font-bold text-teal-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <PlusCircle className="w-3 h-3 text-[#14B8A6]" />
                  <span>Recommended Addition:</span>
                </p>
                <p className="text-[11px] text-teal-950 font-mono bg-white p-2 rounded border border-teal-200/80 leading-relaxed">
                  {clause.suggestedAddition}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
