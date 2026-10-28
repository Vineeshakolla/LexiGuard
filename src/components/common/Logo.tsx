import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showSubtitle = false }) => {
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }[size];

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  }[size];

  return (
    <div className="flex items-center gap-3">
      {/* Shield and Scales-of-Justice SVG Logo */}
      <div
        className={`${iconDimensions} rounded-xl bg-gradient-to-br from-[#10213A] via-[#172F50] to-[#0f766e] flex items-center justify-center shadow-md shadow-[#10213A]/20 ring-1 ring-[#14B8A6]/40 shrink-0 relative overflow-hidden`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3/5 h-3/5 text-[#14B8A6]"
        >
          {/* Shield outline */}
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" className="stroke-[#14B8A6]" />
          {/* Scales of justice inside shield */}
          <path d="M12 7v7" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M8 9h8" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M8 9l-2 3.5h4L8 9z" stroke="#5eead4" strokeWidth="1.2" fill="rgba(20, 184, 166, 0.25)" />
          <path d="M16 9l-2 3.5h4L16 9z" stroke="#5eead4" strokeWidth="1.2" fill="rgba(20, 184, 166, 0.25)" />
          <circle cx="12" cy="15.5" r="1" fill="#ffffff" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`${titleSizes} font-bold tracking-tight text-[#10213A] font-['Inter']`}>
            Lexi<span className="text-[#14B8A6]">Guard</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#10213A]/5 text-[#172F50] border border-[#10213A]/10">
            Legal AI
          </span>
        </div>
        {showSubtitle && (
          <span className="text-xs text-[#64748B] font-medium tracking-normal mt-0.5">
            Understand the fine print. Protect your rights.
          </span>
        )}
      </div>
    </div>
  );
};
