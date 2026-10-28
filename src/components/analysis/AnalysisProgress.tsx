import React, { useEffect, useState } from 'react';
import { Logo } from '../common/Logo';
import { CheckCircle2, Loader2, Sparkles, ShieldAlert } from 'lucide-react';

interface AnalysisProgressProps {
  filename: string;
}

const STAGES = [
  'Reading document...',
  'Identifying legal clauses...',
  'Evaluating potential risks...',
  'Preparing your legal insights...',
];

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ filename }) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev < STAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, []);

  const progressPercent = Math.min(100, Math.round(((currentStageIndex + 1) / STAGES.length) * 100));

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg mx-auto bg-white rounded-3xl p-8 sm:p-10 shadow-2xl shadow-[#10213A]/10 border border-slate-200/80 text-center relative overflow-hidden">
        {/* Soft decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#14B8A6]/10 blur-3xl pointer-events-none" />

        {/* Central Animated Shield */}
        <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#10213A] to-[#14B8A6] opacity-15 animate-ping" />
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#10213A] via-[#172F50] to-[#0f766e] flex items-center justify-center shadow-lg shadow-[#10213A]/25 ring-2 ring-[#14B8A6]/50">
            <ShieldAlert className="w-10 h-10 text-[#14B8A6] animate-pulse" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-[#10213A] tracking-tight mb-1 font-['Inter']">
          Analyzing Legal Document
        </h2>
        <p className="text-sm text-[#64748B] mb-6 truncate px-4 font-mono">
          {filename}
        </p>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 mb-8 overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-[#172F50] via-[#14B8A6] to-[#5eead4] h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Steps List */}
        <div className="space-y-3.5 text-left max-w-xs mx-auto mb-6">
          {STAGES.map((stageText, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            const isPending = idx > currentStageIndex;

            return (
              <div
                key={stageText}
                className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  isCompleted
                    ? 'text-teal-700 font-medium'
                    : isCurrent
                    ? 'text-[#10213A] font-bold scale-[1.02]'
                    : 'text-slate-400 font-normal opacity-60'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-[#14B8A6] shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-[#14B8A6] animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                )}
                <span>{stageText}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-[#64748B] pt-4 border-t border-slate-100">
          <Sparkles className="w-3.5 h-3.5 text-[#14B8A6]" />
          <span>AI clause risk parsing &amp; plain-English translation</span>
        </div>
      </div>
    </div>
  );
};
