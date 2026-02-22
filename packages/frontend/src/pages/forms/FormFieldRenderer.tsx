import React from 'react';
import { FileText, Upload, Loader2, X } from 'lucide-react';
import type { FormFieldDef } from './formConfigs';

export interface FormFieldRendererProps {
  field: FormFieldDef;
  isEditable: boolean;
  isEditMode: boolean;
  value: string;
  checkboxValue: boolean;
  uploadedFile?: { url: string; name: string; size: number };
  uploadPending: boolean;
  uploadError: Error | null;
  onInputChange: (key: string, value: unknown) => void;
  onFileUpload: (fieldKey: string, file: File) => void;
  onRemoveFile: (fieldKey: string) => void;
}

export const FormFieldRenderer: React.FC<FormFieldRendererProps> = ({
  field,
  isEditable,
  isEditMode,
  value,
  checkboxValue,
  uploadedFile,
  uploadPending,
  uploadError,
  onInputChange,
  onFileUpload,
  onRemoveFile,
}) => {
  const fieldId = `field-${field.key}`;

  return (
    <div className={`flex flex-col gap-2 ${field.type === 'textarea' || field.type === 'file' ? 'md:col-span-2' : ''}`}>
      <label htmlFor={fieldId} className="text-sm font-medium text-gray-300 ml-1">
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </label>

      {field.type === 'select' ? (
        <select
          id={fieldId}
          className="nesma-input px-4 py-3 w-full appearance-none bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all"
          required={field.required}
          disabled={isEditMode && !isEditable}
          value={value}
          onChange={e => onInputChange(field.onChange || field.key, e.target.value)}
        >
          <option value="">Select...</option>
          {field.options?.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          id={fieldId}
          className="nesma-input px-4 py-3 w-full min-h-[120px] bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all"
          required={field.required}
          disabled={isEditMode && !isEditable}
          placeholder={field.placeholder || 'Enter details here...'}
          value={value}
          onChange={e => onInputChange(field.key, e.target.value)}
        />
      ) : field.type === 'checkbox' ? (
        <label className="flex items-center gap-3 p-4 border border-white/10 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
          <input
            type="checkbox"
            className="w-5 h-5 text-nesma-secondary rounded border-gray-500 focus:ring-nesma-secondary bg-transparent"
            disabled={isEditMode && !isEditable}
            checked={checkboxValue}
            onChange={e => onInputChange(field.key, e.target.checked)}
          />
          <span className="text-sm text-gray-300">Yes</span>
        </label>
      ) : field.type === 'file' ? (
        uploadedFile ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-nesma-secondary/30 rounded-xl">
            <div className="w-10 h-10 bg-nesma-secondary/10 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="text-nesma-secondary" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{uploadedFile.name}</p>
              <p className="text-xs text-gray-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            {(!isEditMode || isEditable) && (
              <button
                type="button"
                onClick={() => onRemoveFile(field.key)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <label
            className={`border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:bg-white/5 hover:border-nesma-secondary/50 transition-all cursor-pointer group ${uploadPending ? 'pointer-events-none opacity-60' : ''}`}
            onDragOver={e => {
              e.preventDefault();
              e.currentTarget.classList.add('border-nesma-secondary/50', 'bg-white/5');
            }}
            onDragLeave={e => {
              e.currentTarget.classList.remove('border-nesma-secondary/50', 'bg-white/5');
            }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-nesma-secondary/50', 'bg-white/5');
              const file = e.dataTransfer.files[0];
              if (file) onFileUpload(field.key, file);
            }}
          >
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.csv"
              disabled={(isEditMode && !isEditable) || uploadPending}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onFileUpload(field.key, file);
                e.target.value = '';
              }}
            />
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-lg">
              {uploadPending ? (
                <Loader2 className="text-nesma-secondary animate-spin" size={24} />
              ) : (
                <Upload className="text-gray-400 group-hover:text-nesma-secondary transition-colors" size={24} />
              )}
            </div>
            <span className="block text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
              {uploadPending ? 'Uploading...' : 'Drop files here or click to browse'}
            </span>
            <span className="text-xs text-gray-500 mt-1 block">PDF, PNG, JPG, Excel, Word, CSV -- Max 10MB</span>
            {uploadError && (
              <span className="text-xs text-red-400 mt-2 block">{uploadError.message || 'Upload failed'}</span>
            )}
          </label>
        )
      ) : (
        <input
          id={fieldId}
          type={field.type}
          className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all"
          required={field.required}
          disabled={isEditMode && !isEditable}
          value={value}
          readOnly={field.readOnly}
          placeholder={field.placeholder || (field.readOnly ? '' : `Enter ${field.label}`)}
          onChange={e => onInputChange(field.key, e.target.value)}
        />
      )}
    </div>
  );
};
