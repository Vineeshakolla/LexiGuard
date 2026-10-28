import React, { useState } from 'react';
import { LegalClause } from '../../types/legal';
import { RiskBadge } from '../common/RiskBadge';
import { Table, Search, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';

interface ClauseTableProps {
  clauses: LegalClause[];
  onSelectClause: (clause: LegalClause) => void;
}

export const ClauseTable: React.FC<ClauseTableProps> = ({ clauses, onSelectClause }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filtered = clauses.filter((c) => {
    if (filterSeverity !== 'all' && c.riskLevel.toLowerCase() !== filterSeverity.toLowerCase()) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const inTitle = c.title.toLowerCase().includes(q);
      const inQuote = (c.exactQuotation || c.originalText || '').toLowerCase().includes(q);
      const inPlain = c.plainEnglish.toLowerCase().includes(q);
      const inCat = c.category.toLowerCase().includes(q);
      return inTitle || inQuote || inPlain || inCat;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#14B8A6] flex items-center justify-center border border-teal-100">
            <Table className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#10213A]">Clause-by-Clause Analysis Table</h3>
            <p className="text-xs text-[#64748B]">
              Side-by-side comparison of verbatim quotes, risk severities, and suggested revisions
            </p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#14B8A6]"
            />
          </div>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[#18283F] focus:outline-none cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs text-[#18283F]">
          <thead className="bg-[#10213A] text-white uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-3 w-16">Clause</th>
              <th className="py-3 px-3 w-36">Title &amp; Category</th>
              <th className="py-3 px-3 w-28">Risk Level</th>
              <th className="py-3 px-3 min-w-[200px]">What Does It Say? (Quote)</th>
              <th className="py-3 px-3 min-w-[180px]">In Simple Words</th>
              <th className="py-3 px-3 min-w-[180px]">What Should You Do?</th>
              <th className="py-3 px-3 w-20 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelectClause(c)}
                className="hover:bg-teal-50/30 transition-colors cursor-pointer group"
              >
                <td className="py-3 px-3 font-mono font-bold text-[#172F50]">
                  #{c.clauseNumber}
                </td>
                <td className="py-3 px-3">
                  <p className="font-bold text-[#10213A] group-hover:text-[#14B8A6] transition-colors line-clamp-2">
                    {c.title}
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">{c.category}</p>
                  {c.mlPredictedCategory && (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold mt-1">
                      ML: {c.mlPredictedCategory} ({c.mlConfidence}%)
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  <RiskBadge level={c.potentialRiskLabel || c.riskLevel} size="sm" score={c.riskScore} />
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-slate-700 bg-slate-50/50">
                  <div className="line-clamp-3 leading-relaxed">
                    "{c.whatDoesItSay || c.exactQuotation || c.originalText}"
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="line-clamp-3 text-slate-700 leading-relaxed font-normal">
                    {c.whatDoesThisMean || c.plainEnglish}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="line-clamp-3 text-teal-900 bg-teal-50/60 p-1.5 rounded border border-teal-100 text-[11px] leading-relaxed">
                    {c.whatShouldYouDo || c.suggestedRevision || 'Review with legal counsel or ask for clarification.'}
                  </div>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#14B8A6] hover:underline text-[11px]">
                    Inspect
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
