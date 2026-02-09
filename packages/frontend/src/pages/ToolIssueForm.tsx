import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Wrench, CheckCircle } from 'lucide-react';
import { useCreateToolIssue, useToolList } from '@/api/hooks';

export const ToolIssueForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const createMutation = useCreateToolIssue();

  const toolQuery = useToolList({ pageSize: 200 });
  const tools = (toolQuery.data?.data ?? []) as { id: string; toolName: string }[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData as Record<string, unknown>, {
      onSuccess: res => {
        setDocumentNumber((res as unknown as { data?: { formNumber?: string } }).data?.formNumber ?? 'TI-NEW');
        setSubmitted(true);
      },
    });
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Tool Issue Created</h2>
        <p className="text-gray-400 mb-6">Document #{documentNumber}</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({});
            }}
            className="btn-secondary px-4 py-2 rounded-lg"
          >
            Create Another
          </button>
          <button onClick={() => navigate(-1)} className="btn-primary px-4 py-2 rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Wrench className="w-8 h-8 text-nesma-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Tool Issue Form</h1>
          <p className="text-gray-400 text-sm">Issue tool to employee</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Issue Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Tool</label>
            <select
              value={(formData.toolId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, toolId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select tool...</option>
              {tools.map(t => (
                <option key={t.id} value={t.id}>
                  {t.toolName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Issued To (Employee ID)</label>
            <input
              type="text"
              value={(formData.issuedToId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, issuedToId: e.target.value }))}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Expected Return Date</label>
            <input
              type="date"
              value={(formData.expectedReturnDate as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, expectedReturnDate: e.target.value }))}
              className="input-field w-full"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-1">Notes</label>
          <textarea
            value={(formData.notes as string) ?? ''}
            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
            className="input-field w-full"
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6 py-2 rounded-lg">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {createMutation.isPending ? 'Creating...' : 'Create Tool Issue'}
        </button>
      </div>
    </form>
  );
};
