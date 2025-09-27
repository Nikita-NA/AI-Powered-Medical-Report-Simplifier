export interface MedicalTest {
  name: string;
  value: number;
  unit: string;
  status: 'low' | 'normal' | 'high';
  ref_range: {
    low: number;
    high: number;
  };
}

export interface ProcessedReport {
  tests: MedicalTest[];
  summary: string;
  explanations?: string[];
  status: 'ok' | 'unprocessed';
  reason?: string;
  ocr_confidence?: number;
  normalization_confidence?: number;
  ocr_text?: string;
}

export interface OCRResult {
  tests_raw: string[];
  confidence: number;
  extracted_text: string;
}

export interface NormalizedTests {
  tests: MedicalTest[];
  normalization_confidence: number;
}

export interface PatientSummary {
  summary: string;
  explanations: string[];
}

export type ProcessingStage = 'ocr' | 'normalization' | 'summary' | 'validation';