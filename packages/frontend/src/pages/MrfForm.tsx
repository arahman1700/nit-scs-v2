import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';
import { LineItemsTable } from '@/components/LineItemsTable';
import { ExportButton } from '@/components/ExportButton';
import { useCreateMrf } from '@/api/hooks/useMrf';
import { useWarehouses, useProjects } from '@/api/hooks/useMasterData';
import { useCurrentUser } from '@/api/hooks/useAuth';
import { previewNextNumber } from '@/utils/autoNumber';
import { displayStr } from '@/utils/displayStr';
import { getRequiredApprovalLevel } from '@nit-scs-v2/shared/permissions';
import { generateMrPdf } from '@/utils/pdfExport';

export const MrfForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [lineItems, setLineItems] = useState<VoucherLineItem[]>([]);

  const createMutation = useCreateMrf();
  const meQuery = useCurrentUser();
  const currentUserName = meQuery.data?.data?.fullName ?? '';
  const warehouseQuery = useWarehouses({ pageSize: 200 });
  const projectQuery = useProjects({ pageSize: 200 });
  const warehouses = (warehouseQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;
  const projects = (projectQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;

  const totalValue = useMemo(() => lineItems.reduce((s, i) => s + i.totalPrice, 0), [lineItems]);
  const nextNumber = useMemo(() => previewNextNumber('mrf'), []);
  const approvalLevel = useMemo(() => getRequiredApprovalLevel('mi', totalValue), [totalValue]);

  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);
  const submitting = createMutation.isPending;

  const handleChange = (key: string, value: string | number | boolean | null) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { ...formData, lineItems, date: new Date().toISOString().split('T')[0] },
      {
        onSuccess: res => {
          setDocumentNumber((res as { data?: { formNumber?: string } })?.data?.formNumber ?? 'MRF-NEW');
          setSubmitted(true);
        },
      },
    );
  };

  const reset = () => {
    setSubmitted(false);
    setDocumentNumber(null);
    createMutation.reset();
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] glass-card rounded-2xl p-8 text-center animate-fade-in mx-auto max-w-2xl mt-10 border border-green-500/30 bg-gradient-to-b from-green-900/10 to-transparent">
        <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6 border border-green-500/50">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Material Request Submitted</h2>
        <p className="text-gray-400 mb-2">
          MR <span className="text-nesma-secondary font-medium">{documentNumber}</span>
        </p>
        <p className="text-gray-500 text-sm mb-6">Will convert to MI upon approval. Approval: {approvalLevel.label}</p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              reset();
              setFormData({});
              setLineItems([]);
            }}
            className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 transition-all"
          >
            Create Another
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-3 bg-nesma-primary border border-nesma-primary/50 text-white rounded-xl transition-all"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10 animate-fade-in">
      <div className="flex items-center gap-2 mb-8 text-sm text-gray-400">
        <span
          onClick={() => navigate('/admin')}
          className="cursor-pointer hover:text-nesma-secondary transition-colors"
        >
          Dashboard
        </span>
        <span className="text-gray-600">/</span>
        <span className="text-white font-medium">Material Request</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <div className="border-b border-white/10 p-8 bg-gradient-to-r from-nesma-primary/20 to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Material Request Form</h1>
              <p className="text-gray-400 mb-2">Request materials for your project</p>
              <span className="text-xs font-mono bg-nesma-secondary/10 text-nesma-secondary border border-nesma-secondary/30 px-2 py-1 rounded">
                {nextNumber}
              </span>
            </div>
            {documentNumber && (
              <ExportButton
                onExportPdf={() =>
                  generateMrPdf({
                    documentNumber: documentNumber ?? nextNumber,
                    project: String(formData.project ?? ''),
                    requester: currentUserName,
                    requiredDate: new Date().toISOString().split('T')[0],
                    priority: String(formData.priority ?? 'medium'),
                    status: 'submitted',
                    items: lineItems.map(li => ({
                      itemCode: li.itemCode ?? '',
                      itemName: li.itemName ?? '',
                      unit: li.unit ?? '',
                      qtyRequested: li.quantity ?? 0,
                    })),
                    notes: String(formData.notes ?? ''),
                  })
                }
              />
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
              Request Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Project <span className="text-red-400">*</span>
                </label>
                <select
                  onChange={e => handleChange('project', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">Select Project...</option>
                  {projects.map(p => (
                    <option key={p.id as string} value={p.id as string}>
                      {displayStr(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Preferred Warehouse</label>
                <select
                  onChange={e => handleChange('warehouse', e.target.value)}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">Auto-select best</option>
                  {warehouses.map(w => (
                    <option key={w.id as string} value={w.id as string}>
                      {displayStr(w)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Priority <span className="text-red-400">*</span>
                </label>
                <select
                  onChange={e => handleChange('priority', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Requester</label>
                <input
                  type="text"
                  value={currentUserName}
                  readOnly
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-gray-400 outline-none cursor-not-allowed"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Notes</label>
              <textarea
                onChange={e => handleChange('notes', e.target.value)}
                placeholder="Reason for request, special requirements..."
                className="nesma-input px-4 py-3 w-full min-h-[100px] bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
              />
            </div>
          </div>

          <LineItemsTable items={lineItems} onItemsChange={setLineItems} />

          {/* Approval + Auto-conversion indicator */}
          {totalValue > 0 && (
            <div className="glass-card rounded-xl p-4 border border-white/10 bg-gradient-to-r from-white/5 to-transparent space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={18} className="text-nesma-secondary" />
                  <span className="text-sm text-gray-300">
                    Required Approval:{' '}
                    <span
                      className={`font-medium ${totalValue >= 100000 ? 'text-orange-400' : totalValue >= 50000 ? 'text-yellow-400' : 'text-green-400'}`}
                    >
                      {approvalLevel.label}
                    </span>
                  </span>
                </div>
                <span className="text-nesma-secondary font-bold text-lg">{totalValue.toLocaleString()} SAR</span>
              </div>
              <p className="text-xs text-gray-500">
                Upon approval, this MR will auto-convert to an MI (Material Issuance)
              </p>
            </div>
          )}

          <div className="pt-8 border-t border-white/10 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-nesma-primary hover:bg-nesma-accent text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <Save size={18} />
              {submitting ? 'Submitting...' : 'Submit Requisition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
