import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse, PaginationMeta } from '@/api/types';
import {
  Bell,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  Eye,
  Mail,
  Smartphone,
  MonitorSmartphone,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Code,
  FileText,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { emailLogs: number };
}

interface EmailLog {
  id: string;
  templateId: string | null;
  toEmail: string;
  subject: string;
  bodyHtml: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  retryCount: number;
  externalId: string | null;
  error: string | null;
  referenceTable: string | null;
  referenceId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  template?: { code: string; name: string } | null;
}

interface NotificationPreference {
  eventType: string;
  label: string;
  description: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  pushEnabled: boolean;
}

type Tab = 'templates' | 'preferences' | 'logs';

// ── Constants ──────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'templates', label: 'Email Templates', icon: Mail },
  { id: 'preferences', label: 'Notification Preferences', icon: Bell },
  { id: 'logs', label: 'Notification Log', icon: FileText },
];

const EVENT_TYPES: { value: string; label: string; description: string }[] = [
  {
    value: 'document_submitted',
    label: 'Document Submitted',
    description: 'When a document is submitted for approval',
  },
  { value: 'document_approved', label: 'Document Approved', description: 'When a document is approved by an approver' },
  { value: 'document_rejected', label: 'Document Rejected', description: 'When a document is rejected by an approver' },
  { value: 'sla_breach', label: 'SLA Breach', description: 'When an SLA deadline is exceeded' },
  { value: 'sla_warning', label: 'SLA Warning', description: 'When an SLA deadline is approaching' },
  { value: 'inventory_low', label: 'Low Inventory', description: 'When stock levels fall below reorder point' },
  { value: 'inventory_expired', label: 'Inventory Expired', description: 'When inventory items reach expiration date' },
  { value: 'new_comment', label: 'New Comment', description: 'When a new comment is added to a document' },
  { value: 'status_changed', label: 'Status Changed', description: 'When a document status changes' },
];

const LOG_STATUSES = ['queued', 'sent', 'delivered', 'bounced', 'failed'] as const;

const EMPTY_TEMPLATE = {
  code: '',
  name: '',
  subject: '',
  bodyHtml: '',
  variables: [] as string[],
  isActive: true,
};

// ── Hooks ──────────────────────────────────────────────────────────────────

function useEmailTemplates(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['email-templates', page, pageSize],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<EmailTemplate[]>>('/email-templates', {
        params: { page, pageSize },
      });
      return data;
    },
  });
}

function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: typeof EMPTY_TEMPLATE) => {
      const { data } = await apiClient.post<ApiResponse<EmailTemplate>>('/email-templates', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<EmailTemplate> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<EmailTemplate>>(`/email-templates/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/email-templates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

function usePreviewTemplate() {
  return useMutation({
    mutationFn: async ({ id, variables }: { id: string; variables: Record<string, string> }) => {
      const { data } = await apiClient.post<ApiResponse<{ subject: string; bodyHtml: string }>>(
        `/email-templates/${id}/preview`,
        { variables },
      );
      return data;
    },
  });
}

function useEmailLogs(params: { page: number; pageSize: number; status?: string; toEmail?: string }) {
  return useQuery({
    queryKey: ['email-logs', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<EmailLog[]>>('/email-logs', {
        params,
      });
      return data;
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusColor(status: string) {
  switch (status) {
    case 'delivered':
    case 'sent':
      return 'text-emerald-400 bg-emerald-500/15';
    case 'queued':
      return 'text-amber-400 bg-amber-500/15';
    case 'bounced':
    case 'failed':
      return 'text-red-400 bg-red-500/15';
    default:
      return 'text-gray-400 bg-white/10';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'delivered':
    case 'sent':
      return CheckCircle2;
    case 'queued':
      return Clock;
    case 'bounced':
    case 'failed':
      return XCircle;
    default:
      return Clock;
  }
}

/**
 * Sanitize HTML for preview display.
 * Strips script tags and event handlers as a basic safety measure.
 * The content originates from admin-managed email templates stored in the database.
 */
function sanitizePreviewHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*\S+/gi, '');
}

// ── Component ──────────────────────────────────────────────────────────────

export function NotificationRulesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('templates');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Bell size={24} className="text-nesma-secondary" />
            <h1 className="text-2xl font-bold text-white">Notifications & Rules</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Manage email templates, notification preferences, and delivery logs
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card rounded-2xl p-1.5">
        <div className="flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' && <EmailTemplatesTab />}
      {activeTab === 'preferences' && <NotificationPreferencesTab />}
      {activeTab === 'logs' && <NotificationLogTab />}
    </div>
  );
}

// ── Tab 1: Email Templates ─────────────────────────────────────────────────

function EmailTemplatesTab() {
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

// ── Tab 2: Notification Preferences ────────────────────────────────────────

function NotificationPreferencesTab() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(() =>
    EVENT_TYPES.map(et => ({
      eventType: et.value,
      label: et.label,
      description: et.description,
      emailEnabled: true,
      inAppEnabled: true,
      pushEnabled: true,
    })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleChannel = useCallback((eventType: string, channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled') => {
    setPreferences(prev => prev.map(p => (p.eventType === eventType ? { ...p, [channel]: !p[channel] } : p)));
    setSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save preferences via settings endpoint
      await apiClient.put('/settings', {
        key: 'notification_preferences',
        value: preferences.map(p => ({
          eventType: p.eventType,
          emailEnabled: p.emailEnabled,
          inAppEnabled: p.inAppEnabled,
          pushEnabled: p.pushEnabled,
        })),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Fail silently -- the apiClient interceptor handles errors via toast
    } finally {
      setIsSaving(false);
    }
  }, [preferences]);

  const enableAllForChannel = useCallback((channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled') => {
    setPreferences(prev => prev.map(p => ({ ...p, [channel]: true })));
    setSaveSuccess(false);
  }, []);

  const disableAllForChannel = useCallback((channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled') => {
    setPreferences(prev => prev.map(p => ({ ...p, [channel]: false })));
    setSaveSuccess(false);
  }, []);

  const allEnabled = useCallback(
    (channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled') => preferences.every(p => p[channel]),
    [preferences],
  );

  return (
    <div className="space-y-6">
      {/* Channel Header */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Notification Channels</h3>
            <p className="text-sm text-gray-400 mt-1">
              Configure which notification channels are active for each event type
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 size={16} />
                Saved
              </>
            ) : (
              <>
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </>
            )}
          </button>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-[1fr_100px_100px_100px] gap-4 items-center mb-3 px-4">
          <span className="text-sm font-medium text-gray-400">Event Type</span>
          <div className="text-center">
            <button
              onClick={() =>
                allEnabled('emailEnabled') ? disableAllForChannel('emailEnabled') : enableAllForChannel('emailEnabled')
              }
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Mail size={16} className="mx-auto mb-1" />
              Email
            </button>
          </div>
          <div className="text-center">
            <button
              onClick={() =>
                allEnabled('inAppEnabled') ? disableAllForChannel('inAppEnabled') : enableAllForChannel('inAppEnabled')
              }
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              <MonitorSmartphone size={16} className="mx-auto mb-1" />
              In-App
            </button>
          </div>
          <div className="text-center">
            <button
              onClick={() =>
                allEnabled('pushEnabled') ? disableAllForChannel('pushEnabled') : enableAllForChannel('pushEnabled')
              }
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Smartphone size={16} className="mx-auto mb-1" />
              Push
            </button>
          </div>
        </div>

        {/* Event Rows */}
        <div className="space-y-1">
          {preferences.map(pref => (
            <div
              key={pref.eventType}
              className="grid grid-cols-[1fr_100px_100px_100px] gap-4 items-center bg-white/5 rounded-xl px-4 py-3 hover:bg-white/10 transition-all duration-300"
            >
              <div>
                <p className="text-white text-sm font-medium">{pref.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pref.description}</p>
              </div>
              <div className="text-center">
                <button
                  onClick={() => toggleChannel(pref.eventType, 'emailEnabled')}
                  className={`w-10 h-6 rounded-full transition-all duration-300 relative ${
                    pref.emailEnabled ? 'bg-nesma-primary' : 'bg-white/10'
                  }`}
                  aria-label={`Toggle email for ${pref.label}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                      pref.emailEnabled ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="text-center">
                <button
                  onClick={() => toggleChannel(pref.eventType, 'inAppEnabled')}
                  className={`w-10 h-6 rounded-full transition-all duration-300 relative ${
                    pref.inAppEnabled ? 'bg-nesma-primary' : 'bg-white/10'
                  }`}
                  aria-label={`Toggle in-app for ${pref.label}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                      pref.inAppEnabled ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="text-center">
                <button
                  onClick={() => toggleChannel(pref.eventType, 'pushEnabled')}
                  className={`w-10 h-6 rounded-full transition-all duration-300 relative ${
                    pref.pushEnabled ? 'bg-nesma-primary' : 'bg-white/10'
                  }`}
                  aria-label={`Toggle push for ${pref.label}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                      pref.pushEnabled ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Notification Log ────────────────────────────────────────────────

function NotificationLogTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [debouncedEmail, setDebouncedEmail] = useState('');
  const queryClient = useQueryClient();

  // Debounce email search
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = useCallback((val: string) => {
    setSearchEmail(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedEmail(val);
      setPage(1);
    }, 400);
  }, []);

  const params = useMemo(
    () => ({
      page,
      pageSize: 20,
      ...(statusFilter && { status: statusFilter }),
      ...(debouncedEmail && { toEmail: debouncedEmail }),
    }),
    [page, statusFilter, debouncedEmail],
  );

  const { data: response, isLoading } = useEmailLogs(params);

  const logs = (response?.data ?? []) as EmailLog[];
  const meta = response?.meta as PaginationMeta | undefined;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['email-logs'] });
  }, [queryClient]);

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          {/* Search by email */}
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-field w-full pl-9"
              placeholder="Search by recipient email..."
              value={searchEmail}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Status:</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setStatusFilter('');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all duration-300 ${
                  statusFilter === ''
                    ? 'bg-nesma-primary text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                All
              </button>
              {LOG_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all duration-300 ${
                    statusFilter === s
                      ? 'bg-nesma-primary text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-white/10 rounded-lg transition-all ml-auto"
            aria-label="Refresh logs"
          >
            <RefreshCw size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="glass-card rounded-2xl p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-white/10 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && logs.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <FileText size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-400">No notification logs found.</p>
          {(statusFilter || debouncedEmail) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setSearchEmail('');
                setDebouncedEmail('');
                setPage(1);
              }}
              className="text-nesma-secondary text-sm hover:underline mt-2"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Log Table */}
      {!isLoading && logs.length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          {/* Table Header */}
          <div className="grid grid-cols-[140px_1fr_120px_1fr_100px] gap-4 px-4 pb-3 border-b border-white/10">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recipient</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Template</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subject</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</span>
          </div>

          {/* Rows */}
          <div className="space-y-1 mt-1">
            {logs.map(log => {
              const StatusIcon = getStatusIcon(log.status);
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-[140px_1fr_120px_1fr_100px] gap-4 items-center px-4 py-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-300"
                >
                  <span className="text-xs text-gray-300">{formatDate(log.createdAt)}</span>
                  <span className="text-sm text-white truncate">{log.toEmail}</span>
                  <span className="text-xs text-gray-400 truncate">{log.template?.code ?? '-'}</span>
                  <span className="text-sm text-gray-300 truncate">{log.subject}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${getStatusColor(log.status)}`}
                  >
                    <StatusIcon size={12} />
                    {log.status}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta && meta.total > meta.pageSize && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
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
    </div>
  );
}
