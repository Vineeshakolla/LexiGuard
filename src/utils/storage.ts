import { AnalysisHistoryItem, AnalysisResult } from '../types/legal';

const STORAGE_KEY = 'lexiguard_analysis_history';

export function getSavedAnalyses(): AnalysisHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read LexiGuard history from localStorage:', e);
    return [];
  }
}

export function saveAnalysisToHistory(result: AnalysisResult): void {
  try {
    const history = getSavedAnalyses();
    // Check if already exists by ID
    const filtered = history.filter(item => item.id !== result.id);
    const newItem: AnalysisHistoryItem = {
      id: result.id,
      documentName: result.documentMeta.name,
      analyzedAt: result.analyzedAt,
      riskScore: result.overallAssessment.overallScore,
      riskLevel: result.overallAssessment.riskLevel || result.overallAssessment.riskLabel || 'Low Risk',
      riskLabel: result.overallAssessment.riskLevel || result.overallAssessment.riskLabel || 'Low Risk',
      contractType: result.documentSummary?.contractType || 'Legal Agreement',
      inputSource: result.documentMeta.inputSource || 'file',
      flaggedClausesCount: result.overallAssessment.highRiskCount + result.overallAssessment.criticalRiskCount,
      totalClauses: result.overallAssessment.totalClauses,
      result: result,
    };
    // Keep max 15 recent items
    const updated = [newItem, ...filtered].slice(0, 15);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save analysis to history:', e);
  }
}

export function deleteAnalysisFromHistory(id: string): AnalysisHistoryItem[] {
  try {
    const history = getSavedAnalyses();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete analysis from history:', e);
    return [];
  }
}

export function clearAllHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear history:', e);
  }
}
