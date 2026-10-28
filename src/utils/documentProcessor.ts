import mammoth from 'mammoth';

export interface ExtractedDocument {
  text: string;
  filename: string;
  fileSize: number;
  fileType: string;
  charCount: number;
  wordCount: number;
  isScanned?: boolean;
  warning?: string;
  inputSource?: 'file' | 'direct_text';
  contractTypeHint?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function processDocumentFile(file: File): Promise<ExtractedDocument> {
  const filename = file.name;
  const fileSize = file.size;
  const fileType = file.type || '';
  const lowerName = filename.toLowerCase();

  // Maximum allowed file size: 25MB
  if (fileSize > 25 * 1024 * 1024) {
    throw new Error('File exceeds the 25MB limit. Please upload a smaller document.');
  }

  // 1. Plain text / Markdown
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || fileType.startsWith('text/')) {
    const text = await file.text();
    if (!text.trim()) {
      throw new Error('The text file appears to be empty.');
    }
    return {
      text,
      filename,
      fileSize,
      fileType: 'text/plain',
      charCount: text.length,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length
    };
  }

  // 2. DOCX
  if (lowerName.endsWith('.docx') || fileType.includes('wordprocessingml')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || '';
      if (!text.trim()) {
        throw new Error('Could not extract text from this Word document. It may be empty or password-protected.');
      }
      return {
        text,
        filename,
        fileSize,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        charCount: text.length,
        wordCount: text.trim().split(/\s+/).filter(Boolean).length
      };
    } catch (err: any) {
      console.warn('Local docx extraction failed, trying backend...', err);
    }
  }

  // 3. PDF or backend fallback for binary files
  const base64Data = await fileToBase64(file);
  const response = await fetch('/api/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Data,
      filename,
      fileType
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to extract text from ${filename}`);
  }

  const data = await response.json();

  if (data.isScanned) {
    return {
      text: '',
      filename,
      fileSize,
      fileType: 'application/pdf',
      charCount: 0,
      wordCount: 0,
      isScanned: true,
      warning: data.warning || 'Scanned document detected. Optical Character Recognition (OCR) is required.'
    };
  }

  if (!data.text || !data.text.trim()) {
    throw new Error('No readable text could be extracted from this document. It may be an image-only or scanned PDF.');
  }

  return {
    text: data.text,
    filename,
    fileSize,
    fileType: fileType || 'application/pdf',
    charCount: data.charCount || data.text.length,
    wordCount: data.wordCount || data.text.trim().split(/\s+/).filter(Boolean).length
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data:...;base64, prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}
