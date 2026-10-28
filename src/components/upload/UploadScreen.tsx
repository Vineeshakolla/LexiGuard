import React, { useState, useRef, DragEvent } from 'react';
import { Logo } from '../common/Logo';
import { processDocumentFile, formatBytes, ExtractedDocument } from '../../utils/documentProcessor';
import {
  UploadCloud,
  FileText,
  FileCheck,
  X,
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Type,
  Trash2,
  ClipboardPaste,
  Sparkles,
  Database
} from 'lucide-react';

interface UploadScreenProps {
  onAnalyze: (document: ExtractedDocument) => void;
  isLoading: boolean;
  initialText?: string;
  initialContractType?: string;
  initialTab?: 'upload' | 'paste';
  errorMessage?: string | null;
  onClearError?: () => void;
  onOpenDatasetModal?: () => void;
}

const CONTRACT_TYPE_OPTIONS = [
  'Auto-Detect from Content',
  'Rental Agreement / Residential Lease',
  'Employment Contract',
  'Non-Disclosure Agreement (NDA)',
  'Service Agreement / Terms of Service',
  'Independent Contractor Agreement',
  'Subscription & Billing Agreement',
  'Other / Single Legal Clause'
];

const QUICK_TEST_CLAUSES = [
  {
    label: 'Arbitration Clause',
    text: `SECTION 14. MANDATORY BINDING ARBITRATION AND CLASS ACTION WAIVER.
All claims and disputes arising out of or relating to this Agreement or the use of the Service shall be settled solely by final and binding individual arbitration administered by the American Arbitration Association. YOU HEREBY WAIVE YOUR CONSTITUTIONAL RIGHT TO A JURY TRIAL IN COURT. YOU AND THE COMPANY AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.`
  },
  {
    label: 'Non-Compete Clause',
    text: `NON-COMPETITION AND NON-SOLICITATION RESTRICTION.
During the Employee's employment and for a period of twenty-four (24) months following termination of employment for any reason, Employee shall not directly or indirectly engage in, manage, operate, join, acquire, or hold any financial interest in any business enterprise that competes directly or indirectly with the Employer within the entire United States.`
  },
  {
    label: 'Auto-Renewal Clause',
    text: `SUBSCRIPTION AUTOMATIC RENEWAL AND PAYMENT AUTHORIZATION.
Your subscription membership will automatically renew for successive monthly billing cycles at the then-current non-discounted rate unless you notify the Company in writing at least seventy-two (72) hours prior to the conclusion of the active period. ALL PRE-AUTHORIZED PAYMENTS ARE STRICTLY NON-REFUNDABLE AND NO PRO-RATED CREDITS WILL BE ISSUED.`
  },
  {
    label: 'Limitation of Liability',
    text: `LIMITATION OF LIABILITY AND EXCLUSION OF DAMAGES.
IN NO EVENT SHALL THE COMPANY, ITS AFFILIATES, OFFICERS, OR AGENTS BE LIABLE TO YOU FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. THE COMPANY'S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT SHALL BE STRICTLY LIMITED TO THE LESSER OF $50 OR THE TOTAL AMOUNTS ACTUALLY PAID BY YOU IN THE PRECEDING THREE (3) MONTHS.`
  }
];

export const UploadScreen: React.FC<UploadScreenProps> = ({
  onAnalyze,
  isLoading,
  initialText = '',
  initialContractType = 'Auto-Detect from Content',
  initialTab,
  errorMessage,
  onClearError,
  onOpenDatasetModal
}) => {
  // Input method tabs: 'upload' | 'paste'
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>(
    initialTab || (initialText ? 'paste' : 'upload')
  );

  // Tab A: File Upload State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedFileDoc, setExtractedFileDoc] = useState<ExtractedDocument | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileErrorMessage, setFileErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab B: Direct Text Input State
  const [pastedText, setPastedText] = useState<string>(initialText);
  const [selectedContractType, setSelectedContractType] = useState<string>(initialContractType);

  // Computed metrics for pasted text - updated on every single keystroke
  const trimmedText = pastedText.trim();
  const charCount = pastedText.length;
  const wordCount = trimmedText ? trimmedText.split(/\s+/).filter(Boolean).length : 0;
  const isTextValid = trimmedText.length >= 10 && wordCount >= 2;

  // Drag and Drop handlers for Tab A
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = async (file: File) => {
    setFileErrorMessage(null);
    if (onClearError) onClearError();
    setSelectedFile(file);
    setIsProcessingFile(true);

    try {
      const extracted = await processDocumentFile(file);
      extracted.inputSource = 'file';
      setExtractedFileDoc(extracted);

      if (extracted.isScanned) {
        setFileErrorMessage(
          extracted.warning ||
            'Scanned PDF detected. No selectable digital text was found. Optical Character Recognition (OCR) or a searchable document is required.'
        );
      }
    } catch (err: any) {
      setFileErrorMessage(err.message || 'Error processing the selected file.');
      setExtractedFileDoc(null);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setExtractedFileDoc(null);
    setFileErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearText = () => {
    setPastedText('');
    if (onClearError) onClearError();
  };

  const handleInsertQuickClause = (clauseText: string) => {
    setPastedText(clauseText);
    if (onClearError) onClearError();
  };

  // Primary action button handler - passes actual input text directly to parent
  const handleTriggerAnalyze = () => {
    if (onClearError) onClearError();

    if (activeTab === 'upload') {
      if (extractedFileDoc && extractedFileDoc.text.trim() && !extractedFileDoc.isScanned) {
        onAnalyze(extractedFileDoc);
      }
    } else {
      if (isTextValid) {
        const contractHint =
          selectedContractType !== 'Auto-Detect from Content' ? selectedContractType : undefined;

        // Browser-safe byte length calculation using Blob
        const byteSize = new Blob([trimmedText]).size;

        const directDoc: ExtractedDocument = {
          text: trimmedText,
          filename: contractHint ? `${contractHint} (Direct Text)` : 'Direct Legal Text Snippet',
          fileSize: byteSize,
          fileType: 'text/plain',
          charCount: trimmedText.length,
          wordCount,
          inputSource: 'direct_text',
          contractTypeHint: contractHint
        };
        onAnalyze(directDoc);
      }
    }
  };

  // Determine if Analyze button is disabled
  const isAnalyzeDisabled =
    isLoading ||
    (activeTab === 'upload'
      ? !extractedFileDoc || !extractedFileDoc.text.trim() || isProcessingFile || !!extractedFileDoc.isScanned
      : !isTextValid);

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-between selection:bg-[#14B8A6]/20">
      {/* Top Header: Brand and Dataset status */}
      <header className="w-full max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
        <Logo size="md" />
        <div className="flex items-center gap-2">
          {onOpenDatasetModal && (
            <button
              type="button"
              onClick={onOpenDatasetModal}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#10213A] bg-white hover:bg-slate-50 hover:text-indigo-900 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>AOK Dataset &amp; Metrics</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-[#64748B] bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Local Privacy</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl mx-auto">
          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-[#10213A]/5 border border-slate-200/90 p-6 sm:p-8 relative">
            {/* Header Titles */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Trained ML Pipeline · 4 Evaluated Models · Zero Document Leakage</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#10213A] tracking-tight">
                Analyze Legal Content
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[#64748B] font-medium">
                Identify hidden risks, one-sided terms, and plain-English translations
              </p>
            </div>

            {/* Error Banner if parent reported analysis error */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start justify-between gap-3 animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Analysis Could Not Complete</p>
                    <p className="mt-0.5 leading-relaxed text-red-800">{errorMessage}</p>
                  </div>
                </div>
                {onClearError && (
                  <button
                    type="button"
                    onClick={onClearError}
                    className="text-red-500 hover:text-red-800 p-1 rounded-md"
                    title="Dismiss error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Two Input Method Tabs: Upload Document | Enter or Paste Text */}
            <div className="flex p-1 bg-slate-100/90 rounded-xl mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-white text-[#10213A] shadow-sm'
                    : 'text-[#64748B] hover:text-[#10213A]'
                }`}
              >
                <UploadCloud className={`w-4 h-4 ${activeTab === 'upload' ? 'text-[#14B8A6]' : 'text-slate-400'}`} />
                <span>Upload Document</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'paste'
                    ? 'bg-white text-[#10213A] shadow-sm'
                    : 'text-[#64748B] hover:text-[#10213A]'
                }`}
              >
                <Type className={`w-4 h-4 ${activeTab === 'paste' ? 'text-[#14B8A6]' : 'text-slate-400'}`} />
                <span>Enter or Paste Text</span>
              </button>
            </div>

            {/* TAB A: UPLOAD DOCUMENT */}
            {activeTab === 'upload' && (
              <div>
                {!extractedFileDoc ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group cursor-pointer rounded-xl border-2 border-dashed p-8 sm:p-10 text-center transition-all duration-200 flex flex-col items-center justify-center ${
                      dragActive
                        ? 'border-[#14B8A6] bg-[#E6FFFA]/50 scale-[1.01]'
                        : 'border-slate-300 hover:border-[#14B8A6] bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />

                    <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#14B8A6] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200 border border-teal-100">
                      <UploadCloud className="w-7 h-7 text-[#14B8A6]" />
                    </div>

                    <p className="text-base font-semibold text-[#18283F] group-hover:text-[#10213A]">
                      Drop your legal document here
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      or click to browse files from your computer
                    </p>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="mt-5 px-5 py-2 text-xs font-bold text-[#10213A] bg-white border border-slate-300 hover:border-[#14B8A6] hover:text-[#0f766e] rounded-xl shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-[#14B8A6]" />
                      <span>Browse Files</span>
                    </button>

                    <div className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-[#64748B]">
                      <span>Supported formats:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[#172F50] border border-slate-200">PDF</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[#172F50] border border-slate-200">DOCX</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[#172F50] border border-slate-200">TXT</span>
                    </div>

                    <p className="mt-2 text-[11px] text-slate-500 max-w-sm text-center leading-normal">
                      Requires digital selectable text. Scanned image-only PDFs require Optical Character Recognition (OCR) before upload.
                    </p>
                  </div>
                ) : (
                  /* Extracted file review card */
                  <div className="rounded-xl border border-teal-200 bg-[#E6FFFA]/40 p-5 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[#14B8A6]/20 text-[#0f766e] flex items-center justify-center shrink-0 border border-[#14B8A6]/30">
                          <FileCheck className="w-5 h-5 text-[#14B8A6]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#10213A] truncate font-mono">
                            {extractedFileDoc.filename}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#64748B]">
                            <span className="font-semibold text-[#172F50] uppercase">
                              {extractedFileDoc.fileType.includes('pdf') ? 'PDF' : extractedFileDoc.fileType.includes('word') ? 'DOCX' : 'TXT'}
                            </span>
                            <span>•</span>
                            <span>{formatBytes(extractedFileDoc.fileSize)}</span>
                            <span>•</span>
                            <span className="text-teal-800 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-[#14B8A6]" />
                              {extractedFileDoc.wordCount.toLocaleString()} words extracted
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {isProcessingFile && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-[#14B8A6]">
                        <div className="w-3 h-3 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin" />
                        <span>Extracting text from document...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* File Error Notice */}
                {fileErrorMessage && (
                  <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Text Extraction Notice</p>
                      <p className="mt-0.5 leading-relaxed">{fileErrorMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB B: ENTER OR PASTE TEXT */}
            {activeTab === 'paste' && (
              <div className="space-y-4">
                {/* Optional Contract-Type Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label htmlFor="contract-type-select" className="text-xs font-semibold text-[#172F50]">
                    Contract Classification (Optional):
                  </label>
                  <select
                    id="contract-type-select"
                    value={selectedContractType}
                    onChange={(e) => setSelectedContractType(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-[#18283F] focus:outline-none focus:ring-1 focus:ring-[#14B8A6] cursor-pointer"
                  >
                    {CONTRACT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Large Resizable Textarea with exact requested placeholder */}
                <div className="relative">
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste or type your legal document here…"
                    className="w-full p-4 text-xs sm:text-sm bg-slate-50/70 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/40 focus:border-[#14B8A6] font-mono leading-relaxed resize-y transition-all min-h-[180px]"
                  />

                  {/* Clear Text button in corner */}
                  {pastedText.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearText}
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-white/90 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-red-600 text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      title="Clear Text"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Text</span>
                    </button>
                  )}
                </div>

                {/* Live Counters & Validation Feedback Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 text-[#64748B]">
                    <span className="font-medium">
                      Words: <strong className="text-[#10213A]">{wordCount.toLocaleString()}</strong>
                    </span>
                    <span>•</span>
                    <span className="font-medium">
                      Characters: <strong className="text-[#10213A]">{charCount.toLocaleString()}</strong>
                    </span>
                  </div>

                  {/* Validation message if text is empty or too short */}
                  {charCount === 0 ? (
                    <span className="text-slate-500 font-medium text-[11px] flex items-center gap-1">
                      <span>Enter or paste legal text to begin analysis</span>
                    </span>
                  ) : !isTextValid ? (
                    <span className="text-amber-700 font-medium text-[11px] flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Minimum 10 characters / 2 words required</span>
                    </span>
                  ) : (
                    <span className="text-teal-700 font-medium text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span>Ready for legal analysis</span>
                    </span>
                  )}
                </div>

                {/* Quick Insert Sample Clauses (For instant testing without copying files) */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                      <ClipboardPaste className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span>Quick Test Clauses (or type your own above):</span>
                    </div>
                    {pastedText.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearText}
                        className="text-[11px] text-slate-400 hover:text-red-600 font-medium"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TEST_CLAUSES.map((snippet) => (
                      <button
                        key={snippet.label}
                        type="button"
                        onClick={() => handleInsertQuickClause(snippet.text)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 border border-slate-200 text-[#172F50] text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        + {snippet.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Notice */}
            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#64748B]">
              <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
              <span>Your legal content is analyzed securely and never stored or shared.</span>
            </div>

            {/* Primary Action Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={handleTriggerAnalyze}
                disabled={isAnalyzeDisabled}
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                  isAnalyzeDisabled
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-[#14B8A6] hover:bg-[#0f766e] text-white shadow-teal-500/20 hover:shadow-md cursor-pointer'
                }`}
              >
                <span>{activeTab === 'paste' ? 'Analyze Text' : 'Analyze Legal Document'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto px-6 py-6 text-center text-xs text-[#64748B] space-y-1">
        <p>LexiGuard provides automated legal clause classification and preliminary risk evaluation for informational review only.</p>
        <p className="text-slate-500 font-medium">Not legal advice · Does not create an attorney-client relationship · Consult licensed counsel for binding legal decisions.</p>
      </footer>
    </div>
  );
};
