import React, { useState } from 'react';
import { AokBenchmarkInfo, AokMatchedCategory } from '../../types/legal';
import { Database, ShieldCheck, ExternalLink, HelpCircle, FileText, CheckCircle2, AlertCircle, Scale, ChevronDown, ChevronUp } from 'lucide-react';

interface AokBenchmarkPanelProps {
  benchmark?: AokBenchmarkInfo;
  onOpenDatasetModal?: () => void;
}

export const AokBenchmarkPanel: React.FC<AokBenchmarkPanelProps> = ({
  benchmark,
  onOpenDatasetModal,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!benchmark || !benchmark.matchedCategories || benchmark.matchedCategories.length === 0) {
    return null;
  }

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 selection:bg-[#14B8A6]/20">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Database className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[#10213A]">
                Atticus Open Contract Dataset (AOK Beta) Benchmark Comparison
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                CC BY 4.0 Verified Corpus
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Grounded against 510 commercial contracts and 13,145 verified legal annotations from The Atticus Project
            </p>
          </div>
        </div>

        {onOpenDatasetModal && (
          <button
            type="button"
            onClick={onOpenDatasetModal}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-900 border border-slate-200 text-[#172F50] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>Explore Dataset &amp; Metrics</span>
          </button>
        )}
      </div>

      {/* Critical Distinction Notice Banner */}
      <div className="mb-5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-950 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Benchmark Separation Notice:</strong> The reference clauses below are verified standard examples from the public Atticus Open Contract Dataset (AOK Beta / CUAD) and are displayed strictly for baseline comparison. They are completely separate from your uploaded document. A clause being common in commercial contracts does not automatically mean it is legally safe for your specific situation.
        </p>
      </div>

      {/* Grid of Matched AOK Benchmark Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {benchmark.matchedCategories.map((item, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div
              key={`${item.aokCategory}-${idx}`}
              className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-white hover:border-indigo-300 transition-all shadow-2xs flex flex-col justify-between"
            >
              <div>
                {/* Category header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                      AOK Benchmark Category
                    </span>
                    <h4 className="text-sm font-bold text-[#10213A] mt-0.5">
                      {item.aokCategory}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold">
                      {item.prevalencePercent}% Prevalence
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      in 510 agreements
                    </span>
                  </div>
                </div>

                {/* LexiGuard Mapping */}
                <div className="flex items-center gap-1.5 text-xs text-[#64748B] mb-3">
                  <span className="font-semibold text-[#172F50]">LexiGuard Category:</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[#10213A] text-[11px]">
                    {item.lexiCategory}
                  </span>
                </div>

                {/* Reference Quote from Real AOK SEC Contract */}
                <div className="p-3 rounded-lg bg-indigo-950 text-indigo-100 font-mono text-[11px] leading-relaxed border border-indigo-900">
                  <div className="flex items-center justify-between text-[10px] text-indigo-300 font-sans font-semibold mb-1 pb-1 border-b border-indigo-800/80">
                    <span>Verified AOK Standard Excerpt:</span>
                    <span className="truncate max-w-[200px]" title={item.sourceContract}>
                      {item.sourceContract}
                    </span>
                  </div>
                  <p className={`${isExpanded ? '' : 'line-clamp-3'}`}>
                    "{item.sampleReference}"
                  </p>
                </div>
              </div>

              {/* Bottom toggle */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#64748B] italic">
                  * Commercial SEC EDGAR Benchmark
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpand(idx)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>{isExpanded ? 'Collapse Excerpt' : 'View Full Excerpt'}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Benchmark stats summary bar */}
      <div className="mt-5 p-3 rounded-xl bg-slate-100/70 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            Benchmark Corpus: <strong className="text-[#10213A]">{benchmark.totalBenchmarkContracts} SEC Contracts</strong>
          </span>
          <span>•</span>
          <span>
            Verified Annotations: <strong className="text-[#10213A]">{benchmark.totalBenchmarkAnnotations.toLocaleString()}</strong>
          </span>
          <span>•</span>
          <span>
            Matched Categories: <strong className="text-[#10213A]">{benchmark.matchedCategories.length}</strong>
          </span>
        </div>

        <a
          href="https://www.kaggle.com/datasets/theatticusproject/atticus-open-contract-dataset-aok-beta"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>View on Kaggle</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
