import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MedicalTest } from '../types/medical';

interface TestResultsProps {
  tests: MedicalTest[];
}

export function TestResults({ tests }: TestResultsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'high':
        return <TrendingUp className="w-4 h-4" />;
      case 'low':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'low':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
        <Activity className="w-6 h-6 mr-2 text-blue-600" />
        Normalized Test Results
      </h2>
      
      <div className="space-y-4">
        {tests.map((test, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">{test.name}</h3>
              <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center ${getStatusColor(test.status)}`}>
                {getStatusIcon(test.status)}
                <span className="ml-1 capitalize">{test.status}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Value:</span>
                <span className="ml-2 font-medium">{test.value} {test.unit}</span>
              </div>
              <div>
                <span className="text-gray-600">Reference Range:</span>
                {typeof test.ref_range.low === 'number' && typeof test.ref_range.high === 'number' ? (
                  <span className="ml-2 font-medium">{test.ref_range.low} - {test.ref_range.high} {test.unit}</span>
                ) : (
                  <span className="ml-2 text-gray-500">N/A</span>
                )}
              </div>
              <div>
                <span className="text-gray-600">Unit:</span>
                <span className="ml-2 font-medium">{test.unit}</span>
              </div>
            </div>
            
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="relative h-2 bg-gradient-to-r from-orange-400 via-green-400 to-red-400 rounded-full">
                  <div 
                    className="absolute top-0 w-2 h-2 bg-gray-800 rounded-full transform -translate-x-1"
                    style={{
                      left: `${Math.min(100, Math.max(0, ((test.value - test.ref_range.low) / (test.ref_range.high - test.ref_range.low)) * 100))}%`
                    }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low</span>
                <span>Normal</span>
                <span>High</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}