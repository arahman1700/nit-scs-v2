import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, Image, Loader2 } from 'lucide-react';
import { apiClient } from '@/api/client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UploadedFile {
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  /** Local preview ObjectURL (images only) */
  previewUrl?: string;
}

export interface FileUploadZoneProps {
  /** Entity type for labelling (e.g. "rfim", "osd", "scrap") */
  entityType: string;
  /** Optional entity id — if provided, files are associated at upload time */
  entityId?: string;
  /** Maximum number of files allowed (default: 10) */
  maxFiles?: number;
  /** Comma-separated accepted MIME types or extensions (default: ".jpg,.jpeg,.png,.pdf") */
  acceptedTypes?: string;
  /** Currently uploaded files (controlled) */
  files: UploadedFile[];
  /** Callback when files list changes */
  onFilesChange: (files: UploadedFile[]) => void;
}

// ── Helper ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

// ── Component ──────────────────────────────────────────────────────────────

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  entityType,
  entityId,
  maxFiles = 10,
  acceptedTypes = '.jpg,.jpeg,.png,.pdf',
  files,
  onFilesChange,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      const formData = new FormData();
      formData.append('file', file);
      // Include entity context if available
      if (entityType) formData.append('entityType', entityType);
      if (entityId) formData.append('recordId', entityId);

      try {
        const { data } = await apiClient.post<{
          success: boolean;
          data: { url: string; originalName: string; size: number; mimeType: string };
        }>('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const uploaded = data.data;
        const previewUrl = isImageType(uploaded.mimeType) ? URL.createObjectURL(file) : undefined;
        return { ...uploaded, previewUrl };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(message);
        return null;
      }
    },
    [entityType, entityId],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const remaining = maxFiles - files.length;
      if (remaining <= 0) {
        setUploadError(`Maximum ${maxFiles} files allowed.`);
        return;
      }
      const toUpload = incoming.slice(0, remaining);
      setUploadError(null);
      setUploading(true);
      const results: UploadedFile[] = [];
      for (const file of toUpload) {
        const result = await uploadFile(file);
        if (result) results.push(result);
      }
      setUploading(false);
      if (results.length > 0) {
        onFilesChange([...files, ...results]);
      }
    },
    [files, maxFiles, uploadFile, onFilesChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      const updated = files.filter((_, i) => i !== index);
      // Revoke object URL to prevent memory leaks
      const removed = files[index];
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      onFilesChange(updated);
    },
    [files, onFilesChange],
  );

  const isAtLimit = files.length >= maxFiles;

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      {!isAtLimit && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
            dragOver
              ? 'border-nesma-secondary bg-nesma-secondary/10'
              : 'border-white/20 bg-white/5 hover:border-nesma-secondary/50 hover:bg-white/10'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept={acceptedTypes}
            disabled={uploading}
            onChange={e => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110">
            {uploading ? (
              <Loader2 size={24} className="text-nesma-secondary animate-spin" />
            ) : (
              <Upload size={24} className={dragOver ? 'text-nesma-secondary' : 'text-gray-400'} />
            )}
          </div>

          <p className="text-sm font-medium text-gray-300">
            {uploading ? 'Uploading...' : dragOver ? 'Release to upload' : 'Drop files here or click to browse'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {acceptedTypes.toUpperCase().replace(/\./g, '').replace(/,/g, ', ')} — Max 10MB per file
          </p>
          {files.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {files.length} / {maxFiles} files
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <span className="text-xs text-red-400">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="ml-auto p-0.5 rounded text-red-400 hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl group hover:bg-white/10 transition-all duration-300"
            >
              {/* Thumbnail or Icon */}
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {file.previewUrl ? (
                  <img
                    src={file.previewUrl}
                    alt={file.originalName}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : isImageType(file.mimeType) ? (
                  <Image size={18} className="text-nesma-secondary" />
                ) : (
                  <FileText size={18} className="text-nesma-secondary" />
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{file.originalName}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300"
                aria-label={`Remove ${file.originalName}`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* At Limit Notice */}
      {isAtLimit && <p className="text-xs text-amber-400 text-center py-1">Maximum of {maxFiles} files reached.</p>}
    </div>
  );
};
