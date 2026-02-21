import { useState } from 'react';
import { Mail, Plus, Edit3, Trash2, Eye } from 'lucide-react';
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
} from '@/api/hooks/useEmailTemplates';
import { TemplateEditor } from '@/components/email/TemplateEditor';
import { TemplatePreview } from '@/components/email/TemplatePreview';

interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
}

export const EmailTemplatesPage: React.FC = () => {
  const { data, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();
  const [editing, setEditing] = useState<(EmailTemplate & { isNew?: boolean }) | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const templates = ((data as { data?: EmailTemplate[] })?.data || []) as EmailTemplate[];

  const handleSave = () => {
    if (!editing) return;
    const body = {
      code: editing.code,
      name: editing.name,
      subject: editing.subject,
      bodyHtml: editing.bodyHtml,
      variables: editing.variables,
    };
    if (editing.isNew) {
      createTemplate.mutate(body, { onSuccess: () => setEditing(null) });
    } else {
      updateTemplate.mutate({ id: editing.id, ...body }, { onSuccess: () => setEditing(null) });
    }
  };

  const previewTemplate = previewId ? templates.find(t => t.id === previewId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Mail size={20} className="text-blue-400" />
            Email Templates
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage Handlebars email templates used by workflow rules.</p>
        </div>
        <button
          onClick={() =>
            setEditing({
              id: '',
              code: '',
              name: '',
              subject: '',
              bodyHtml: '',
              variables: [],
              isActive: true,
              createdAt: '',
              isNew: true,
            })
          }
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nesma-secondary/20 text-nesma-secondary hover:bg-nesma-secondary/30 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div className="bg-white/[0.02] rounded-2xl border border-white/10 p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Template Name
            </label>
            <input
              type="text"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Approval Requested Email"
              className="w-full bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-nesma-secondary outline-none"
            />
          </div>

          <TemplateEditor
            code={editing.code}
            subject={editing.subject}
            bodyHtml={editing.bodyHtml}
            variables={editing.variables}
            onCodeChange={code => setEditing({ ...editing, code })}
            onSubjectChange={subject => setEditing({ ...editing, subject })}
            onBodyChange={bodyHtml => setEditing({ ...editing, bodyHtml })}
            onVariablesChange={variables => setEditing({ ...editing, variables })}
            onPreview={!editing.isNew ? () => setPreviewId(editing.id) : undefined}
          />

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={
                !editing.code.trim() || !editing.name.trim() || createTemplate.isPending || updateTemplate.isPending
              }
              className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm font-medium disabled:opacity-40"
            >
              {editing.isNew ? 'Create Template' : 'Save Changes'}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview panel */}
      {previewTemplate && (
        <div className="bg-white/[0.02] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Preview: {previewTemplate.name}</h3>
            <button onClick={() => setPreviewId(null)} className="text-xs text-gray-500 hover:text-white">
              Close
            </button>
          </div>
          <TemplatePreview templateId={previewTemplate.id} variables={previewTemplate.variables} />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Template list */}
      {!isLoading && !editing && (
        <div className="space-y-2">
          {templates.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              <Mail size={40} className="mx-auto mb-3 text-gray-600" />
              No email templates yet.
            </div>
          ) : (
            templates.map(tpl => (
              <div
                key={tpl.id}
                className="group bg-white/[0.03] rounded-xl border border-white/10 hover:border-nesma-secondary/30 transition-all duration-200"
              >
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-semibold text-white">{tpl.name}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 font-mono">
                        {tpl.code}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{tpl.subject}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setPreviewId(tpl.id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => setEditing(tpl)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete template "${tpl.name}"?`)) {
                          deleteTemplate.mutate(tpl.id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
