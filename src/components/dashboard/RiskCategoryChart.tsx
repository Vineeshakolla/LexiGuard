import React from 'react';
import { CategorySummary } from '../../types/legal';
import {
  ShieldAlert,
  Database,
  RefreshCw,
  XCircle,
  Scale,
  ShieldOff,
  Copyright,
  FileEdit,
  UserX,
  History,
  Layers,
  ChevronRight
} from 'lucide-react';

interface RiskCategoryChartProps {
  categorySummaries: CategorySummary[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'Privacy and Personal Data Sharing': ShieldAlert,
  'Data Collection and Tracking': Database,
  'Automatic Renewal and Subscription Payments': RefreshCw,
  'Cancellation and Refund Policies': XCircle,
  'Mandatory Arbitration and Dispute Resolution': Scale,
  'Limitation of Liability': ShieldOff,
  'Intellectual Property and Content Ownership': Copyright,
  'Unilateral Changes to Terms': FileEdit,
  'Account Termination': UserX,
  'Data Retention and Deletion': History,
};

export const RiskCategoryChart: React.FC<RiskCategoryChartProps> = ({
  categorySummaries,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#14B8A6] flex items-center justify-center border border-teal-100">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#10213A]">Risk Categories Overview</h3>
            <p className="text-xs text-[#64748B]">
              Tracked legal domains and detected clause frequencies
            </p>
          </div>
        </div>

        {selectedCategory && (
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className="text-xs font-semibold text-[#14B8A6] hover:text-[#0f766e] flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Reset Category Filter</span>
            <span className="w-4 h-4 rounded-full bg-teal-50 flex items-center justify-center text-[10px]">✕</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {categorySummaries.map((cat) => {
          const IconComp = CATEGORY_ICONS[cat.category] || Scale;
          const isSelected = selectedCategory === cat.category;
          const hasDetected = cat.count > 0;

          return (
            <button
              key={cat.category}
              type="button"
              onClick={() => onSelectCategory(isSelected ? null : cat.category)}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-[#14B8A6] bg-[#E6FFFA]/50 ring-2 ring-[#14B8A6]/30 shadow-xs'
                  : hasDetected
                  ? 'border-slate-200 hover:border-[#14B8A6]/50 bg-white hover:bg-slate-50/80 shadow-2xs'
                  : 'border-slate-100 bg-slate-50/50 opacity-60 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      hasDetected ? 'bg-[#10213A]/5 text-[#172F50]' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>

                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      cat.highCount > 0
                        ? 'bg-red-100 text-red-700'
                        : cat.moderateCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : hasDetected
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {cat.count} {cat.count === 1 ? 'clause' : 'clauses'}
                  </span>
                </div>

                <p className="text-xs font-bold text-[#10213A] line-clamp-2 leading-snug">
                  {cat.category}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#64748B]">
                <span>
                  {hasDetected
                    ? cat.highCount > 0
                      ? `${cat.highCount} high risk`
                      : 'Moderate/Low'
                    : 'None detected'}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#14B8A6]' : 'text-slate-300'}`} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
