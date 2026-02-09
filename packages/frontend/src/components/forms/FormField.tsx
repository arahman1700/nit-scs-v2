import React from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';

export interface FormFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'file';
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  readOnly?: boolean;
  placeholder?: string;
  onChange?: string;
}

interface FormFieldProps {
  field: FormFieldDef;
  register: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors;
  disabled?: boolean;
  // File upload support
  uploadedFile?: { url: string; name: string; size: number };
  onFileUpload?: (fieldKey: string, file: File) => void;
  onFileRemove?: (fieldKey: string) => void;
  isUploading?: boolean;
  uploadError?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  field,
  register,
  errors,
  disabled = false,
  uploadedFile,
  onFileUpload,
  onFileRemove,
  isUploading,
  uploadError,
}) => {
  const error = errors[field.key];
  const colSpan = field.type === 'textarea' || field.type === 'file' ? 'md:col-span-2' : '';

  return (
    <div className={`flex flex-col gap-2 ${colSpan}`}>
      <label className="text-sm font-medium text-gray-300 ml-1">
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </label>

      {field.type === 'select' ? (
        <select
          {...register(field.key, { required: field.required ? `${field.label} is required` : false })}
          className="nesma-input px-4 py-3 w-full appearance-none bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all"
          disabled={disabled}
        >
          <option value="">Select...</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          {...register(field.key, { required: field.required ? `${field.label} is required` : false })}
          className="nesma-input px-4 py-3 w-full min-h-[120px] bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all"
          disabled={disabled}
          placeholder={field.placeholder || 'Enter details here...'}
        />
      ) : field.type === 'checkbox' ? (
        <label className="flex items-center gap-3 p-4 border border-white/10 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
          <input
            type="checkbox"
            {...register(field.key)}
            className="w-5 h-5 text-nesma-secondary rounded border-gray-500 focus:ring-nesma-secondary bg-transparent"
            disabled={disabled}
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
            {!disabled && (
              <button
                type="button"
                onClick={() => onFileRemove?.(field.key)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <label
            className={`border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:bg-white/5 hover:border-nesma-secondary/50 transition-all cursor-pointer group ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
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
              if (file) onFileUpload?.(field.key, file);
            }}
          >
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.csv"
              disabled={disabled || isUploading}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onFileUpload?.(field.key, file);
                e.target.value = '';
              }}
            />
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-lg">
              {isUploading ? (
                <Loader2 className="text-nesma-secondary animate-spin" size={24} />
              ) : (
                <Upload className="text-gray-400 group-hover:text-nesma-secondary transition-colors" size={24} />
              )}
            </div>
            <span className="block text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
              {isUploading ? 'Uploading...' : 'Drop files here or click to browse'}
            </span>
            <span className="text-xs text-gray-500 mt-1 block">PDF, PNG, JPG, Excel, Word, CSV -- Max 10MB</span>
            {uploadError && <span className="text-xs text-red-400 mt-2 block">{uploadError}</span>}
          </label>
        )
      ) : (
        <input
          type={field.type}
          {...register(field.key, { required: field.required ? `${field.label} is required` : false })}
          className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all"
          disabled={disabled}
          readOnly={field.readOnly}
          placeholder={field.placeholder || (field.readOnly ? '' : `Enter ${field.label}`)}
        />
      )}

      {error && <p className="text-xs text-red-400 ml-1">{error.message as string}</p>}
    </div>
  );
};
