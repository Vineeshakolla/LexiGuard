import React, { useState, useEffect } from 'react';
import { MlEvaluationData, MlModelMetrics } from '../../types/legal';
import {
  Brain,
  Database,
  BarChart2,
  Table,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  Search,
  Sliders,
  HelpCircle,
  ShieldCheck,
  Scale,
  Download
} from 'lucide-react';

interface MlModelHubPanelProps {
  onOpenDatasetModal?: () => void;
}

export const MlModelHubPanel: React.FC<MlModelHubPanelProps> = ({ onOpenDatasetModal }) => {
  const [data, setData] = useState<MlEvaluationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelKey, setSelectedModelKey] = useState<string>('linearSvm');
  
  // Interactive Live Classifier Playground state
  const [playgroundText, setPlaygroundText] = useState<string>(
    "In no event shall Provider's total aggregate liability arising out of or related to this Agreement exceed the total fees actually paid by Customer in the twelve months preceding the incident."
  );
  const [playgroundResult, setPlaygroundResult] = useState<any | null>(null);
  const [classifying, setClassifying] = useState<boolean>(false);

  // Fetch verified evaluation results from backend
  useEffect(() => {
    const fetchMlData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/ml/evaluation');
        if (!res.ok) throw new Error('Failed to fetch ML evaluation data');
        const evalJson: MlEvaluationData = await res.json();
        setData(evalJson);
        if (evalJson.selectedModel) {
          setSelectedModelKey(evalJson.selectedModel);
        }
      } catch (err: any) {
        console.error('Error loading ML evaluation:', err);
        setError(err.message || 'Error loading ML evaluation metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMlData();
  }, []);

  // Run live classification in playground
  const handleRunPlaygroundClassification = async (textToClassify?: string) => {
    const text = textToClassify || playgroundText;
    if (!text.trim()) return;
    setClassifying(true);
    try {
      const res = await fetch('/api/ml/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const json = await res.json();
        setPlaygroundResult(json);
      }
    } catch (err) {
      console.error('Live classification error:', err);
    } finally {
      setClassifying(false);
    }
  };

  // Run once on mount for initial sample
  useEffect(() => {
    handleRunPlaygroundClassification(playgroundText);
  }, []);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
        <RefreshCw className="w-6 h-6 text-[#14B8A6] animate-spin mx-auto" />
        <p className="text-sm font-semibold text-[#10213A]">Loading Machine Learning Pipeline &amp; Models...</p>
      </div>
    );
  }

  const algorithms = data?.algorithms || {};
  const currentModelMetrics: MlModelMetrics | undefined = algorithms[selectedModelKey] || algorithms['linearSvm'];
  const categories = data?.categories || [];
  const prep = data?.preprocessingSummary;

  const sampleSnippets = [
    {
      label: 'Liability Cap',
      text: "The total aggregate liability of both parties under this agreement shall be strictly capped at the amount paid by customer in the preceding twelve months."
    },
    {
      label: 'Governing Law',
      text: "This agreement shall be governed by, and construed in accordance with, the laws of the State of Delaware, without regard to conflicts of law principles."
    },
    {
      label: 'Non-Compete',
      text: "During the term of employment and for twelve (12) months thereafter, Employee agrees not to directly or indirectly engage in any business competing with Employer."
    },
    {
      label: 'Termination',
      text: "Either party may terminate this agreement for convenience at any time upon sixty (60) days prior written notice without penalty."
    },
    {
      label: 'Audit Rights',
      text: "Vendor may inspect and audit Customer's deployment and usage records once annually upon ten business days advance written notice."
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#10213A] via-[#172F50] to-[#1E3A5F] rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30 text-xs font-bold flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                Production Machine Learning Architecture
              </span>
              <span className="px-2.5 py-1 rounded-full bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 text-xs font-mono font-bold">
                TF-IDF + 4 Classifiers
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Legal Clause Classification Engine
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Trained on the Atticus Open Contract Dataset (CUAD) across 510 commercial contracts.
              Evaluated with a contract-level split ensuring <strong>zero document leakage</strong> on held-out test contracts.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <a
              href="/api/ml/download-report"
              download="LexiGuard_ML_Project_Report.pdf"
              className="px-3.5 py-2 rounded-xl bg-[#14B8A6] hover:bg-[#0f766e] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Download formal 12-page ML Project Report PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Report</span>
            </a>
            {onOpenDatasetModal && (
              <button
                type="button"
                onClick={onOpenDatasetModal}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-teal-300" />
                <span>Dataset Explorer</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notice: Crucial Separation between Legal Risk Scoring and ML Clause Categorization */}
      <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-5 flex items-start gap-3 text-amber-950 text-xs sm:text-sm leading-relaxed shadow-xs">
        <Scale className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-amber-900 mb-0.5">
            Architectural Separation: Category Classification vs. Legal Risk Scoring
          </h4>
          <p className="text-amber-900/90 text-xs">
            LexiGuard strictly separates <strong>Clause-Category Classification</strong> (identifying what substantive legal subject matter a clause covers, e.g. <em>Cap On Liability</em> or <em>Governing Law</em>) from <strong>Risk Scoring</strong> (evaluating whether the clause terms create dangerous or one-sided exposure for the signer). The ML models below classify categories based on textual TF-IDF features; risk assessment is performed independently via contractual evaluation principles.
          </p>
        </div>
      </div>

      {/* Section 1: Preprocessing Pipeline & Dataset Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Contracts</span>
          <div className="text-xl font-bold text-[#10213A] mt-1">
            {data?.trainContracts ?? 0} <span className="text-xs font-normal text-slate-400">/ {data?.testContracts ?? 0}</span>
          </div>
          <span className="text-[10px] text-teal-600 font-medium">80% Train / 20% Test</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Clean Clauses</span>
          <div className="text-xl font-bold text-[#10213A] mt-1">
            {data ? (data.trainSamples + data.testSamples).toLocaleString() : '—'}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Verified Substantive</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Missing Filtered</span>
          <div className="text-xl font-bold text-amber-600 mt-1">
            {prep?.missingValuesFiltered !== undefined ? prep.missingValuesFiltered.toLocaleString() : '—'}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Empty cells removed</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Duplicates Removed</span>
          <div className="text-xl font-bold text-indigo-600 mt-1">
            {prep?.duplicatesRemoved !== undefined ? prep.duplicatesRemoved : '—'}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Exact text hashes</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Feature Space</span>
          <div className="text-xl font-bold text-[#10213A] mt-1">
            {prep?.vocabularyFeatures !== undefined ? prep.vocabularyFeatures.toLocaleString() : '—'}
          </div>
          <span className="text-[10px] text-teal-600 font-medium">TF-IDF (1-2 N-Grams)</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Leakage Prevention</span>
          <div className="text-sm font-bold text-emerald-600 mt-1.5 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Zero Leakage</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Contract-Level Split</span>
        </div>
      </div>

      {/* Section 2: 4-Model Comparative Benchmark Scorecards */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-[#10213A] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#14B8A6]" />
              <span>4-Model Benchmark Performance on Held-Out Test Data</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Evaluated strictly on held-out contracts unseen during training. TF-IDF vectorizer fitted only on training contracts.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-mono font-semibold self-start sm:self-auto">
            Test Size: {data?.testSamples || 825} Clauses
          </span>
        </div>

        {/* 4 Models Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              key: 'linearSvm',
              name: 'Linear SVM',
              badge: 'Selected Best Model',
              badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
              metrics: algorithms['linearSvm'],
              desc: 'LinearSVC with balanced weights & squared hinge loss'
            },
            {
              key: 'logisticRegression',
              name: 'Logistic Regression',
              badge: 'Strong Baseline',
              badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
              metrics: algorithms['logisticRegression'],
              desc: 'Multinomial OvR with L2 penalty and balanced weighting'
            },
            {
              key: 'multinomialNaiveBayes',
              name: 'Multinomial Naive Bayes',
              badge: 'Fast Probabilistic',
              badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
              metrics: algorithms['multinomialNaiveBayes'],
              desc: 'Generative NB with Laplace smoothing (alpha=1.0)'
            },
            {
              key: 'knn',
              name: 'KNN (k=5)',
              badge: 'Instance-Based',
              badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
              metrics: algorithms['knn'],
              desc: 'K-Nearest Neighbors using Cosine distance metric'
            }
          ].map((m) => {
            const isSelected = selectedModelKey === m.key;
            const met = m.metrics;

            return (
              <div
                key={m.key}
                onClick={() => setSelectedModelKey(m.key)}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#14B8A6] bg-teal-50/20 shadow-md ring-2 ring-[#14B8A6]/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <h4 className="text-sm font-bold text-[#10213A]">{m.name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${m.badgeColor}`}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">{m.desc}</p>

                  <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Test Accuracy:</span>
                      <strong className="text-base font-bold text-[#10213A]">
                        {met ? `${met.accuracy.toFixed(2)}%` : '—'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Macro F1:</span>
                      <strong className="text-emerald-700 font-bold">
                        {met ? `${met.macroF1.toFixed(2)}%` : '—'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Weighted F1:</span>
                      <span className="text-slate-800 font-semibold">
                        {met ? `${met.weightedF1.toFixed(2)}%` : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Latency / sample:</span>
                      <span className="text-slate-600 font-mono">
                        {met?.latencyPerSampleMs ? `${met.latencyPerSampleMs}ms` : '< 1ms'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-[#14B8A6]' : 'text-slate-400'}`}>
                    {isSelected ? 'Viewing Metrics Below' : 'Click to Inspect'}
                  </span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#14B8A6]' : 'text-slate-400'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                <th className="py-2.5 px-3">Algorithm</th>
                <th className="py-2.5 px-3 text-right">Accuracy (%)</th>
                <th className="py-2.5 px-3 text-right">Macro Precision</th>
                <th className="py-2.5 px-3 text-right">Macro Recall</th>
                <th className="py-2.5 px-3 text-right">Macro F1</th>
                <th className="py-2.5 px-3 text-right">Weighted F1</th>
                <th className="py-2.5 px-3 text-right">Inference Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {[
                { key: 'linearSvm', name: 'Linear SVM', m: algorithms['linearSvm'], isBest: true },
                { key: 'logisticRegression', name: 'Logistic Regression', m: algorithms['logisticRegression'] },
                { key: 'multinomialNaiveBayes', name: 'Multinomial Naive Bayes', m: algorithms['multinomialNaiveBayes'] },
                { key: 'knn', name: 'K-Nearest Neighbors (k=5)', m: algorithms['knn'] }
              ].map((row) => (
                <tr
                  key={row.key}
                  onClick={() => setSelectedModelKey(row.key)}
                  className={`hover:bg-slate-50 cursor-pointer ${
                    selectedModelKey === row.key ? 'bg-teal-50/40 font-bold' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 flex items-center gap-2">
                    <span className="text-[#10213A]">{row.name}</span>
                    {row.isBest && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Top Model
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {row.m ? `${row.m.accuracy.toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {row.m ? `${row.m.macroPrecision.toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {row.m ? `${row.m.macroRecall.toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                    {row.m ? `${row.m.macroF1.toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                    {row.m ? `${row.m.weightedF1.toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                    {row.m?.latencyPerSampleMs ? `${row.m.latencyPerSampleMs} ms` : '< 1 ms'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Interactive Confusion Matrix Heatmap for Selected Model */}
      {currentModelMetrics && currentModelMetrics.confusionMatrix && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#10213A]">
                  Confusion Matrix: {selectedModelKey === 'linearSvm' ? 'Linear SVM' : selectedModelKey === 'logisticRegression' ? 'Logistic Regression' : selectedModelKey === 'multinomialNaiveBayes' ? 'Multinomial Naive Bayes' : 'K-Nearest Neighbors'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                  12 x 12 Classes
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Rows represent Ground-Truth legal clause categories. Columns represent Model Predicted categories. Diagonal cells indicate True Positives (correctly classified).
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="text-xs text-slate-500 font-medium">Switch Model:</span>
              <select
                value={selectedModelKey}
                onChange={(e) => setSelectedModelKey(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[#10213A] focus:outline-none focus:ring-1 focus:ring-[#14B8A6]"
              >
                <option value="linearSvm">Linear SVM (94.55% Acc)</option>
                <option value="logisticRegression">Logistic Regression (94.42% Acc)</option>
                <option value="multinomialNaiveBayes">Multinomial Naive Bayes (91.88% Acc)</option>
                <option value="knn">KNN k=5 (91.27% Acc)</option>
              </select>
            </div>
          </div>

          {/* Matrix Heatmap */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[140px_repeat(12,_minmax(38px,_1fr))] gap-1 text-[11px]">
                {/* Header Row */}
                <div className="font-bold text-slate-400 py-1 px-2 text-[10px] uppercase">
                  True \ Pred
                </div>
                {categories.map((cat, colIdx) => (
                  <div
                    key={`col-${cat}`}
                    className="font-mono text-center font-bold text-slate-600 truncate py-1 text-[10px]"
                    title={`Column ${colIdx + 1}: ${cat}`}
                  >
                    C{colIdx + 1}
                  </div>
                ))}

                {/* Rows */}
                {currentModelMetrics.confusionMatrix.map((row, rowIdx) => {
                  const catName = categories[rowIdx] || `Class ${rowIdx + 1}`;
                  const rowTotal = row.reduce((s, v) => s + v, 0) || 1;

                  return (
                    <React.Fragment key={`row-${rowIdx}`}>
                      {/* Row Label */}
                      <div
                        className="py-1 px-2 font-medium text-slate-700 truncate text-[11px] flex items-center gap-1"
                        title={`[${rowIdx + 1}] ${catName} (Support: ${rowTotal})`}
                      >
                        <span className="font-mono text-[10px] text-slate-400">C{rowIdx + 1}</span>
                        <span className="truncate">{catName}</span>
                      </div>

                      {/* Cells */}
                      {row.map((val, colIdx) => {
                        const isDiagonal = rowIdx === colIdx;
                        const pct = (val / rowTotal) * 100;

                        // Color intensity scale
                        let cellBg = 'bg-slate-50 text-slate-400';
                        if (isDiagonal) {
                          if (pct >= 85) cellBg = 'bg-emerald-600 text-white font-bold';
                          else if (pct >= 70) cellBg = 'bg-emerald-500 text-white font-bold';
                          else cellBg = 'bg-emerald-200 text-emerald-950 font-bold';
                        } else if (val > 0) {
                          cellBg = val >= 5 ? 'bg-red-200 text-red-950 font-bold' : 'bg-red-50 text-red-700';
                        }

                        return (
                          <div
                            key={`cell-${rowIdx}-${colIdx}`}
                            className={`h-8 rounded flex items-center justify-center font-mono text-[11px] transition-all cursor-default ${cellBg}`}
                            title={`True: ${catName} | Predicted: ${categories[colIdx]} | Count: ${val} (${pct.toFixed(1)}%)`}
                          >
                            {val}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
                <span>High True Positives (&ge;85%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-200 inline-block" />
                <span>Moderate True Positives</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-100 inline-block" />
                <span>Misclassifications (Off-diagonal)</span>
              </span>
            </div>
            <span className="font-mono text-slate-400">C1 to C12 index map in table below</span>
          </div>
        </div>
      )}

      {/* Section 4: Per-Class Evaluation Metrics Table */}
      {currentModelMetrics && currentModelMetrics.categoryMetrics && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-[#10213A]">
                Per-Category Evaluation Breakdown ({selectedModelKey === 'linearSvm' ? 'Linear SVM' : selectedModelKey})
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Detailed Support, True Positives (TP), False Positives (FP), False Negatives (FN), Precision, Recall, and F1-Score.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                  <th className="py-2 px-2.5">#</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Support</th>
                  <th className="py-2 px-3 text-right">TP</th>
                  <th className="py-2 px-3 text-right">FP</th>
                  <th className="py-2 px-3 text-right">FN</th>
                  <th className="py-2 px-3 text-right">Precision</th>
                  <th className="py-2 px-3 text-right">Recall</th>
                  <th className="py-2 px-3 text-right">F1-Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentModelMetrics.categoryMetrics.map((cm, idx) => (
                  <tr key={cm.category} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-2.5 font-mono text-slate-400">C{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#10213A]">{cm.category}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{cm.support}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{cm.tp}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-600">{cm.fp}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-600">{cm.fn}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{cm.precision.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{cm.recall.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{cm.f1.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 5: Live Interactive ML Classifier Playground */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#14B8A6]" />
              <h3 className="text-base font-bold text-[#10213A]">
                Live Real-Time Clause Classifier Playground
              </h3>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Paste or type any legal clause text below to run inference with the trained Linear SVM &amp; TF-IDF vectorizer.
            </p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 font-bold border border-teal-200 self-start sm:self-auto">
            In-Process Runtime Model
          </span>
        </div>

        {/* Preset sample buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500">Quick Test Excerpts:</span>
          {sampleSnippets.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setPlaygroundText(s.text);
                handleRunPlaygroundClassification(s.text);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="space-y-3">
          <textarea
            rows={3}
            value={playgroundText}
            onChange={(e) => setPlaygroundText(e.target.value)}
            placeholder="Type or paste a legal clause excerpt..."
            className="w-full p-3.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 focus:border-[#14B8A6] transition-all leading-relaxed"
          />

          <div className="flex justify-end">
            <button
              type="button"
              disabled={classifying || !playgroundText.trim()}
              onClick={() => handleRunPlaygroundClassification()}
              className="px-5 py-2 rounded-xl bg-[#14B8A6] hover:bg-[#0f766e] text-white text-xs font-bold shadow-md shadow-[#14B8A6]/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {classifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Classifying...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Run Real-Time ML Classification</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Prediction Results Display */}
        {playgroundResult && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
                  Model Prediction
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h4 className="text-lg font-bold text-[#10213A]">
                    {playgroundResult.predictedCategory}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-xs">
                    {playgroundResult.confidence}% Confidence
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Engine: <strong>{playgroundResult.modelUsed || 'Linear SVM (TF-IDF)'}</strong>
              </span>
            </div>

            {/* Top Probabilities */}
            {playgroundResult.probabilities && playgroundResult.probabilities.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700 block">Top Predicted Category Distribution:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {playgroundResult.probabilities.slice(0, 4).map((p: any) => (
                    <div key={p.category} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium text-slate-700 truncate">{p.category}</span>
                        <span className="font-mono font-bold text-slate-900">{p.probability}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#14B8A6] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(3, p.probability))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Contributing N-Grams */}
            {playgroundResult.topFeatures && playgroundResult.topFeatures.length > 0 && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold text-slate-600">Top Contributing TF-IDF Features:</span>
                {playgroundResult.topFeatures.map((feat: string) => (
                  <span
                    key={feat}
                    className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[11px] text-teal-800 font-medium"
                  >
                    "{feat}"
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 6: Model Limitations, Bias & Empirical Error Analysis */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="text-base font-bold text-[#10213A]">
            Model Limitations, Dataset Bias &amp; Confidence Calibration Analysis
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-700">
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
            <h4 className="font-bold text-[#10213A] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Class Imbalance &amp; Empirical Minority Error Rates
            </h4>
            <p>
              In our held-out test evaluation (825 clauses across 102 unseen contracts), high-frequency categories with distinctive syntax exhibit near-flawless performance:
            </p>
            <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <li><strong>Governing Law</strong>: 100.0% Precision | 100.0% Recall | 100.0% F1 (89/89 TP)</li>
              <li><strong>Insurance</strong>: 98.1% Precision | 99.1% Recall | 98.6% F1 (105/106 TP)</li>
              <li><strong>Cap On Liability</strong>: 98.3% Precision | 95.8% Recall | 97.1% F1 (115/120 TP)</li>
            </ul>
            <p>
              Conversely, low-support minority classes with cross-clause phrasing overlap show reduced precision and recall:
            </p>
            <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-red-800 bg-red-50/60 p-2.5 rounded-lg border border-red-100">
              <li><strong>Notice Period To Terminate Renewal</strong>: 54.2% Precision | 59.1% Recall | 56.5% F1 (13 TP, 11 FP, 9 FN on 22 test samples)</li>
              <li><strong>Renewal Term</strong>: 78.6% Precision | 76.7% Recall | 77.7% F1 (33 TP, 9 FP, 10 FN on 43 test samples)</li>
            </ul>
            <p className="text-[11px] text-slate-500">
              *Notice period deadlines frequently co-occur inside renewal or termination clauses, causing off-diagonal confusion.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
            <h4 className="font-bold text-[#10213A] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Confidence Scores vs. Probability Calibration
            </h4>
            <p>
              Model confidence percentages are generated via a <strong>softmax function</strong> applied to the multi-class Linear SVM decision boundary margins (z_c = w_c·x + b_c).
            </p>
            <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 font-medium">
              <strong>Calibration Notice:</strong> Linear SVM maximizes geometric margin separation rather than log-likelihood. While softmax scores provide an effective ordinal ranking of category confidence, they represent <em>heuristic decision-margin pseudo-probabilities</em> rather than empirically calibrated posterior probabilities (e.g. via Platt scaling or isotonic regression).
            </div>

            <h4 className="font-bold text-[#10213A] pt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Dataset &amp; Document Generalization Boundaries
            </h4>
            <p className="text-[11px]">
              • <strong>SEC EDGAR Bias:</strong> Trained on commercial B2B agreements. Consumer Terms of Service (B2C) or residential leases may have divergent styles.<br />
              • <strong>English-Only:</strong> Model vocabulary is restricted to English legal text.<br />
              • <strong>Digital Text Requirement:</strong> Scanned image-only PDFs require OCR before upload.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
