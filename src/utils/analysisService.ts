import { AnalysisResult } from '../types/legal';

export interface AnalysisOptions {
  filename?: string;
  fileType?: string;
  fileSize?: number;
  contractTypeHint?: string;
}

/**
 * Shared analysis function used identically by both Direct Text Input and Document Upload (PDF, DOCX, TXT).
 * Ensures both input methods use the exact same AI pipeline, validation, response schema, and error handling.
 */
export async function analyzeLegalContent(
  text: string,
  source: 'direct_text' | 'file',
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  const trimmed = (text || '').trim();

  // Validate that the input is not empty
  if (!trimmed) {
    throw new Error('Submitted legal text is empty. Please enter or paste legal text or select a valid document.');
  }

  // Derive sensible default metadata
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const charCount = trimmed.length;
  const approxSizeBytes = options.fileSize || new Blob([trimmed]).size;

  let computedName = options.filename;
  if (!computedName) {
    if (source === 'direct_text') {
      computedName = options.contractTypeHint && options.contractTypeHint !== 'Auto-Detect from Content'
        ? `${options.contractTypeHint} (Direct Text)`
        : 'Direct Legal Text Snippet';
    } else {
      computedName = 'Uploaded_Legal_Document.pdf';
    }
  }

  const payload = {
    text: trimmed,
    filename: computedName,
    fileType: options.fileType || (source === 'direct_text' ? 'text/plain' : 'application/pdf'),
    fileSize: approxSizeBytes,
    inputSource: source,
    contractTypeHint: options.contractTypeHint && options.contractTypeHint !== 'Auto-Detect from Content'
      ? options.contractTypeHint
      : undefined
  };

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.error || `Analysis request failed with status ${response.status} (${response.statusText})`;
    throw new Error(message);
  }

  const result: AnalysisResult = await response.json();

  if (!result || !result.clauses || !Array.isArray(result.clauses)) {
    throw new Error('Invalid analysis result structure received from the server.');
  }

  return result;
}
