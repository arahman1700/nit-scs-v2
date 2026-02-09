import React, { useState, useCallback, useRef } from 'react';
import {
  Paperclip,
  Upload,
  Trash2,
  Download,
  FileText,
  Image,
  File,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
} from 'lucide-react';
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '@/api/hooks/useAttachments';
import type { Attachment } from '@/api/hooks/useAttachments';

interface DocumentAttachmentsProps {
  entityType: string;
  recordId: string;
  defaultCollapsed?: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType === 'application/pdf') return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DocumentAttachments: React.FC<DocumentAttachmentsProps> = ({
  entityType,
  recordId,
  defaultCollapsed = false,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachmentsQuery = useAttachments(entityType, recordId);
  const uploadMutation = useUploadAttachment();
  const deleteMutation = useDeleteAttachment();

  const attachments = (attachmentsQuery.data as { data?: Attachment[] })?.data ?? [];

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        uploadMutation.mutate({ entityType, recordId, file });
      }
    },
    [entityType, recordId, uploadMutation],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
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

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id, entityType, recordId });
    setConfirmDeleteId(null);
  };

  const downloadUrl = (id: string) => `${API_URL}/attachments/${id}/download`;

  const canPreview = (mimeType: string) => mimeType.startsWith('image/') || mimeType === 'application/pdf';

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Paperclip size={16} className="text-nesma-secondary" />
          <span className="text-sm font-semibold text-white">Attachments</span>
          {attachments.length > 0 && (
            <span className="text-[10px] font-bold bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {attachments.length}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronUp size={16} className="text-gray-400" />
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-white/10">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`m-4 p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-nesma-secondary bg-nesma-secondary/10'
                : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {uploadMutation.isPending ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={20} className="text-nesma-secondary animate-spin" />
                <span className="text-sm text-gray-400">Uploading...</span>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-gray-500 mb-2" />
                <p className="text-sm text-gray-400">
                  Drop files here or <span className="text-nesma-secondary">click to browse</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1">PDF, images, Excel, Word, CSV, TXT, ZIP (max 10MB)</p>
              </>
            )}
          </div>

          {uploadMutation.isError && (
            <div className="mx-4 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              Upload failed: {(uploadMutation.error as Error).message}
            </div>
          )}

          {/* Attachment List */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {attachmentsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="text-gray-400 animate-spin" />
              </div>
            ) : attachments.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">No attachments yet.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {attachments.map(att => {
                  const FileIcon = getFileIcon(att.mimeType);
                  return (
                    <div
                      key={att.id}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <FileIcon size={16} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{att.originalName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span>{formatFileSize(att.fileSize)}</span>
                          {att.uploadedBy && (
                            <>
                              <span>·</span>
                              <span>{att.uploadedBy.fullName}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{new Date(att.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canPreview(att.mimeType) && (
                          <button
                            type="button"
                            onClick={() => setPreviewUrl(downloadUrl(att.id))}
                            className="p-1.5 text-gray-400 hover:text-nesma-secondary hover:bg-white/5 rounded-md transition-all"
                            title="Preview"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        <a
                          href={downloadUrl(att.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-nesma-secondary hover:bg-white/5 rounded-md transition-all"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                        {confirmDeleteId === att.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(att.id)}
                              disabled={deleteMutation.isPending}
                              className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-all"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-1 text-gray-500 hover:text-white transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(att.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/5 rounded-md transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full bg-gray-900 rounded-2xl overflow-hidden border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute top-3 right-3 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
            {previewUrl.endsWith('.pdf') || previewUrl.includes('application/pdf') ? (
              <iframe src={previewUrl} className="w-full h-[80vh]" title="PDF Preview" />
            ) : (
              <img src={previewUrl} alt="Preview" className="max-w-full max-h-[80vh] mx-auto object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
