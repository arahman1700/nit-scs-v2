import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Pencil, X, Check, Loader2, ChevronDown, ChevronUp, User } from 'lucide-react';
import { useDocumentComments, useCreateComment, useUpdateComment, useDeleteComment } from '@/api/hooks/useComments';
import { useCurrentUser } from '@/api/hooks/useAuth';
import type { DocumentComment } from '@/api/hooks/useComments';

interface DocumentCommentsProps {
  documentType: string;
  documentId: string;
  /** Collapsed by default in modal views */
  defaultCollapsed?: boolean;
}

/**
 * Reusable document comments panel.
 * Shows a comment list, new comment input, and edit/delete controls.
 */
export const DocumentComments: React.FC<DocumentCommentsProps> = ({
  documentType,
  documentId,
  defaultCollapsed = false,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [page, setPage] = useState(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const meQuery = useCurrentUser();
  const currentUserId = meQuery.data?.data?.id;
  const currentRole = meQuery.data?.data?.systemRole;

  const commentsQuery = useDocumentComments(documentType, documentId, {
    page,
    pageSize: 20,
  });

  const createMutation = useCreateComment();
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();

  const comments =
    (commentsQuery.data as { data?: DocumentComment[]; meta?: { total: number; totalPages: number } })?.data ?? [];
  const meta = (commentsQuery.data as { meta?: { total: number; totalPages: number } })?.meta;

  // Auto-focus input when panel opens
  useEffect(() => {
    if (!collapsed && inputRef.current) {
      inputRef.current.focus();
    }
  }, [collapsed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;

    await createMutation.mutateAsync({
      documentType,
      documentId,
      content: trimmed,
    });
    setNewComment('');
  };

  const handleUpdate = async (commentId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;

    await updateMutation.mutateAsync({
      documentType,
      documentId,
      commentId,
      content: trimmed,
    });
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (commentId: string) => {
    await deleteMutation.mutateAsync({
      documentType,
      documentId,
      commentId,
    });
  };

  const canModify = (comment: DocumentComment) => {
    if (!currentUserId) return false;
    if (comment.authorId === currentUserId) return true;
    return ['admin', 'manager'].includes(currentRole ?? '');
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const totalComments = meta?.total ?? comments.length;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <MessageSquare size={16} className="text-nesma-secondary" />
          <span className="text-sm font-semibold text-white">Comments</span>
          {totalComments > 0 && (
            <span className="text-[10px] font-bold bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {totalComments}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronUp size={16} className="text-gray-400" />
        )}
      </button>

      {/* Body — collapsible */}
      {!collapsed && (
        <div className="border-t border-white/10">
          {/* New comment input */}
          <form onSubmit={handleSubmit} className="p-4 border-b border-white/5">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-nesma-primary/30 border border-nesma-primary/40 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-nesma-secondary" />
              </div>
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-nesma-secondary/50 focus:ring-1 focus:ring-nesma-secondary/30 transition-all"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-gray-500">Ctrl+Enter to submit</span>
                  <button
                    type="submit"
                    disabled={!newComment.trim() || createMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-nesma-primary/80 hover:bg-nesma-primary text-white text-xs font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Comment
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Comment list */}
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {commentsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="text-gray-400 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No comments yet. Be the first to comment.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {comments.map(comment => (
                  <div key={comment.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex gap-3">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gray-400">
                          {comment.author.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white truncate">{comment.author.fullName}</span>
                          {comment.author.department && (
                            <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              {comment.author.department}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 ml-auto flex-shrink-0">
                            {formatTime(comment.createdAt)}
                          </span>
                        </div>

                        {editingId === comment.id ? (
                          /* Editing mode */
                          <div>
                            <textarea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              rows={2}
                              className="w-full bg-white/5 border border-nesma-secondary/30 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-nesma-secondary/30"
                              autoFocus
                            />
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdate(comment.id)}
                                disabled={updateMutation.isPending}
                                className="flex items-center gap-1 px-2.5 py-1 bg-nesma-primary/60 hover:bg-nesma-primary text-white text-xs rounded-md transition-all"
                              >
                                {updateMutation.isPending ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Check size={10} />
                                )}
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditContent('');
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 text-xs rounded-md transition-all"
                              >
                                <X size={10} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Read mode */
                          <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{comment.content}</p>
                        )}

                        {/* Action buttons (visible on hover) */}
                        {canModify(comment) && editingId !== comment.id && (
                          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditContent(comment.content);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-nesma-secondary hover:bg-white/5 rounded transition-all"
                            >
                              <Pencil size={10} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(comment.id)}
                              disabled={deleteMutation.isPending}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-red-400 hover:bg-red-500/5 rounded transition-all"
                            >
                              <Trash2 size={10} />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-[10px] text-gray-500">
                {page} / {meta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
