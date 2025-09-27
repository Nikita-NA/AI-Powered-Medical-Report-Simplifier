import { Check, Loader2, Circle } from 'lucide-react';

interface ProcessingStepProps {
  title: string;
  description: string;
  isActive: boolean;
  isComplete: boolean;
  confidence?: number;
}

export function ProcessingStep({ title, description, isActive, isComplete, confidence }: ProcessingStepProps) {
  return (
    <div className={`border rounded-lg p-4 transition-all ${
      isActive ? 'border-blue-500 bg-blue-50' : 
      isComplete ? 'border-green-500 bg-green-50' : 
      'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3 mt-0.5">
          {isActive ? (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          ) : isComplete ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="flex-grow">
          <h3 className={`font-semibold ${
            isActive ? 'text-blue-800' : 
            isComplete ? 'text-green-800' : 
            'text-gray-700'
          }`}>
            {title}
          </h3>
          <p className={`text-sm mt-1 ${
            isActive ? 'text-blue-600' : 
            isComplete ? 'text-green-600' : 
            'text-gray-500'
          }`}>
            {description}
          </p>
          {confidence && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">AI Confidence</span>
                <span className="font-medium">{Math.round(confidence * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    confidence > 0.8 ? 'bg-green-600' : 
                    confidence > 0.6 ? 'bg-yellow-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${confidence * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}