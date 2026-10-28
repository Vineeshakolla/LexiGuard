import React from 'react';
import { OverallAssessment } from '../../types/legal';
import { ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle, HelpCircle, FileText, Info } from 'lucide-react';
import { RISK_DEFINITIONS, normalizeRiskLabel } from '../common/RiskBadge';

interface RiskOverviewProps {
  assessment: OverallAssessment;
}

export const RiskOverview: React.FC<RiskOverviewProps> = ({ assessment }) => {
  const {
    overallScore,
    scoreExplanation,
    totalClauses,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    criticalRiskCount,
  } = assessment;

  const rawLabel = assessment.riskLevel || assessment.riskLabel || 'Low Risk';
  const riskLabel = normalizeRiskLabel(rawLabel);

  // Gauge & Badge styling
  const getColor = () => {
    if (riskLabel === 'High Risk' || overallScore >= 60) {
      return {
        stroke: '#EF4444',
        text: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        badge: 'bg-red-600 text-white',
        icon: AlertTriangle,
      };
    }
    if (riskLabel === 'Medium Risk' || overallScore >= 35) {
      return {
        stroke: '#F59E0B',
        text: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        badge: 'bg-amber-500 text-white',
        icon: AlertCircle,
      };
    }
    return {
      stroke: '#14B8A6',
      text: 'text-teal-700',
      bg: 'bg-[#E6FFFA]',
      border: 'border-teal-200',
      badge: 'bg-[#14B8A6] text-white',
      icon: ShieldCheck,
    };
  };

  const colors = getColor();

  // Semicircular SVG gauge calculations
  const radius = 85;
  const circumference = Math.PI * radius; // ~267
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-8">
      {/* Top Gauge & Narrative */}
      <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-10">
        {/* Semicircular Gauge */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-56 h-32 flex items-end justify-center">
            <svg viewBox="0 0 200 115" className="w-56 h-32 overflow-visible">
              <defs>
                <linearGradient id="gaugeGradientSimple" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="40%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#EF4444" />
                </linearGradient>
              </defs>

              {/* Background Track */}
              <path
                d="M 15 100 A 85 85 0 0 1 185 100"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="16"
                strokeLinecap="round"
              />

              {/* Active Progress Arc */}
              <path
                d="M 15 100 A 85 85 0 0 1 185 100"
                fill="none"
                stroke={colors.stroke}
                strokeWidth="16"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Score in center */}
            <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
              <span className="text-4xl font-extrabold text-[#10213A] tracking-tight">
                {overallScore}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] -mt-0.5">
                Caution Score / 100
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${colors.badge} shadow-xs`}>
              {riskLabel}
            </span>
          </div>
        </div>

        {/* Narrative Description in Plain Language */}
        <div className="flex-1 w-full text-center lg:text-left">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#10213A] tracking-tight">
              Overall Risk Assessment
            </h2>
            <p className="mt-2 text-sm text-[#334155] leading-relaxed">
              {scoreExplanation || 'Here is how your document scores based on the clauses and rights we examined.'}
            </p>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            {/* Total Clauses */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-left">
              <div className="flex items-center gap-1.5 text-xs text-[#64748B] mb-1 font-medium">
                <FileText className="w-3.5 h-3.5 text-[#172F50]" />
                <span>Clauses Reviewed</span>
              </div>
              <p className="text-2xl font-extrabold text-[#10213A]">
                {totalClauses}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Identified sections</p>
            </div>

            {/* High Risk */}
            <div className="bg-red-50/70 rounded-xl p-3 border border-red-200 text-left">
              <div className="flex items-center gap-1.5 text-xs text-red-700 mb-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>High Risk</span>
              </div>
              <p className="text-2xl font-extrabold text-red-700">
                {highRiskCount}
              </p>
              <p className="text-[11px] text-red-600/80 mt-0.5">Needs careful review</p>
            </div>

            {/* Medium Risk */}
            <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200 text-left">
              <div className="flex items-center gap-1.5 text-xs text-amber-800 mb-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Medium Risk</span>
              </div>
              <p className="text-2xl font-extrabold text-amber-800">
                {mediumRiskCount}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">Potential concern</p>
            </div>

            {/* Low Risk */}
            <div className="bg-[#E6FFFA]/80 rounded-xl p-3 border border-teal-200 text-left">
              <div className="flex items-center gap-1.5 text-xs text-teal-800 mb-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Low Risk</span>
              </div>
              <p className="text-2xl font-extrabold text-teal-800">
                {lowRiskCount}
              </p>
              <p className="text-[11px] text-teal-700 mt-0.5">Standard terms</p>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Risk Level Definitions & Guide (As explicitly required by Section 4) */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-[#14B8A6]" />
          <h3 className="text-sm font-bold text-[#10213A] uppercase tracking-wider">
            What Do the Risk Levels Mean?
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* High Risk Definition */}
          <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 text-red-950">
            <div className="flex items-center gap-1.5 font-bold text-red-700 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>High Risk</span>
            </div>
            <p className="leading-relaxed">
              {RISK_DEFINITIONS['High Risk']}
            </p>
          </div>

          {/* Medium Risk Definition */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Medium Risk</span>
            </div>
            <p className="leading-relaxed">
              {RISK_DEFINITIONS['Medium Risk']}
            </p>
          </div>

          {/* Low Risk Definition */}
          <div className="p-3.5 rounded-xl bg-[#E6FFFA]/70 border border-teal-200 text-teal-950">
            <div className="flex items-center gap-1.5 font-bold text-teal-800 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>Low Risk</span>
            </div>
            <p className="leading-relaxed">
              {RISK_DEFINITIONS['Low Risk']}
            </p>
          </div>

          {/* Not Enough Information Definition */}
          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Not Enough Information</span>
            </div>
            <p className="leading-relaxed">
              {RISK_DEFINITIONS['Not Enough Information']}
            </p>
          </div>
        </div>

        {/* Preliminary notice reminder */}
        <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-[#64748B] leading-relaxed">
          <strong>Important Note:</strong> A clause is not automatically risky just because it appears in a legal contract or in a reference dataset. Risk ratings are preliminary and may depend on the complete agreement, the circumstances, and the applicable law.
        </div>
      </div>
    </div>
  );
};
