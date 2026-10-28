import React from 'react';
import { AnalysisHistoryItem, AnalysisResult } from '../../types/legal';
import { RiskBadge } from '../common/RiskBadge';
import {
  History,
  Trash2,
  FolderOpen,
  Calendar,
  FileText,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface AnalysisHistoryProps {
  currentResultId: string;
  historyItems: AnalysisHistoryItem[];
  onOpenHistory: (item: AnalysisHistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onClearAll: () => void;
}

export const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({
  currentResultId,
  historyItems,
  onOpenHistory,
  onDeleteHistory,
  onClearAll,
}) => {
  if (historyItems.length === 0) {
    return null;
  }

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#172F50] flex items-center justify-center border border-indigo-100">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#10213A]">Analysis History</h3>
            <p className="text-xs text-[#64748B]">
              Previously analyzed contracts saved locally in your browser
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer self-start sm:self-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {historyItems.map((item) => {
          const isCurrent = item.id === currentResultId;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isCurrent
                  ? 'border-[#14B8A6] bg-[#E6FFFA]/30 ring-1 ring-[#14B8A6]'
                  : 'border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#172F50] shrink-0" />
                    <h4 className="text-xs font-bold text-[#10213A] truncate" title={item.documentName}>
                      {item.documentName}
                    </h4>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 shrink-0">
                      Current
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDeleteHistory(item.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <RiskBadge level={item.riskLabel || item.riskLevel || 'Low'} size="sm" score={item.riskScore} />
                  <span className="text-xs text-[#64748B]">
                    {item.flaggedClausesCount} flagged / {item.totalClauses}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] mb-3">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{formatDate(item.analyzedAt)}</span>
                </div>
              </div>

              {!isCurrent && (
                <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenHistory(item)}
                    className="text-xs font-semibold text-[#14B8A6] hover:text-[#0f766e] flex items-center gap-1 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Reopen Results</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
