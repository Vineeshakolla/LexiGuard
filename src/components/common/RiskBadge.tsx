import React from 'react';
import { RiskLevel } from '../../types/legal';
import { AlertTriangle, AlertCircle, ShieldCheck, HelpCircle } from 'lucide-react';

interface RiskBadgeProps {
  level: RiskLevel | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  score?: number;
  showDefinition?: boolean;
}

export const RISK_DEFINITIONS: Record<string, string> = {
  'High Risk': 'This clause could create a serious problem or significant financial or legal responsibility. Review it carefully before agreeing.',
  'Medium Risk': 'This clause could cause problems or confusion. Ask questions or consider requesting a change.',
  'Low Risk': 'No major concern was identified from the available text, but you should still understand the clause.',
  'Not Enough Information': 'There is not enough information to judge this clause reliably.',
};

export const normalizeRiskLabel = (level: string): 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Not Enough Information' => {
  const norm = (level || '').toLowerCase();
  if (norm.includes('not enough') || norm.includes('insufficient') || norm.includes('unknown') || norm.includes('unclear')) {
    return 'Not Enough Information';
  }
  if (norm.includes('high') || norm.includes('critical')) {
    return 'High Risk';
  }
  if (norm.includes('medium') || norm.includes('mod') || norm.includes('amber')) {
    return 'Medium Risk';
  }
  return 'Low Risk';
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  size = 'md',
  showIcon = true,
  score,
  showDefinition = false,
}) => {
  const normalized = normalizeRiskLabel(level);

  const configMap: Record<string, { label: string; bg: string; dot: string; icon: any }> = {
    'High Risk': {
      label: 'High Risk',
      bg: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-600',
      icon: AlertTriangle,
    },
    'Medium Risk': {
      label: 'Medium Risk',
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-500',
      icon: AlertCircle,
    },
    'Low Risk': {
      label: 'Low Risk',
      bg: 'bg-[#E6FFFA] text-teal-800 border-teal-200',
      dot: 'bg-[#14B8A6]',
      icon: ShieldCheck,
    },
    'Not Enough Information': {
      label: 'Not Enough Information',
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      dot: 'bg-slate-400',
      icon: HelpCircle,
    },
  };

  const config = configMap[normalized] || configMap['Low Risk'];
  const IconComponent = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const definition = RISK_DEFINITIONS[normalized];

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        title={definition}
        className={`inline-flex items-center rounded-full border shadow-xs ${config.bg} ${sizeClasses} whitespace-nowrap cursor-help`}
      >
        {showIcon && <IconComponent className={`${iconSizes} shrink-0`} />}
        <span>{config.label}</span>
        {score !== undefined && (
          <span className="opacity-80 text-[10px] ml-0.5 px-1.5 py-0.2 bg-black/5 rounded-full font-mono">
            {score}/100
          </span>
        )}
      </span>
      {showDefinition && (
        <span className="text-[11px] text-[#64748B] leading-tight max-w-xs">
          {definition}
        </span>
      )}
    </div>
  );
};
