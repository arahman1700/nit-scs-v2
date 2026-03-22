import React, { useState, useCallback } from 'react';
import type { PaginationMeta } from '@/api/types';
import type { EmailTemplate } from './notificationHelpers';
import { EMPTY_TEMPLATE, sanitizePreviewHtml } from './notificationHelpers';
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  usePreviewTemplate,
} from './notificationHooks';
import { Plus, Trash2, Edit2, X, Save, Eye, Mail, ChevronLeft, ChevronRight, Code } from 'lucide-react';

export function EmailTemplatesTab() {
  const [page, setPage] = useState(1);
  const { data: response, isLoading } = useEmailTemplates(page);
  const createMutation = useCreateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate();
  const deleteMutation = useDeleteEmailTemplate();
  const previewMutation = usePreviewTemplate();

  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [form, setForm] = useState<typeof EMPTY_TEMPLATE & { id?: string }>(EMPTY_TEMPLATE);
  const [variableInput, setVariableInput] = useState('');

  const templates = (response?.data ?? []) as EmailTemplate[];
  const meta = response?.meta as PaginationMeta | undefined;

  const handleNew = useCallback(() => {
    setForm({ ...EMPTY_TEMPLATE });
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((t: EmailTemplate) => {
    setForm({
      id: t.id,
      code: t.code,
      name: t.name,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      variables: Array.isArray(t.variables) ? t.variables : [],
      isActive: t.isActive,
    });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    const { id, ...body } = form;
    if (id) {
      const { code: _code, ...updateBody } = body;
      await updateMutation.mutateAsync({ id, ...updateBody });
    } else {
      await createMutation.mutateAsync(body);
    }
    setShowForm(false);
  }, [form, createMutation, updateMutation]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Are you sure you want to delete this email template?')) return;
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  const handlePreview = useCallback(
    async (t: EmailTemplate) => {
      const sampleVars: Record<string, string> = {};
      const vars = Array.isArray(t.variables) ? t.variables : [];
      for (const v of vars) {
        sampleVars[v] = `[Sample ${v}]`;
      }
      const result = await previewMutation.mutateAsync({ id: t.id, variables: sampleVars });
      setPreviewHtml((result.data as { bodyHtml: string }).bodyHtml);
      setShowPreview(true);
    },
    [previewMutation],
  );

  const handleAddVariable = useCallback(() => {
    const trimmed = variableInput.trim();
    if (trimmed && !form.variables.includes(trimmed)) {
      setForm(p => ({ ...p, variables: [...p.variables, trimmed] }));
    }
    setVariableInput('');
  }, [variableInput, form.variables]);

  const handleRemoveVariable = useCallback((v: string) => {
    setForm(p => ({ ...p, variables: p.variables.filter(x => x !== v) }));
  }, []);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {/* Actions Bar */}
      <div className="flex justify-end">
        <button onClick={handleNew} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Template
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-5 w-48 bg-white/10 rounded mb-3" />
              <div className="h-4 w-72 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && templates.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Mail size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-400">No email templates configured yet.</p>
          <button onClick={handleNew} className="text-nesma-secondary text-sm hover:underline mt-2">
            Create the first template
          </button>
        </div>
      )}

      {/* Template List */}
      {!isLoading && templates.length > 0 && (
        <div className="glass-card rounded-2xl p-6 space-y-3">
          {templates.map(t => (
            <div
              key={t.id}
              className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 hover:bg-white/10 transition-all duration-300"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-medium truncate">{t.name}</h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      t.isActive ? 'text-emerald-400 bg-emerald-500/15' : 'text-gray-400 bg-white/10'
                    }`}
                  >
                    {t.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-gray-400">
                    <Code size={12} className="inline mr-1" />
                    {t.code}
                  </span>
                  <span className="text-xs text-gray-400 truncate max-w-xs">Subject: {t.subject}</span>
                  {Array.isArray(t.variables) && t.variables.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {t.variables.length} variable{t.variables.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {t._count?.emailLogs != null && (
                    <span className="text-xs text-gray-400">{t._count.emailLogs} sent</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4 shrink-0">
                <button
                  onClick={() => handlePreview(t)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  aria-label="Preview template"
                  disabled={previewMutation.isPending}
                >
                  <Eye size={16} className="text-nesma-secondary" />
                </button>
                <button
                  onClick={() => handleEdit(t)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  aria-label="Edit template"
                >
                  <Edit2 size={16} className="text-gray-400" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deleteMutation.isPending}
                  className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                  aria-label="Delete template"
                >
                  <Trash2 size={16} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {meta && meta.total > meta.pageSize && (
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <span className="text-sm text-gray-400">
                Page {meta.page} of {Math.ceil(meta.total / meta.pageSize)}
                <span className="ml-2 text-gray-500">({meta.total} total)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} className="text-gray-400" />
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(meta.total / meta.pageSize)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Template Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">
                {form.id ? 'Edit Email Template' : 'New Email Template'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Code + Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tpl-code" className="text-sm text-gray-300 block mb-1">
                    Template Code
                  </label>
                  <input
                    id="tpl-code"
                    className="input-field w-full"
                    value={form.code}
                    onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="e.g. grn_approved"
                    disabled={!!form.id}
                  />
                </div>
                <div>
                  <label htmlFor="tpl-name" className="text-sm text-gray-300 block mb-1">
                    Name
                  </label>
                  <input
                    id="tpl-name"
                    className="input-field w-full"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. GRN Approved Notification"
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="tpl-subject" className="text-sm text-gray-300 block mb-1">
                  Subject Line
                </label>
                <input
                  id="tpl-subject"
                  className="input-field w-full"
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder={'e.g. GRN {{documentNumber}} has been approved'}
                />
              </div>

              {/* Body HTML */}
              <div>
                <label htmlFor="tpl-body" className="text-sm text-gray-300 block mb-1">
                  HTML Body (Handlebars)
                </label>
                <textarea
                  id="tpl-body"
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white w-full font-mono text-sm"
                  value={form.bodyHtml}
                  onChange={e => setForm(p => ({ ...p, bodyHtml: e.target.value }))}
                  rows={12}
                  placeholder={'<h1>Hello {{recipientName}}</h1>...'}
                  spellCheck={false}
                />
              </div>

              {/* Variables */}
              <div>
                <label className="text-sm text-gray-300 block mb-2">Template Variables</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.variables.map(v => (
                    <span
                      key={v}
                      className="flex items-center gap-1 text-xs bg-nesma-primary/20 text-nesma-secondary px-2.5 py-1 rounded-lg border border-nesma-primary/30"
                    >
                      {'{{' + v + '}}'}
                      <button
                        onClick={() => handleRemoveVariable(v)}
                        className="hover:text-red-400 transition-colors ml-1"
                        aria-label={`Remove variable ${v}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1"
                    value={variableInput}
                    onChange={e => setVariableInput(e.target.value)}
                    placeholder="Add variable name (e.g. recipientName)"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddVariable();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddVariable}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Add variable"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                  className="rounded"
                />
                Active
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.code || !form.name || !form.subject || !form.bodyHtml}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="glass-panel rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Template Preview</h2>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            {/* Preview iframe sandbox for safe rendering of admin-managed email templates */}
            <iframe
              title="Email template preview"
              srcDoc={sanitizePreviewHtml(previewHtml)}
              sandbox=""
              className="w-full bg-white rounded-lg overflow-auto"
              style={{ minHeight: '400px', border: 'none' }}
            />
            <div className="flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
