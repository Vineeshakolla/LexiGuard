/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UploadScreen } from './components/upload/UploadScreen';
import { AnalysisProgress } from './components/analysis/AnalysisProgress';
import { DatasetStatusModal } from './components/dataset/DatasetStatusModal';
import { AiDoubtAssistant } from './components/assistant/AiDoubtAssistant';
import { ExtractedDocument } from './utils/documentProcessor';
import { AnalysisResult, AnalysisHistoryItem, LegalClause } from './types/legal';
import {
  getSavedAnalyses,
  saveAnalysisToHistory,
  deleteAnalysisFromHistory,
  clearAllHistory
} from './utils/storage';

const ResultsDashboard = React.lazy(() =>
  import('./components/dashboard/ResultsDashboard').then(module => ({
    default: module.ResultsDashboard,
  }))
);

export default function App() {
  // Two-Stage Dashboard state: 'upload' -> 'analyzing' -> 'results'
  const [currentStage, setCurrentStage] = useState<'upload' | 'analyzing' | 'results'>('upload');
  const [analyzingFilename, setAnalyzingFilename] = useState<string>('');
  const [currentDoc, setCurrentDoc] = useState<ExtractedDocument | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState<boolean>(false);
  const [activeClauseForAssistant, setActiveClauseForAssistant] = useState<LegalClause | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);

  // Load history from localStorage on mount
  useEffect(() => {
    setHistoryItems(getSavedAnalyses());
  }, []);

  // Triggered when user clicks "Analyze Document" in Stage 1
  const handleStartAnalysis = async (doc: ExtractedDocument) => {
    setCurrentDoc(doc);
    setAnalyzingFilename(doc.filename);
    setAnalysisError(null);
    setCurrentStage('analyzing');

    try {
      // Run API call to backend /api/analyze
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: doc.text,
          filename: doc.filename,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          inputSource: doc.inputSource || 'file',
          contractTypeHint: doc.contractTypeHint
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to analyze document.');
      }

      const result: AnalysisResult = await response.json();

      // Brief grace period so user catches the final stage checkmark
      setTimeout(() => {
        setAnalysisResult(result);
        saveAnalysisToHistory(result);
        setHistoryItems(getSavedAnalyses());
        setCurrentStage('results');
      }, 800);
    } catch (err: any) {
      console.error('Error during analysis:', err);
      setAnalysisError(err.message || 'An error occurred while analyzing the document.');
      setCurrentStage('upload');
    }
  };

  // Triggered when user clicks "Analyze Another Document" in Results Dashboard
  const handleResetToUpload = () => {
    setAnalysisResult(null);
    setAnalyzingFilename('');
    setAnalysisError(null);
    setCurrentStage('upload');
  };

  // Reopen a saved analysis from history
  const handleOpenHistoryItem = (item: AnalysisHistoryItem) => {
    setAnalysisResult(item.result);
    setCurrentStage('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete a history entry
  const handleDeleteHistoryItem = (id: string) => {
    const updated = deleteAnalysisFromHistory(id);
    setHistoryItems(updated);
  };

  // Clear all history
  const handleClearAllHistory = () => {
    clearAllHistory();
    setHistoryItems([]);
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-[#18283F] font-['Inter'] antialiased">
      {/* Stage 1: Initial Input Screen (Upload Document or Enter/Paste Text) */}
      {currentStage === 'upload' && (
        <UploadScreen
          onAnalyze={handleStartAnalysis}
          isLoading={false}
          initialText={currentDoc?.inputSource === 'direct_text' ? currentDoc.text : ''}
          initialContractType={currentDoc?.contractTypeHint || 'Auto-Detect from Content'}
          initialTab={currentDoc?.inputSource === 'direct_text' ? 'paste' : 'upload'}
          errorMessage={analysisError}
          onClearError={() => setAnalysisError(null)}
          onOpenDatasetModal={() => setIsDatasetModalOpen(true)}
        />
      )}

      {/* Loading Animation during analysis */}
      {currentStage === 'analyzing' && (
        <AnalysisProgress filename={analyzingFilename} />
      )}

      {/* Stage 2: Analysis Results Dashboard */}
      {currentStage === 'results' && analysisResult && (
        <React.Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center" role="status">
              Loading analysis results…
            </div>
          }
        >
          <ResultsDashboard
            result={analysisResult}
            onReset={handleResetToUpload}
            onAnalyzeAgain={() => {
              if (currentDoc) {
                handleStartAnalysis(currentDoc);
              }
            }}
            historyItems={historyItems}
            onOpenHistoryItem={handleOpenHistoryItem}
            onDeleteHistoryItem={handleDeleteHistoryItem}
            onClearAllHistory={handleClearAllHistory}
            onOpenDatasetModal={() => setIsDatasetModalOpen(true)}
            onAskAssistant={(clause) => {
              setActiveClauseForAssistant(clause);
              setIsAssistantOpen(true);
            }}
          />
        </React.Suspense>
      )}

      {/* Atticus Open Contract Dataset (AOK Beta) Status & Benchmark Modal */}
      <DatasetStatusModal
        isOpen={isDatasetModalOpen}
        onClose={() => setIsDatasetModalOpen(false)}
      />

      {/* Interactive AI Doubt Assistant (Always accessible via floating launcher) */}
      <AiDoubtAssistant
        currentClause={activeClauseForAssistant}
        analysisResult={analysisResult}
        onClearActiveClause={() => setActiveClauseForAssistant(null)}
        isOpenExternal={isAssistantOpen}
        onToggleExternal={setIsAssistantOpen}
      />
    </div>
  );
}
