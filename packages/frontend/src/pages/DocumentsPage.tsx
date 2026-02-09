import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Image,
  File,
  Upload,
  Search,
  Grid,
  List,
  Trash2,
  Download,
  X,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { useDocumentList, useDocumentCategories, useUploadDocument, useDeleteDocument } from '@/api/hooks/useDocuments';
import { useAppStore } from '@/store/useAppStore';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toaster';

const CATEGORIES = ['policy', 'procedure', 'contract', 'certificate', 'template', 'sop', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')) return FileText;
  return File;
}

const CATEGORY_COLORS: Record<string, string> = {
  policy: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  procedure: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  contract: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  certificate: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  template: 'bg-nesma-secondary/10 text-nesma-secondary border-nesma-secondary/20',
  sop: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  other: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose }) => {
  const uploadDocument = useUploadDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('policy');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'admin_only' | 'management'>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploadDocument.isPending) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, uploadDocument.isPending]);

  const resetForm = () => {
    setTitle('');
    setCategory('policy');
    setDescription('');
    setVisibility('all');
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = () => {
    if (!selectedFile || !title.trim()) {
      toast.warning('Missing fields', 'Please provide a file and a title.');
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title.trim());
    formData.append('category', category);
    formData.append('description', description.trim());
    formData.append('visibility', visibility);

    uploadDocument.mutate(formData, {
      onSuccess: () => {
        toast.success('Document uploaded', `"${title}" has been uploaded successfully.`);
        resetForm();
        onClose();
      },
      onError: (err) => {
        toast.error('Upload failed', err instanceof Error ? err.message : 'Unknown error');
      },
    });
  };

  if (!isOpen) return null;

  const inputClass = 'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => { if (!uploadDocument.isPending) onClose(); }} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-6 border border-white/10 max-w-lg w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Upload Document</h2>
            <button onClick={onClose} disabled={uploadDocument.isPending} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">File</label>
              <input ref={fileRef} type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className={`${inputClass} file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-nesma-primary file:text-white file:cursor-pointer`} />
              {selectedFile && <p className="text-xs text-gray-500">{selectedFile.name} - {formatFileSize(selectedFile.size)}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'all' | 'admin_only' | 'management')} className={inputClass}>
                <option value="all">All Users</option>
                <option value="admin_only">Admin Only</option>
                <option value="management">Management</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button onClick={onClose} disabled={uploadDocument.isPending} className="flex-1 px-5 py-3 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={uploadDocument.isPending} className="flex-1 px-5 py-3 text-sm font-bold text-white bg-nesma-primary rounded-xl hover:bg-nesma-primary/80 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {uploadDocument.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploadDocument.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const DocumentsPage: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const canUpload = user && ['admin', 'manager', 'warehouse_supervisor', 'logistics_coordinator'].includes(user.role);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('nit_docs_view') as 'grid' | 'list') || 'grid';
  });
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const { data: docsResponse, isLoading } = useDocumentList({ category: activeCategory === 'all' ? undefined : activeCategory, search: search || undefined });
  const { data: categoriesResponse } = useDocumentCategories();
  const deleteDocument = useDeleteDocument();

  const documents = docsResponse?.data ?? [];
  const categoryStats = categoriesResponse?.data ?? [];

  const totalCount = categoryStats.reduce((sum, c) => sum + c.count, 0);

  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) => d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
    );
  }, [documents, search]);

  const toggleView = (mode: 'grid' | 'list') => { setViewMode(mode); localStorage.setItem('nit_docs_view', mode); };
  const handleDownload = (id: string) => window.open(`/api/documents/${id}/download`, '_blank');

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteDocument.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Document deleted', `"${deleteTarget.title}" has been removed.`);
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 animate-fade-in">
        <Loader2 size={32} className="animate-spin text-nesma-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Company Documents</h1>
          <p className="text-sm text-gray-400 mt-1">Manage policies, procedures, and company files</p>
        </div>
        {canUpload && (
          <button onClick={() => setShowUpload(true)} className="px-5 py-3 bg-nesma-primary text-white rounded-lg text-sm font-bold hover:bg-nesma-primary/80 transition-all flex items-center gap-2 shadow-lg">
            <Upload size={16} />
            Upload Document
          </button>
        )}
      </div>

      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setActiveCategory('all')}
            className={`text-[10px] px-3 py-1.5 rounded-full font-semibold transition-all border ${
              activeCategory === 'all'
                ? 'bg-nesma-primary text-white border-nesma-primary/50'
                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            All ({totalCount})
          </button>
          {CATEGORIES.map((cat) => {
            const count = categoryStats.find((c) => c.category === cat)?.count ?? 0;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-[10px] px-3 py-1.5 rounded-full font-semibold transition-all border capitalize ${
                  activeCategory === cat
                    ? 'bg-nesma-primary text-white border-nesma-primary/50'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
            />
          </div>
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => toggleView('grid')}
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              title="Grid view"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => toggleView('list')}
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
          <FolderOpen size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 text-sm font-medium">No documents found</p>
          <p className="text-gray-600 text-xs mt-1">
            {search ? 'Try adjusting your search or filter' : 'Upload your first document to get started'}
          </p>
        </div>
      )}

      {filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc) => {
            const Icon = getFileIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                onClick={() => handleDownload(doc.id)}
                className="glass-card rounded-xl p-5 border border-white/10 hover:border-nesma-secondary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-nesma-primary/10 group-hover:border-nesma-primary/20 transition-colors">
                    <Icon size={22} className="text-nesma-secondary" />
                  </div>
                  {canUpload && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: doc.id, title: doc.title }); }}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <h3 className="text-sm font-bold text-white mb-2 line-clamp-2 group-hover:text-nesma-secondary transition-colors">{doc.title}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border capitalize ${CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.other}`}>
                    {doc.category}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && viewMode === 'list' && (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-5 py-4 text-xs font-medium text-gray-400">Title</th>
                  <th className="px-5 py-4 text-xs font-medium text-gray-400">Category</th>
                  <th className="px-5 py-4 text-xs font-medium text-gray-400">Size</th>
                  <th className="px-5 py-4 text-xs font-medium text-gray-400">Uploaded By</th>
                  <th className="px-5 py-4 text-xs font-medium text-gray-400">Date</th>
                  <th className="px-5 py-4 text-xs font-medium text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((doc) => {
                  const Icon = getFileIcon(doc.mimeType);
                  return (
                    <tr key={doc.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Icon size={18} className="text-nesma-secondary shrink-0" />
                          <span className="text-sm font-medium text-white truncate max-w-[240px]">{doc.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border capitalize ${CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.other}`}>
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">{formatFileSize(doc.fileSize)}</td>
                      <td className="px-5 py-4 text-sm text-gray-400">{doc.uploadedBy?.fullName ?? 'System'}</td>
                      <td className="px-5 py-4 text-sm text-gray-400">{new Date(doc.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownload(doc.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-nesma-secondary hover:bg-white/10 transition-all"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                          {canUpload && (
                            <button
                              onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                              className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UploadModal isOpen={showUpload} onClose={() => setShowUpload(false)} />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteDocument.isPending}
      />
    </div>
  );
};
