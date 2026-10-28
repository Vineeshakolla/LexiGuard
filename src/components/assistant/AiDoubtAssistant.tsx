import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  Trash2,
  Copy,
  Check,
  Code2,
  FileText,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { LegalClause, AnalysisResult } from '../../types/legal';

export interface AssistantMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  isAiPowered?: boolean;
  timestamp: string;
}

interface AiDoubtAssistantProps {
  currentClause?: LegalClause | null;
  analysisResult?: AnalysisResult | null;
  onClearActiveClause?: () => void;
  isOpenExternal?: boolean;
  onToggleExternal?: (open: boolean) => void;
}

const DEFAULT_WELCOME: AssistantMessageItem = {
  id: 'welcome-1',
  role: 'assistant',
  content: `### Welcome to LexiGuard AI Doubt Assistant! 🏛️

I can help explain contract terms in simple English, explain why specific clauses were classified into one of the **12 CUAD categories**, and clarify machine learning evaluation metrics.

**Try asking me:**
- *"Explain this clause in simple English"*
- *"Why was this clause classified this way?"*
- *"Why is this clause marked high risk?"*
- *"Explain the difference between clause category and contractual risk score"*
- *"Why was Linear SVM chosen over Logistic Regression, Naive Bayes, and KNN?"*
- *"How was the dataset preprocessed with zero document leakage?"*
- *"Explain precision, recall, and the confusion matrix"*
- *"What are the model limitations and biases?"*

*Feel free to toggle **Technical Mode** in the top bar for deep-dive mathematical and feature-weight explanations!*`,
  source: 'LexiGuard Knowledge Base',
  isAiPowered: false,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export const AiDoubtAssistant: React.FC<AiDoubtAssistantProps> = ({
  currentClause,
  analysisResult,
  onClearActiveClause,
  isOpenExternal,
  onToggleExternal
}) => {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : isOpenInternal;
  const setIsOpen = (val: boolean) => {
    if (onToggleExternal) onToggleExternal(val);
    else setIsOpenInternal(val);
  };

  const [messages, setMessages] = useState<AssistantMessageItem[]>([DEFAULT_WELCOME]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [technicalMode, setTechnicalMode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([DEFAULT_WELCOME]);
  };

  const sendMessage = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const newMsg: AssistantMessageItem = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...messages, newMsg];
    setMessages(nextMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const payloadContext = {
        selectedClause: currentClause
          ? {
              clauseNumber: currentClause.clauseNumber,
              title: currentClause.title,
              category: currentClause.category,
              mlPredictedCategory: currentClause.mlPredictedCategory,
              mlConfidence: currentClause.mlConfidence,
              mlTopFeatures: currentClause.mlTopFeatures,
              riskScore: currentClause.riskScore,
              riskLevel: currentClause.potentialRiskLabel || currentClause.riskLevel,
              exactQuotation: currentClause.whatDoesItSay || currentClause.exactQuotation,
              plainEnglish: currentClause.whatDoesThisMean || currentClause.plainEnglish,
              potentialConsequences: currentClause.howCouldThisAffectYou || currentClause.potentialConsequences,
              riskReason: currentClause.riskReason,
              suggestedRevision: currentClause.whatShouldYouDo || currentClause.suggestedRevision,
              questionsForLawyer: currentClause.questionsForLawyer,
              exampleIllustration: currentClause.exampleIllustration,
              sourceLocation: currentClause.sourceLocation
            }
          : undefined,
        currentDocument: analysisResult
          ? {
              filename: analysisResult.documentMeta?.name,
              contractType: analysisResult.documentSummary?.contractType,
              overallScore: analysisResult.overallAssessment?.overallScore,
              riskLevel: analysisResult.overallAssessment?.riskLevel,
              scoreExplanation: analysisResult.overallAssessment?.scoreExplanation,
              totalClauses: analysisResult.overallAssessment?.totalClauses || analysisResult.clauses?.length,
              highRiskCount: analysisResult.overallAssessment?.highRiskCount,
              mediumRiskCount: analysisResult.overallAssessment?.mediumRiskCount,
              lowRiskCount: analysisResult.overallAssessment?.lowRiskCount,
              criticalRiskCount: analysisResult.overallAssessment?.criticalRiskCount,
              scoreBreakdown: analysisResult.overallAssessment?.scoreBreakdown,
              clauses: analysisResult.clauses?.map(c => ({
                clauseNumber: c.clauseNumber,
                title: c.title,
                category: c.category,
                mlPredictedCategory: c.mlPredictedCategory,
                mlConfidence: c.mlConfidence,
                mlTopFeatures: c.mlTopFeatures,
                riskScore: c.riskScore,
                riskLevel: c.potentialRiskLabel || c.riskLevel,
                exactQuotation: c.whatDoesItSay || c.exactQuotation,
                plainEnglish: c.whatDoesThisMean || c.plainEnglish,
                potentialConsequences: c.howCouldThisAffectYou || c.potentialConsequences,
                riskReason: c.riskReason,
                suggestedRevision: c.whatShouldYouDo || c.suggestedRevision,
                questionsForLawyer: c.questionsForLawyer
              })),
              missingOrUnclearClauses: analysisResult.missingOrUnclearClauses?.map(m => ({
                title: m.title,
                severity: m.severity,
                description: m.description,
                potentialRisk: m.potentialRisk,
                suggestedAddition: m.suggestedAddition
              }))
            }
          : undefined,
        technicalMode
      };

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          context: payloadContext
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: AssistantMessageItem = {
        id: `assist-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'No response generated.',
        source: data.source || 'LexiGuard Knowledge Base',
        isAiPowered: data.isAiPowered || false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('AI Assistant error:', err);
      const errorMsg: AssistantMessageItem = {
        id: `assist-err-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an issue connecting to the inference engine. However, here is the verified knowledge base answer for common topics:\n\n- **Clause Category vs. Risk Score:** ML classifies grammatical legal topics (e.g. Limitation of Liability). Risk score (0-100) measures unfavorable exposure such as non-reciprocity or unlimited damages.\n- **Selected Algorithm:** Linear SVM (C=1.0) won the held-out benchmark with **77.3% accuracy** and **73.1% macro F1**.\n\nPlease check your server connection and try again.`,
        source: 'LexiGuard Offline Knowledge Base',
        isAiPowered: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Helper to render simple markdown formatted text
  const renderFormattedMarkdown = (raw: string) => {
    const lines = raw.split('\n');
    return (
      <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-slate-800">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          // Heading 3
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-sm font-bold text-[#10213A] pt-1 border-b border-slate-100 pb-1">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          // Heading 2
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-base font-bold text-[#10213A] pt-2 border-b border-slate-200 pb-1">
                {trimmed.replace('## ', '')}
              </h3>
            );
          }
          // Bullets
          if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const bulletText = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-teal-600 font-bold shrink-0">•</span>
                <span>{renderInlineBoldAndCode(bulletText)}</span>
              </div>
            );
          }
          // Numbered lists
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="font-semibold text-slate-700 font-mono text-[11px] shrink-0">{numMatch[1]}.</span>
                <span>{renderInlineBoldAndCode(numMatch[2])}</span>
              </div>
            );
          }

          return <p key={idx}>{renderInlineBoldAndCode(trimmed)}</p>;
        })}
      </div>
    );
  };

  const renderInlineBoldAndCode = (text: string) => {
    // Basic inline parser for **bold** and `code`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-teal-800 font-mono text-[11px] border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-[#10213A] text-white rounded-full shadow-2xl hover:bg-slate-900 border border-teal-500/30 hover:scale-[1.02] transition-all cursor-pointer group"
          aria-label="Open AI Doubt Assistant"
        >
          <div className="relative">
            <span className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/40 group-hover:bg-teal-500/30 transition-colors">
              <Sparkles className="w-4 h-4 text-teal-300 animate-pulse" />
            </span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#10213A]" />
          </div>
          <div className="text-left hidden sm:block pr-1">
            <div className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>AI Doubt Assistant</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-teal-500/30 text-teal-200 uppercase font-semibold">
                Online
              </span>
            </div>
            <div className="text-[10px] text-slate-300">
              {currentClause ? `Ready on Clause #${currentClause.clauseNumber}` : 'Ask any legal or ML question'}
            </div>
          </div>
        </button>
      )}

      {/* Responsive Conversation Window */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-200 flex flex-col bg-white shadow-2xl border border-slate-200 overflow-hidden ${
            isExpanded
              ? 'inset-4 sm:inset-10 rounded-2xl'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[95vw] sm:w-[470px] h-[640px] max-h-[88vh] rounded-2xl'
          }`}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-[#10213A] text-white flex items-center justify-between shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30">
                <Sparkles className="w-4 h-4 text-teal-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight text-white">
                    LexiGuard AI Doubt Assistant
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Grounded
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">
                  Legal Clause & ML Explanations
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1.5">
              {/* Technical Mode Toggle */}
              <button
                type="button"
                onClick={() => setTechnicalMode(!technicalMode)}
                className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer border ${
                  technicalMode
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-white/10 text-slate-300 border-white/20 hover:text-white hover:bg-white/20'
                }`}
                title="Toggle between layperson explanations and technical ML terminology"
              >
                <Code2 className="w-3 h-3" />
                <span className="hidden sm:inline">Technical:</span>
                <span className="font-bold">{technicalMode ? 'ON' : 'OFF'}</span>
              </button>

              {/* Clear History */}
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Expand / Minimize */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:block p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={isExpanded ? 'Restore window size' : 'Expand window'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Context Bar (when a clause is selected) */}
          {currentClause && (
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs gap-2 shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-teal-100 text-teal-800 border border-teal-200">
                  #{currentClause.clauseNumber}
                </span>
                <span className="font-semibold text-slate-800 truncate" title={currentClause.title}>
                  {currentClause.title}
                </span>
                <span className="text-slate-400 text-[10px] hidden sm:inline">
                  ({currentClause.category})
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => sendMessage(`Explain Clause #${currentClause.clauseNumber} (${currentClause.title}) in simple English.`)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer"
                >
                  Explain
                </button>
                {onClearActiveClause && (
                  <button
                    type="button"
                    onClick={onClearActiveClause}
                    className="p-0.5 text-slate-400 hover:text-slate-600"
                    title="Deselect clause"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Query Suggestion Chips */}
          <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-amber-500" /> Prompts:
            </span>
            {[
              'Explain this clause',
              'Why this category?',
              'Why high risk?',
              'Category vs Risk Score',
              'Why Linear SVM?',
              'Zero-leakage split',
              'Precision & Recall',
              'Model Limitations'
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  let prompt = chip;
                  if (chip === 'Explain this clause') {
                    prompt = currentClause
                      ? `Explain Clause #${currentClause.clauseNumber} (${currentClause.title}) in simple English.`
                      : 'Explain this clause in simple English.';
                  } else if (chip === 'Why this category?') {
                    prompt = 'Why was this clause classified this way? What features contributed?';
                  } else if (chip === 'Why high risk?') {
                    prompt = 'Why is this clause marked high risk, and what are the specific hazards?';
                  } else if (chip === 'Category vs Risk Score') {
                    prompt = 'Explain the difference between clause category and contractual risk score.';
                  } else if (chip === 'Why Linear SVM?') {
                    prompt = 'Why was Linear SVM selected over Logistic Regression, Naive Bayes, and KNN?';
                  } else if (chip === 'Zero-leakage split') {
                    prompt = 'How was the dataset preprocessed with zero contract leakage?';
                  } else if (chip === 'Precision & Recall') {
                    prompt = 'Explain accuracy, precision, recall, and the confusion matrix.';
                  } else if (chip === 'Model Limitations') {
                    prompt = 'What are the dataset biases, minority class weaknesses, and model limitations?';
                  }
                  sendMessage(prompt);
                }}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 text-[11px] font-medium whitespace-nowrap border border-slate-200 transition-colors cursor-pointer shrink-0"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs border relative group ${
                    msg.role === 'user'
                      ? 'bg-[#10213A] text-white border-slate-800 rounded-tr-xs'
                      : 'bg-white text-slate-800 border-slate-200 rounded-tl-xs'
                  }`}
                >
                  {/* Role Header for Assistant */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-[#10213A]">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        <span>LexiGuard Assistant</span>
                        {msg.isAiPowered ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-50 text-purple-700 border border-purple-200 font-normal">
                            Gemini 2.5 Flash
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-teal-50 text-teal-700 border border-teal-200 font-normal">
                            Grounded Rules
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <span className="flex items-center gap-1 text-[10px] text-teal-600 font-medium">
                            <Check className="w-3 h-3" /> Copied
                          </span>
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Message Content */}
                  {msg.role === 'user' ? (
                    <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    renderFormattedMarkdown(msg.content)
                  )}

                  {/* Timestamp & Source */}
                  <div className={`mt-2 flex items-center justify-between text-[10px] ${msg.role === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                    <span>{msg.timestamp}</span>
                    {msg.source && <span className="italic">{msg.source}</span>}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3.5 shadow-xs max-w-[80%] flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center animate-spin">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold">Consulting legal & ML knowledge base...</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Grounding response in CUAD dataset statistics and evaluation results.</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    currentClause
                      ? `Ask a doubt about Clause #${currentClause.clauseNumber} or any ML metric...`
                      : 'Ask any question about clauses, risk, dataset, SVM model, or metrics...'
                  }
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 leading-snug"
                />
                <span className="absolute right-2 bottom-1.5 text-[9px] text-slate-400 pointer-events-none hidden sm:inline">
                  Enter ↵ to send
                </span>
              </div>
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="h-10 px-3.5 bg-teal-600 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>

            {/* Informational Disclaimer Footer */}
            <p className="mt-2 text-[10px] text-slate-400 text-center leading-tight">
              Educational & assistive analysis only. Not formal legal counsel. ML classification is strictly separated from contractual risk evaluation.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
