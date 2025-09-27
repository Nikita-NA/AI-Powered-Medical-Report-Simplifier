import { Heart, Info, CheckCircle, XCircle } from 'lucide-react';

interface PatientSummaryProps {
  summary: string;
  explanations?: string[];
  status: 'ok' | 'unprocessed';
}

export function PatientSummary({ summary, explanations, status }: PatientSummaryProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
        <Heart className="w-6 h-6 mr-2 text-pink-600" />
        Patient-Friendly Summary
      </h2>

      {/* Status Badge */}
      <div className="mb-6">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          status === 'ok' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {status === 'ok' ? (
            <CheckCircle className="w-4 h-4 mr-2" />
          ) : (
            <XCircle className="w-4 h-4 mr-2" />
          )}
          {status === 'ok' ? 'Processing Complete' : 'Processing Failed'}
        </div>
      </div>

      {/* Main Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
          <Info className="w-5 h-5 mr-2 text-blue-600" />
          Overview
        </h3>
        <p className="text-gray-700 leading-relaxed">{summary}</p>
      </div>

      {/* Detailed Explanations */}
      {explanations && explanations.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-4">What This Means</h3>
          <div className="space-y-3">
            {explanations.map((explanation, index) => (
              <div key={index} className="flex items-start p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700 text-sm">{explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medical Disclaimer */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          <strong>Medical Disclaimer:</strong> This summary is for informational purposes only and should not be used for medical diagnosis or treatment decisions. Always consult with your healthcare provider for proper medical interpretation and advice.
        </p>
      </div>
    </div>
  );
}