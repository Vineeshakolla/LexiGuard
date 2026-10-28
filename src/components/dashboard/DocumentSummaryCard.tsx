import React, { useState } from 'react';
import { DocumentSummaryInfo, DocumentMeta } from '../../types/legal';
import { FileText, HelpCircle, CheckSquare, AlertTriangle, ListChecks, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface DocumentSummaryCardProps {
  summary: DocumentSummaryInfo;
  meta: DocumentMeta;
}

export const DocumentSummaryCard: React.FC<DocumentSummaryCardProps> = ({ summary, meta }) => {
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});

  const toggleCheck = (idx: number) => {
    setCheckedActions(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Section 1: What is this document about? (2-3 simple sentences)
  const whatIsThisAbout = summary.whatIsThisAbout || summary.primaryPurpose || summary.executiveSummary ||
    `This document is a ${summary.contractType || 'legal agreement'}. It sets out the rules, payment obligations, and responsibilities between the parties involved.`;

  // Section 2: What are you agreeing to? (Main responsibilities of each party)
  const whatAreYouAgreeingTo: string[] = Array.isArray(summary.whatAreYouAgreeingTo) && summary.whatAreYouAgreeingTo.length > 0
    ? summary.whatAreYouAgreeingTo
    : (summary.partiesOrScope
        ? [
            `Your obligations: ${summary.partiesOrScope}`,
            'Payment and renewal terms: Agreeing to pay the agreed fees and follow the cancellation procedures before deadlines.',
            'Service usage rules: Agreeing not to misuse the platform and granting necessary permissions to provide the service.'
          ]
        : [
            'Follow the terms and payment schedule stated in the agreement.',
            'Provide accurate information and use the services within the agreed limits.',
            'Give advance notice before cancelling or ending the agreement.'
          ]);

  // Section 3: What should you pay attention to? (Important concerns)
  const whatToPayAttentionTo: string[] = Array.isArray(summary.whatToPayAttentionTo) && summary.whatToPayAttentionTo.length > 0
    ? summary.whatToPayAttentionTo
    : [
        'Automatic renewal: Check whether your agreement renews on its own and when you must cancel to avoid charges.',
        'Cancellation and refunds: See if fees are non-refundable and what happens if you want to leave early.',
        'Dispute rules: Look for mandatory arbitration or limits that take away your right to go to a regular court.'
      ];

  // Section 4: What should you do before signing? (Checklist of practical actions)
  const whatToDoBeforeSigning: string[] = Array.isArray(summary.whatToDoBeforeSigning) && summary.whatToDoBeforeSigning.length > 0
    ? summary.whatToDoBeforeSigning
    : [
        'Write down key dates: Mark your cancellation deadline and payment schedule in your calendar.',
        'Clarify uncertain terms: Ask the other party in writing to explain any confusing fees or limits.',
        'Request mutual terms: If the other party can cancel easily, ask for the same right for yourself.',
        'Consult a qualified lawyer if the agreement involves significant money or long-term commitments.'
      ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
      {/* Top Header Banner */}
      <div className="bg-linear-to-r from-[#10213A] to-[#172F50] text-white p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-400/20 text-teal-300 flex items-center justify-center border border-teal-400/30 shrink-0">
              <FileText className="w-6 h-6 text-[#14B8A6]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-200 border border-teal-400/30">
                  Plain-English Summary
                </span>
                <span className="text-xs text-slate-300">Written for everyday readers</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {summary.contractType || 'Legal Agreement Overview'}
              </h2>
            </div>
          </div>

          {/* Document Metadata Badges */}
          <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-medium border border-white/15">
              {meta.inputSource === 'direct_text' ? 'Direct Text Input' : 'Uploaded File'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-mono border border-white/15 truncate max-w-[200px]">
              {meta.name}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-teal-200 border border-white/15">
              {meta.wordCount.toLocaleString()} words
            </span>
          </div>
        </div>

        {/* Reassurance Notice */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-start gap-2 text-xs text-teal-100/90">
          <Info className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
          <p>
            This summary explains the most important points in plain English before you review individual clauses below. No law degree required.
          </p>
        </div>
      </div>

      {/* 4 Simple Questions Grid */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. What is this document about? */}
          <div className="p-5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex flex-col">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#10213A] mb-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold shrink-0">
                1
              </span>
              <span className="text-sm font-bold text-[#10213A]">What is this document about?</span>
            </div>
            <p className="text-sm text-[#18283F] leading-relaxed font-normal">
              {whatIsThisAbout}
            </p>
          </div>

          {/* 2. What are you agreeing to? */}
          <div className="p-5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex flex-col">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#10213A] mb-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold shrink-0">
                2
              </span>
              <span className="text-sm font-bold text-[#10213A]">What are you agreeing to?</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#18283F] leading-relaxed">
              {whatAreYouAgreeingTo.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold shrink-0 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. What should you pay attention to? */}
          <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex flex-col">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900 mb-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold shrink-0">
                3
              </span>
              <span className="text-sm font-bold text-amber-950">What should you pay attention to?</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
              {whatToPayAttentionTo.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold shrink-0 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. What should you do before signing? */}
          <div className="p-5 rounded-xl bg-[#E6FFFA]/50 border border-teal-200 flex flex-col">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900 mb-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-200 text-teal-900 flex items-center justify-center text-xs font-bold shrink-0">
                4
              </span>
              <span className="text-sm font-bold text-teal-950">What should you do before signing?</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-teal-950 leading-relaxed font-medium">
              {whatToDoBeforeSigning.map((item, idx) => {
                const isChecked = !!checkedActions[idx];
                return (
                  <li
                    key={idx}
                    onClick={() => toggleCheck(idx)}
                    className="flex items-start gap-2.5 cursor-pointer select-none hover:text-teal-800 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(idx)}
                      className="mt-1 h-3.5 w-3.5 rounded text-[#14B8A6] focus:ring-teal-400 border-teal-300 cursor-pointer"
                    />
                    <span className={isChecked ? 'line-through opacity-70' : ''}>
                      {item}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
