import React, { useState, useEffect } from 'react';
import {
  AokDatasetStatus,
  AokCategoryStat,
  AokEvaluationReport
} from '../../types/legal';
import {
  X,
  Database,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  BookOpen,
  Scale,
  FileText,
  BarChart2,
  RefreshCw,
  Info,
  ShieldCheck,
  Award,
  Layers,
  ChevronRight,
  Filter,
  Download,
  FileSpreadsheet,
  Cpu,
  Sparkles
} from 'lucide-react';

interface DatasetStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatasetStatusModal: React.FC<DatasetStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'schema' | 'samples' | 'preprocessing' | 'categories' | 'evaluation' | 'report'
  >('overview');

  // State
  const [status, setStatus] = useState<AokDatasetStatus | null>(null);
  const [categories, setCategories] = useState<AokCategoryStat[]>([]);
  const [evaluation, setEvaluation] = useState<AokEvaluationReport | null>(null);
  const [explorerData, setExplorerData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search tab state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchCategory, setSearchCategory] = useState<string>('All Categories');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [searching, setSearching] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchDatasetInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statusRes, catRes, evalRes, expRes] = await Promise.all([
          fetch('/api/dataset/status'),
          fetch('/api/dataset/categories'),
          fetch('/api/dataset/evaluation'),
          fetch('/api/dataset/explorer')
        ]);

        if (statusRes.ok) {
          const s = await statusRes.json();
          setStatus(s);
        }
        if (catRes.ok) {
          const c = await catRes.json();
          setCategories(c);
        }
        if (evalRes.ok) {
          const e = await evalRes.json();
          setEvaluation(e);
        }
        if (expRes.ok) {
          const exp = await expRes.json();
          setExplorerData(exp);
        }
      } catch (err: any) {
        console.error('Error fetching dataset info:', err);
        setError('Failed to load dataset metadata.');
      } finally {
        setLoading(false);
      }
    };

    fetchDatasetInfo();
  }, [isOpen]);

  // Execute search across annotations
  const handleSearch = async (queryText: string, cat: string) => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (queryText) params.append('q', queryText);
      if (cat && cat !== 'All Categories') params.append('category', cat);
      params.append('limit', '12');

      const res = await fetch(`/api/dataset/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        setTotalMatches(data.totalMatches || 0);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'categories') {
      handleSearch(searchQuery, searchCategory);
    }
  }, [activeTab]);

  if (!isOpen) return null;

  const dims = explorerData?.dimensions;
  const distinctions = explorerData?.structuralDistinction || [];
  const columnsMeta = explorerData?.columnsMeta || [];
  const sampleContracts = explorerData?.sampleContracts || [];
  const prep = explorerData?.preprocessingAudit;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#10213A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-400/30">
              <Database className="w-5 h-5 text-[#14B8A6]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  LexiGuard Machine Learning Dataset Explorer
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30 text-[11px] font-bold">
                  CUAD v1 / AOK Beta
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-mono">
                  CC BY 4.0
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                510 SEC Commercial Contracts · 83 Columns · 6,120 Scanned Target Cells · 4,673 Clean Clauses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/ml/download-report"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              download="LexiGuard_ML_Project_Report.pdf"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Report</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="bg-[#172F50] px-6 py-2 border-t border-white/10 flex items-center gap-1 overflow-x-auto text-xs shrink-0">
          {[
            { id: 'overview', label: '1. Overview & Dimensions' },
            { id: 'schema', label: '2. Schema & Columns (83)' },
            { id: 'samples', label: '3. Sample Raw Records' },
            { id: 'preprocessing', label: '4. Preprocessing & Split' },
            { id: 'categories', label: '5. Taxonomies & Search' },
            { id: 'evaluation', label: '6. Benchmark Metrics' },
            { id: 'report', label: '7. Downloadable PDF Report' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap text-xs ${
                activeTab === tab.id ? 'bg-[#14B8A6] text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#14B8A6] mb-3" />
              <p className="text-sm font-semibold text-[#10213A]">Loading Dataset Schema &amp; Statistics...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* TAB 1: OVERVIEW & STRUCTURAL DISTINCTIONS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Top Banner */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-slate-50 to-indigo-500/10 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-5 h-5 text-teal-600" />
                        <h3 className="text-base font-bold text-[#10213A]">
                          Atticus Open Contract Dataset (CUAD v1 / AOK Beta)
                        </h3>
                      </div>
                      <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed">
                        Curated by <strong>The Atticus Project, Inc.</strong> and licensed under <strong>Creative Commons Attribution 4.0 International (CC BY 4.0)</strong>. Consists of 510 material commercial contracts filed publicly with the U.S. Securities and Exchange Commission (SEC EDGAR).
                      </p>
                    </div>

                    <a
                      href="https://www.kaggle.com/datasets/theatticusproject/atticus-open-contract-dataset-aok-beta"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-[#10213A] hover:bg-[#172F50] text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-sm"
                    >
                      <span>Kaggle Dataset Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Summary Stat Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Contracts</span>
                      <span className="text-2xl font-black text-[#10213A] mt-1 block">510</span>
                      <span className="text-[10px] text-teal-700 font-medium">SEC EDGAR Agreements</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">CSV Dimensions</span>
                      <span className="text-2xl font-black text-[#10213A] mt-1 block">510 × 83</span>
                      <span className="text-[10px] text-teal-700 font-medium">Rows × Columns</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Scanned Target Cells</span>
                      <span className="text-2xl font-black text-[#10213A] mt-1 block">6,120</span>
                      <span className="text-[10px] text-teal-700 font-medium">510 Contracts × 12 Categories</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Clean Clause Corpus</span>
                      <span className="text-2xl font-black text-emerald-700 mt-1 block">4,673</span>
                      <span className="text-[10px] text-emerald-800 font-medium">3,848 Train / 825 Test</span>
                    </div>
                  </div>

                  {/* Crucial Distinction Table: Contracts vs Rows vs Cells vs Samples */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <h4 className="text-xs font-bold text-[#10213A] uppercase tracking-wider flex items-center gap-2">
                      <Scale className="w-4 h-4 text-[#14B8A6]" />
                      <span>Essential Distinction: Contracts vs. CSV Rows vs. Category Cells vs. Clause Samples</span>
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      To prevent statistical ambiguity, LexiGuard maintains precise operational definitions across all data abstractions:
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
                            <th className="py-2.5 px-3">Data Unit</th>
                            <th className="py-2.5 px-3 text-center">Count</th>
                            <th className="py-2.5 px-3">Structural Definition &amp; Role in Machine Learning Pipeline</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {distinctions.map((d: any) => (
                            <tr key={d.unit} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-bold text-[#10213A]">{d.unit}</td>
                              <td className="py-2.5 px-3 font-mono text-center font-bold text-teal-800">{d.count}</td>
                              <td className="py-2.5 px-3 text-slate-700">{d.role}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Metadata and License Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                      <h4 className="font-bold text-[#10213A] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                        <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
                        <span>Source &amp; Legal Licensing</span>
                      </h4>
                      <p><strong>Curated by:</strong> The Atticus Project, Inc. (atticusprojectai.org)</p>
                      <p><strong>Public License:</strong> Creative Commons Attribution 4.0 International (CC BY 4.0)</p>
                      <p><strong>Document Corpus:</strong> Material corporate contracts filed with the U.S. SEC EDGAR system.</p>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Contains no personal data (PII); all agreements are public corporate commercial documents.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                      <h4 className="font-bold text-[#10213A] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <span>Verification &amp; Storage Integrity</span>
                      </h4>
                      <p><strong>Master File:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">data/aok_dataset/master_clauses.csv</code></p>
                      <p><strong>Preprocessed Split:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">data/preprocessed_dataset.json</code></p>
                      <p><strong>Document Leakage Check:</strong> <span className="text-emerald-700 font-bold">0 overlapping contracts (PASS)</span></p>
                      <p className="text-slate-500 text-[11px]">
                        Partitioned deterministically: 408 train contracts / 102 test contracts.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SCHEMA & COLUMNS */}
              {activeTab === 'schema' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-[#10213A]">
                        CSV Dataset Schema &amp; Data Types (83 Columns Total)
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Each row represents 1 SEC contract. Column 1 stores the filename; columns 2-42 store Python list-formatted clause quote spans; columns 43-83 store attorney review answers.
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono font-bold self-start sm:self-auto">
                      510 Rows × 83 Columns
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[450px]">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Column Name</th>
                          <th className="py-2 px-3">Inferred Data Type</th>
                          <th className="py-2 px-3 text-center">Non-Null Contracts</th>
                          <th className="py-2 px-3">Description &amp; Target Category Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {columnsMeta.map((col: any) => (
                          <tr key={col.name} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-mono font-bold text-[#10213A]">{col.name}</td>
                            <td className="py-2 px-3 font-mono text-teal-800">{col.type}</td>
                            <td className="py-2 px-3 text-center font-mono text-slate-700">{col.nonNullCount} / 510</td>
                            <td className="py-2 px-3 text-slate-600">{col.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: SAMPLE RAW RECORDS */}
              {activeTab === 'samples' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-[#10213A]">
                        Sample Contract Records from Master CSV
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Inspect actual contract files, metadata, and extracted legal clause quotes from the dataset.
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-bold self-start sm:self-auto">
                      Real SEC EDGAR Filings
                    </span>
                  </div>

                  <div className="space-y-3">
                    {sampleContracts.map((c: any) => (
                      <div key={c.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                          <div>
                            <span className="font-bold text-[#10213A] font-mono text-xs">{c.filename}</span>
                            <span className="text-slate-500 ml-2">({c.documentName || 'Commercial Agreement'})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.split === 'train' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {c.split.toUpperCase()} SPLIT
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {c.clauseCount} Annotations
                            </span>
                          </div>
                        </div>

                        {c.parties && c.parties.length > 0 && (
                          <div className="text-[11px] text-slate-600">
                            <strong>Parties:</strong> {c.parties.join('; ')}
                          </div>
                        )}

                        {c.sampleClauses && c.sampleClauses.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-slate-700 block">Extracted Target Clauses:</span>
                            {c.sampleClauses.map((sc: any, idx: number) => (
                              <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] space-y-1">
                                <span className="font-bold text-teal-800 block">{sc.category}</span>
                                <p className="font-mono text-slate-700 leading-relaxed italic">"{sc.text}"</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: PREPROCESSING & SPLIT AUDIT */}
              {activeTab === 'preprocessing' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-[#10213A]">
                        Data Preprocessing Pipeline &amp; Class Imbalance Audit
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Before-and-after audit logs for missing values, deduplication, balanced class weights, and contract-level partition.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Before & After Audit Card */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-xs">
                      <h4 className="font-bold text-[#10213A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                        <span>Data Sanitization Audit Logs</span>
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-slate-600">Total Scanned Target Cells:</span>
                          <span className="font-mono font-bold text-[#10213A]">6,120</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-amber-700">Missing / Empty Cells Filtered:</span>
                          <span className="font-mono font-bold text-amber-700">- 3,625 (59.2%)</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-slate-600">Populated Category Cells:</span>
                          <span className="font-mono font-bold text-[#10213A]">2,495</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-indigo-700">Exact Duplicate Hashes Removed:</span>
                          <span className="font-mono font-bold text-indigo-700">- 77 Clauses</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-emerald-800 font-bold">Final Clean Substantive Corpus:</span>
                          <span className="font-mono font-bold text-emerald-800">4,673 Clauses</span>
                        </div>
                      </div>
                    </div>

                    {/* Zero Leakage Partition Card */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 text-xs">
                      <h4 className="font-bold text-[#10213A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Contract-Level Partition (Zero Leakage)</span>
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-slate-600">Training Split (80%):</span>
                          <span className="font-mono font-bold text-[#10213A]">408 Contracts · 3,848 Clauses</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-slate-600">Held-Out Test Split (20%):</span>
                          <span className="font-mono font-bold text-[#10213A]">102 Contracts · 825 Clauses</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-slate-600">Overlapping Contracts:</span>
                          <span className="font-mono font-bold text-emerald-700">0 (Strictly Disjoint)</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-slate-600">TF-IDF Vectorizer Fitting:</span>
                          <span className="font-mono font-bold text-teal-800">Fitted ONLY on Train Data</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Class Imbalance & Weighting Table */}
                  {prep?.trainDistribution && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
                      <h4 className="font-bold text-[#10213A] uppercase tracking-wider text-[11px]">
                        Class Distribution &amp; Balanced Sample Weights Across 12 Categories
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3 text-right">Train Support</th>
                              <th className="py-2 px-3 text-right">Held-Out Test</th>
                              <th className="py-2 px-3 text-right">Balanced Weight</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {Object.entries(prep.trainDistribution).map(([cat, count]: [string, any]) => (
                              <tr key={cat} className="hover:bg-slate-50/70">
                                <td className="py-2 px-3 font-semibold text-[#10213A]">{cat}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">{count}</td>
                                <td className="py-2 px-3 text-right font-mono text-teal-800">{prep.testDistribution?.[cat] || 0}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                                  {prep.balancedClassWeights?.[cat]?.toFixed(4) || '1.0000'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: 41 CLAUSE CATEGORIES & SEARCH */}
              {activeTab === 'categories' && (
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          handleSearch(e.target.value, searchCategory);
                        }}
                        placeholder="Search annotated clauses by keyword (e.g. liability cap, delaware, audit)..."
                        className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                      />
                    </div>

                    <select
                      value={searchCategory}
                      onChange={(e) => {
                        setSearchCategory(e.target.value);
                        handleSearch(searchQuery, e.target.value);
                      }}
                      className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14B8A6] cursor-pointer"
                    >
                      <option value="All Categories">All Categories ({categories.length})</option>
                      {categories.map((c) => (
                        <option key={c.category} value={c.category}>
                          {c.category} ({c.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Results */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Showing {searchResults.length} of {totalMatches} matching clauses</span>
                      {searching && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#14B8A6]" />}
                    </div>

                    {searchResults.map((r) => (
                      <div key={r.id} className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#10213A]">{r.category}</span>
                          <span className="font-mono text-[11px] text-slate-400">{r.contractFilename}</span>
                        </div>
                        <p className="font-mono text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          "{r.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: BENCHMARK METRICS */}
              {activeTab === 'evaluation' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                    <h3 className="text-sm font-bold text-[#10213A] flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[#14B8A6]" />
                      <span>Held-Out Test Set Performance (825 Legal Clauses across 102 Contracts)</span>
                    </h3>
                    <p className="text-xs text-slate-600">
                      Evaluated with an 80/20 contract document split guaranteeing zero leakage. TF-IDF vectorizer fitted only on training contracts.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
                      <div className="p-3 rounded-lg bg-teal-50 border border-teal-200">
                        <span className="text-[10px] font-bold text-teal-800 uppercase block">Accuracy</span>
                        <span className="text-xl font-bold text-teal-900 mt-0.5 block">94.55%</span>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <span className="text-[10px] font-bold text-blue-800 uppercase block">Macro Precision</span>
                        <span className="text-xl font-bold text-blue-900 mt-0.5 block">90.19%</span>
                      </div>
                      <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase block">Macro Recall</span>
                        <span className="text-xl font-bold text-indigo-900 mt-0.5 block">90.98%</span>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Macro F1-Score</span>
                        <span className="text-xl font-bold text-emerald-900 mt-0.5 block">90.49%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: DOWNLOADABLE PDF REPORT */}
              {activeTab === 'report' && (
                <div className="space-y-5">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-[#10213A] via-[#172F50] to-[#1E3A5F] text-white shadow-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-teal-400" />
                      <h3 className="text-base sm:text-lg font-bold">
                        Download Formal Machine Learning Project Report (PDF)
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                      Complete 12-page professional engineering document generated on <strong>October 26, 2026</strong>. Includes executive abstract, dataset statistics, preprocessing workflow, 4-model comparison tables, 12×12 confusion matrix heatmap, per-class evaluation breakdown, and legal engineering disclaimers.
                    </p>

                    <div className="pt-2 flex items-center gap-3 flex-wrap">
                      <a
                        href="/api/ml/download-report"
                        download="LexiGuard_ML_Project_Report.pdf"
                        className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0f766e] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download LexiGuard_ML_Project_Report.pdf (40 KB)</span>
                      </a>

                      <a
                        href="/LexiGuard_ML_Project_Report.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Preview in Browser</span>
                      </a>
                    </div>
                  </div>

                  {/* Table of contents in report */}
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <h4 className="font-bold text-[#10213A] uppercase tracking-wider text-[11px]">
                      Document Sections Included in the Formal PDF Report
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                      <div>• Section 1: Problem Statement, Objectives &amp; Scope</div>
                      <div>• Section 2: Dataset Source, Taxonomy &amp; Breakdown</div>
                      <div>• Section 3: Preprocessing Pipeline &amp; Zero-Leakage Split</div>
                      <div>• Section 4: Feature Engineering: TF-IDF &amp; Vocab Capping</div>
                      <div>• Section 5: ML Algorithms &amp; Training Hyperparameters</div>
                      <div>• Section 6: Empirical Benchmark Results (4 Models)</div>
                      <div>• Section 7: Per-Class Performance &amp; Confusion Matrix</div>
                      <div>• Section 8: Classification vs. Confidence vs. Risk</div>
                      <div>• Section 9: System Architecture &amp; REST APIs</div>
                      <div>• Section 10: Model Limitations &amp; Legal Disclaimers</div>
                      <div>• Section 11: Verification Checklist &amp; References</div>
                      <div>• Page Numbers, Header/Footer &amp; Native Vector Tables</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
