import type { ProcessedReport, ProcessingStage } from '../types/medical';

// Frontend now delegates all steps to the backend /process endpoint.

export async function processReport(
  input: string | File,
  inputType: 'text' | 'image',
  setCurrentStage: (stage: ProcessingStage) => void
): Promise<ProcessedReport> {
  console.log('Starting report processing via backend /process:', { inputType, hasInput: !!input });
  setCurrentStage('ocr');

  try {
    const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8001';
    const form = new FormData();
    form.append('mode', inputType);
    if (inputType === 'image' && input instanceof File) {
      form.append('file', input);
    } else if (typeof input === 'string') {
      form.append('text', input);
    }
    // Advanced OCR options (if present on window), optional
    // Summary mode (rule | llm) if set by the UI
    const w = window as unknown as { __SUMMARY_MODE__?: 'rule' | 'llm' };
    if (w.__SUMMARY_MODE__) form.append('summary_mode', w.__SUMMARY_MODE__);

    const resp = await fetch(`${API_BASE}/process`, { method: 'POST', body: form });
    if (!resp.ok) {
      throw new Error(`Backend /process failed with status ${resp.status}`);
    }
    const data = await resp.json();

    // Map backend response directly to ProcessedReport (fields already aligned)
    const result: ProcessedReport = {
      tests: data.tests ?? [],
      summary: data.summary ?? '',
      explanations: data.explanations ?? [],
      status: data.status ?? 'unprocessed',
      reason: data.reason,
      ocr_confidence: data.ocr_confidence,
      normalization_confidence: data.normalization_confidence,
      ocr_text: data.extracted_text,
    };

    // Update stage indicators heuristically
    if (result.status === 'ok') {
      setCurrentStage('summary');
    } else {
      setCurrentStage('validation');
    }
    return result;
  } catch (error) {
    console.error('Backend processing failed:', error);
    return {
      tests: [],
      summary: '',
      status: 'unprocessed',
      reason: `processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}