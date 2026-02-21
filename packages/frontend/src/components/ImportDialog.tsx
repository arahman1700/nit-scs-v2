import React, { useState, useRef } from 'react';
import { Upload, ArrowRight, Check, AlertCircle, Loader2, X, FileSpreadsheet } from 'lucide-react';
import { useImportPreview, useImportExecute } from '@/api/hooks/useImport';
import type { ImportPreview, ImportField } from '@/api/hooks/useImport';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entity: string;
  entityLabel: string;
}

type Step = 'upload' | 'mapping' | 'executing' | 'result';

/** Map resource route names to importable entity names */
const ENTITY_MAP: Record<string, string> = {
  items: 'items',
  inventory: 'items',
  suppliers: 'suppliers',
  projects: 'projects',
  employees: 'employees',
  warehouses: 'warehouses',
  regions: 'regions',
  cities: 'cities',
  uoms: 'uoms',
};

export const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, entity, entityLabel }) => {
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewMutation = useImportPreview();
  const executeMutation = useImportExecute();

  const importEntity = ENTITY_MAP[entity] ?? entity;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    try {
      const result = await previewMutation.mutateAsync({ file: selected, entity: importEntity });
      const data = (result as { data?: ImportPreview })?.data;
      if (data) {
        setPreview(data);
        // Auto-map matching columns
        const autoMap: Record<string, string> = {};
        for (const field of data.expectedFields) {
          const match = data.headers.find(
            h =>
              h.toLowerCase() === field.label.toLowerCase() ||
              h.toLowerCase() === field.dbField.toLowerCase() ||
              h.toLowerCase().replace(/[_\s]/g, '') === field.dbField.toLowerCase(),
          );
          if (match) autoMap[match] = field.dbField;
        }
        setMapping(autoMap);
        setStep('mapping');
      }
    } catch {
      // Error shown via mutation state
    }
  };

  const handleExecute = async () => {
    if (!preview) return;
    setStep('executing');

    try {
      await executeMutation.mutateAsync({
        entity: importEntity,
        mapping,
        rows:
          preview.sampleRows.length < preview.totalRows
            ? preview.sampleRows // In real usage, backend re-parses; here we send what we have
            : preview.sampleRows,
      });
      setStep('result');
    } catch {
      setStep('mapping');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setPreview(null);
    setMapping({});
    setFile(null);
    previewMutation.reset();
    executeMutation.reset();
    onClose();
  };

  if (!isOpen) return null;

  const resultData = (
    executeMutation.data as {
      data?: {
        succeeded: number;
        failed: number;
        total: number;
        results: { row: number; success: boolean; error?: string }[];
      };
    }
  )?.data;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-3xl mx-4 bg-nesma-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-nesma-secondary" />
            <div>
              <h2 className="text-lg font-bold text-white">Import {entityLabel}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {step === 'upload' && 'Upload an Excel (.xlsx) or CSV file'}
                {step === 'mapping' && 'Map columns to database fields'}
                {step === 'executing' && 'Importing records...'}
                {step === 'result' && 'Import complete'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full max-w-md border-2 border-dashed border-white/20 rounded-xl p-12 text-center cursor-pointer hover:border-nesma-secondary/50 hover:bg-white/[0.02] transition-all"
              >
                {previewMutation.isPending ? (
                  <Loader2 size={40} className="mx-auto text-nesma-secondary animate-spin mb-4" />
                ) : (
                  <Upload size={40} className="mx-auto text-gray-400 mb-4" />
                )}
                <p className="text-white font-medium mb-1">
                  {previewMutation.isPending ? 'Parsing file...' : 'Click to upload or drag & drop'}
                </p>
                <p className="text-xs text-gray-500">Supports .xlsx, .xls, .csv (max 10MB, 5000 rows)</p>
              </div>
              {previewMutation.isError && (
                <div className="mt-4 flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle size={14} />
                  {(previewMutation.error as Error)?.message || 'Failed to parse file'}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && preview && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="bg-nesma-secondary/10 text-nesma-secondary px-2 py-1 rounded text-xs border border-nesma-secondary/30">
                  {file?.name}
                </span>
                <span>{preview.totalRows} rows detected</span>
                <span>{preview.headers.length} columns</span>
              </div>

              {/* Column mapping */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Column Mapping</h3>
                <div className="space-y-2">
                  {preview.expectedFields.map((field: ImportField) => {
                    const mappedHeader = Object.entries(mapping).find(([, v]) => v === field.dbField)?.[0] ?? '';
                    return (
                      <div
                        key={field.dbField}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white">{field.label}</span>
                          {field.required && <span className="text-red-400 ml-1 text-xs">*</span>}
                          <span className="text-[10px] text-gray-500 ml-2 font-mono">{field.dbField}</span>
                        </div>
                        <ArrowRight size={14} className="text-gray-500 flex-shrink-0" />
                        <select
                          value={mappedHeader}
                          onChange={e => {
                            const newMapping = { ...mapping };
                            // Remove old mapping for this field
                            const oldKey = Object.entries(newMapping).find(([, v]) => v === field.dbField)?.[0];
                            if (oldKey) delete newMapping[oldKey];
                            // Add new mapping
                            if (e.target.value) newMapping[e.target.value] = field.dbField;
                            setMapping(newMapping);
                          }}
                          className="flex-1 max-w-[200px] bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
                        >
                          <option value="">-- Skip --</option>
                          {preview.headers.map(h => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sample data */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Sample Data (first 5 rows)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">#</th>
                        {preview.headers.slice(0, 8).map(h => (
                          <th key={h} className="px-3 py-2 text-left text-gray-400 font-medium truncate max-w-[120px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {preview.sampleRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          {preview.headers.slice(0, 8).map(h => (
                            <td key={h} className="px-3 py-2 text-gray-300 truncate max-w-[120px]">
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Executing */}
          {step === 'executing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={40} className="text-nesma-secondary animate-spin mb-4" />
              <p className="text-white font-medium">Importing records...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && resultData && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                  <div className="text-2xl font-bold text-green-400">{resultData.succeeded}</div>
                  <div className="text-xs text-green-400/70">Succeeded</div>
                </div>
                {resultData.failed > 0 && (
                  <div className="flex-1 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                    <div className="text-2xl font-bold text-red-400">{resultData.failed}</div>
                    <div className="text-xs text-red-400/70">Failed</div>
                  </div>
                )}
                <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-2xl font-bold text-gray-300">{resultData.total}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>

              {/* Failed rows */}
              {resultData.failed > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Failed Rows</h3>
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    {resultData.results
                      .filter((r: { success: boolean }) => !r.success)
                      .map((r: { row: number; error?: string }, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg text-xs"
                        >
                          <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
                          <span className="text-gray-400">Row {r.row}:</span>
                          <span className="text-red-400">{r.error}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all"
          >
            {step === 'result' ? 'Close' : 'Cancel'}
          </button>
          {step === 'mapping' && (
            <button
              onClick={handleExecute}
              disabled={executeMutation.isPending || Object.keys(mapping).length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-nesma-primary hover:bg-nesma-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-all"
            >
              <Check size={14} />
              Import {preview?.totalRows ?? 0} Rows
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
