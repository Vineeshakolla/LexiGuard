import React, { useState, useMemo } from 'react';
import { LegalClause } from '../../types/legal';
import { RiskBadge, normalizeRiskLabel } from '../common/RiskBadge';
import {
  Search,
  FileText,
  ChevronRight,
  MapPin,
  Quote,
  Lightbulb,
  AlertTriangle,
  Info
} from 'lucide-react';

interface ClauseExplorerProps {
  clauses: LegalClause[];
  selectedCategory: string | null;
  onSelectClause: (clause: LegalClause) => void;
}

export const ClauseExplorer: React.FC<ClauseExplorerProps> = ({
  clauses,
  selectedCategory,
  onSelectClause,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'unknown'>('all');

  const filteredClauses = useMemo(() => {
    return clauses.filter((clause) => {
      const normLvl = normalizeRiskLabel(clause.potentialRiskLabel || clause.riskLevel);

      // Risk filter
      if (riskFilter === 'high' && normLvl !== 'High Risk') return false;
      if (riskFilter === 'medium' && normLvl !== 'Medium Risk') return false;
      if (riskFilter === 'low' && normLvl !== 'Low Risk') return false;
      if (riskFilter === 'unknown' && normLvl !== 'Not Enough Information') return false;

      // Category filter
      if (selectedCategory && !clause.category.toLowerCase().includes(selectedCategory.toLowerCase().slice(0, 15))) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const inTitle = clause.title.toLowerCase().includes(query);
        const inQuote = (clause.whatDoesItSay || clause.exactQuotation || clause.originalText || '').toLowerCase().includes(query);
        const inMean = (clause.whatDoesThisMean || clause.plainEnglish || '').toLowerCase().includes(query);
        const inAffect = (clause.howCouldThisAffectYou || clause.potentialConsequences || '').toLowerCase().includes(query);
        const inCat = clause.category.toLowerCase().includes(query);
        return inTitle || inQuote || inMean || inAffect || inCat;
      }

      return true;
    });
  }, [clauses, riskFilter, selectedCategory, searchTerm]);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
      {/* Title & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#14B8A6] flex items-center justify-center border border-teal-100">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#10213A]">Clause-by-Clause Findings</h3>
              <p className="text-xs text-[#64748B]">
                Showing {filteredClauses.length} of {clauses.length} clauses written in simple everyday English
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Search input & Risk Level Filter tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search clauses in simple words..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-60 pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 focus:border-[#14B8A6] transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold flex-wrap">
            <button
              type="button"
              onClick={() => setRiskFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                riskFilter === 'all'
                  ? 'bg-white text-[#10213A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#10213A]'
              }`}
            >
              All ({clauses.length})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter('high')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                riskFilter === 'high'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              High Risk
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter('medium')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                riskFilter === 'medium'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Medium Risk
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter('low')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                riskFilter === 'low'
                  ? 'bg-[#14B8A6] text-white shadow-xs'
                  : 'text-teal-700 hover:bg-teal-50'
              }`}
            >
              Low Risk
            </button>
          </div>
        </div>
      </div>

      {/* Clauses Card Grid */}
      {filteredClauses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClauses.map((clause) => {
            const normLvl = normalizeRiskLabel(clause.potentialRiskLabel || clause.riskLevel);
            const isHigh = normLvl === 'High Risk';
            const isMedium = normLvl === 'Medium Risk';
            const quote = clause.whatDoesItSay || clause.exactQuotation || clause.originalText || '';
            const simpleMeaning = clause.whatDoesThisMean || clause.plainEnglish;
            const consequences = clause.howCouldThisAffectYou || clause.potentialConsequences;

            return (
              <div
                key={clause.id}
                onClick={() => onSelectClause(clause)}
                className={`group cursor-pointer rounded-xl border p-5 transition-all duration-150 hover:shadow-md flex flex-col justify-between ${
                  isHigh
                    ? 'border-red-200/90 bg-red-50/20 hover:border-red-300 hover:bg-red-50/40'
                    : isMedium
                    ? 'border-amber-200/90 bg-amber-50/20 hover:border-amber-300 hover:bg-amber-50/40'
                    : 'border-slate-200/90 bg-white hover:border-teal-300 hover:bg-[#E6FFFA]/20'
                }`}
              >
                <div>
                  {/* Card Header: Clause number, Title, and Risk Badge */}
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-[#10213A]/5 text-[#172F50] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        #{clause.clauseNumber}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-[#10213A] group-hover:text-[#14B8A6] transition-colors leading-snug">
                          {clause.title}
                        </h4>
                        <span className="text-[11px] text-[#64748B] block mt-0.5">
                          {clause.category}
                        </span>
                      </div>
                    </div>

                    <RiskBadge level={normLvl} size="sm" score={clause.riskScore} />
                  </div>

                  {/* Machine Learning Category Prediction (Strictly separated from Risk Level) */}
                  {clause.mlPredictedCategory && (
                    <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-indigo-50/90 border border-indigo-200/90 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 truncate mr-2">
                        <span className="font-bold text-indigo-700 shrink-0">ML Category:</span>
                        <span className="font-semibold text-indigo-950 truncate">{clause.mlPredictedCategory}</span>
                      </div>
                      <span className="font-mono text-[10px] text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
                        {clause.mlConfidence}% conf ({clause.mlModelUsed || 'Linear SVM'})
                      </span>
                    </div>
                  )}

                  {/* Section 1: What does it say? (Exact Quote) */}
                  <div className="mb-3 p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed border border-slate-800">
                    <span className="text-[#14B8A6] select-none mr-1.5 font-bold">What it says:</span>
                    <span className="line-clamp-2">"{quote}"</span>
                  </div>

                  {/* Section 2: What does this mean in simple words? */}
                  <div className="mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block mb-0.5">
                      What this means in simple words:
                    </span>
                    <p className="text-xs text-[#18283F] font-normal leading-relaxed line-clamp-3">
                      {simpleMeaning}
                    </p>
                  </div>

                  {/* Section 3: How could this affect you? */}
                  {consequences && (
                    <div className="mb-3 pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
                        How could this affect you?
                      </span>
                      <p className="text-xs text-amber-950 font-normal leading-relaxed line-clamp-2">
                        {consequences}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom row: Source and action */}
                <div className="flex items-center justify-between text-xs text-[#64748B] pt-3 border-t border-slate-200/60 mt-2">
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <MapPin className="w-3 h-3 text-[#14B8A6]" />
                    {clause.sourceLocation}
                  </span>

                  <div className="flex items-center gap-1 text-xs font-semibold text-[#14B8A6] group-hover:translate-x-0.5 transition-transform">
                    <span>Read Full 6-Part Explanation</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400">
          <p className="text-sm font-medium">No legal clauses match your active search or filters.</p>
        </div>
      )}
    </div>
  );
};
