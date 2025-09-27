import React, { useCallback } from 'react';
import { Upload, FileImage, AlertCircle } from 'lucide-react';
import { validateImageFile } from '../services/fileValidation';

interface ImageUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function ImageUpload({ onFileSelect, isProcessing }: ImageUploadProps) {
  const handleFileSelection = useCallback((file: File) => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isProcessing 
          ? 'border-gray-300 bg-gray-50' 
          : 'border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100'
      }`}
    >
      <div className="flex flex-col items-center">
        <FileImage className={`w-12 h-12 mb-4 ${isProcessing ? 'text-gray-400' : 'text-blue-600'}`} />
        <h3 className={`text-lg font-semibold mb-2 ${isProcessing ? 'text-gray-500' : 'text-gray-800'}`}>
          Upload Medical Report Image
        </h3>
        <p className={`text-sm mb-4 ${isProcessing ? 'text-gray-400' : 'text-gray-600'}`}>
          Drag and drop your medical report image here, or click to browse
        </p>
        
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,application/pdf"
          onChange={handleFileInput}
          disabled={isProcessing}
          className="hidden"
          id="file-upload"
        />
        
        <label
          htmlFor="file-upload"
          className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
            isProcessing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Upload className="w-4 h-4 mr-2" />
          Choose File
        </label>
        
        <div className="mt-4 text-xs text-gray-500">
          <div className="flex items-center justify-center mb-1">
            <AlertCircle className="w-3 h-3 mr-1" />
            Supported formats: JPEG, PNG, PDF
          </div>
          <div>Maximum file size: 10MB</div>
        </div>
      </div>
    </div>
  );
}