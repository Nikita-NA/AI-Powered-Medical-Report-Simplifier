import { useState } from 'react';
import { FileText, Brain, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { ProcessingStep } from './components/ProcessingStep';
import { TestResults } from './components/TestResults';
import { PatientSummary } from './components/PatientSummary';
import { ImageUpload } from './components/ImageUpload';
import { processReport } from './services/reportProcessor';
import type { ProcessedReport, ProcessingStage } from './types/medical';

function App() {
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState<'text' | 'image'>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<ProcessingStage | null>(null);
  const [result, setResult] = useState<ProcessedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<'rule' | 'llm'>('rule');
  // Removed HF ping; backend is now local FastAPI

  const handleProcess = async () => {
    if (inputType === 'text' && !inputText.trim()) return;
    if (inputType === 'image' && !selectedFile && !inputText.trim()) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // In image mode, prioritize the uploaded file when present. Only use textarea text if no file selected.
      const input = inputType === 'image'
        ? (selectedFile ?? inputText)
        : inputText;
      // Expose summary mode for the service call
      (window as unknown as { __SUMMARY_MODE__?: 'rule' | 'llm' }).__SUMMARY_MODE__ = summaryMode;
      const processedResult = await processReport(input, inputType, setCurrentStage);
      setResult(processedResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
      setCurrentStage(null);
    }
  };

  const loadSampleData = () => {
    setInputText('CBC: Hemoglobin 10.2 g/dL (Low), WBC 11,200 /uL (High)\nLipid Panel: Total Cholesterol 220 mg/dL (High), HDL 35 mg/dL (Low)\nBasic Metabolic: Glucose 95 mg/dL (Normal), Creatinine 1.1 mg/dL (Normal)');
  };

  const loadOCRSample = () => {
    setInputText('CBC: Hemglobin 10.2 g/dL (Low)\nWBC 11200 /uL (Hgh)\nLipd Panel: Totl Cholesterol 220 mg/dL (Hgh)');
    setInputType('image');
    setSelectedFile(null);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setInputText(''); // Clear text input when file is selected
  };

  const handleInputTypeChange = (type: 'text' | 'image') => {
    setInputType(type);
    setSelectedFile(null);
    setInputText('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Brain className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">AI Medical Report Simplifier</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Transform complex medical reports into clear, patient-friendly explanations with AI-powered OCR processing and intelligent normalization
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-blue-600" />
                Medical Report Input
              </h2>

              {/* Input Type Selection */}
              <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleInputTypeChange('text')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    inputType === 'text'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Direct Text
                </button>
                <button
                  onClick={() => handleInputTypeChange('image')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    inputType === 'image'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Image Upload
                </button>
              </div>

              {inputType === 'text' ? (
                <div className="space-y-4">
                  {/* Summary mode selector */}
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="text-sm font-medium text-gray-700 mb-2">Summary Mode</div>
                    <div className="flex items-center gap-4 text-sm text-gray-700">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="summary-mode" value="rule" checked={summaryMode === 'rule'} onChange={() => setSummaryMode('rule')} />
                        Rule-based
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="summary-mode" value="llm" checked={summaryMode === 'llm'} onChange={() => setSummaryMode('llm')} />
                        LLM (Ollama)
                      </label>
                    </div>
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste raw text here..."
                    className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary mode selector */}
                  <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="text-sm font-medium text-gray-700 mb-2">Summary Mode</div>
                    <div className="flex items-center gap-4 text-sm text-gray-700">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="summary-mode" value="rule" checked={summaryMode === 'rule'} onChange={() => setSummaryMode('rule')} />
                        Rule-based
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="summary-mode" value="llm" checked={summaryMode === 'llm'} onChange={() => setSummaryMode('llm')} />
                        LLM (Ollama)
                      </label>
                    </div>
                  </div>
                  <ImageUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
                  {selectedFile && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                        <span className="text-sm text-green-800">
                          Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Advanced OCR Panel removed per request */}
                  <div className="text-center text-sm text-gray-500">
                    Or simulate OCR processing with sample text:
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Simulate OCR text with typos...\n\nExample:\nCBC: Hemglobin 10.2 g/dL (Low)\nWBC 11200 /uL (Hgh)"
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={loadSampleData}
                  className="px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Load Sample Report
                </button>
                <button
                  onClick={loadOCRSample}
                  className="px-4 py-2 text-sm text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  Load OCR Sample
                </button>
              </div>

              <button
                onClick={handleProcess}
                disabled={
                  isProcessing || 
                  (inputType === 'text' && !inputText.trim()) ||
                  (inputType === 'image' && !selectedFile && !inputText.trim())
                }
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    Process Report
                  </>
                )}
              </button>
            </div>

            {/* Processing Steps */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                Processing Pipeline
              </h2>

              <div className="space-y-4">
                <ProcessingStep
                  title="OCR/Text Extraction"
                  description="AI-powered text extraction and error correction"
                  isActive={currentStage === 'ocr'}
                  isComplete={result !== null}
                  confidence={result?.ocr_confidence}
                />
                <ProcessingStep
                  title="Test Normalization"
                  description="AI normalization with medical knowledge"
                  isActive={currentStage === 'normalization'}
                  isComplete={result !== null}
                  confidence={result?.normalization_confidence}
                />
                <ProcessingStep
                  title="Patient Summary"
                  description="AI-generated patient-friendly explanations"
                  isActive={currentStage === 'summary'}
                  isComplete={result !== null}
                />
                <ProcessingStep
                  title="Quality Validation"
                  description="Prevent hallucinated results"
                  isActive={currentStage === 'validation'}
                  isComplete={result?.status === 'ok'}
                />
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-red-800">Processing Error</h3>
                  <p className="text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* OCR Preview */}
          {result && (inputType === 'image' || result.ocr_text !== undefined) && (
            <div className="mt-8 bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">OCR Preview</h2>
              <div className="flex items-center text-sm text-gray-600 mb-3">
                <span className="mr-2">OCR Confidence:</span>
                <span className="font-medium">{Math.round((result.ocr_confidence || 0) * 100)}%</span>
              </div>
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-800 max-h-64 overflow-auto">
{result.ocr_text && result.ocr_text.trim().length > 0 ? result.ocr_text : 'No text extracted from image.'}
              </pre>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="mt-8 space-y-8">
              <TestResults tests={result.tests} />
              <PatientSummary 
                summary={result.summary} 
                explanations={result.explanations}
                status={result.status}
              />
              {result.status === 'unprocessed' && result.reason && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                  <div className="text-sm text-yellow-800">
                    <strong>Processing halted:</strong> {result.reason}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default App;