import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, CheckCircle } from 'lucide-react';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';
import { LineItemsTable } from '@/components/LineItemsTable';
import { ExportButton } from '@/components/ExportButton';
import { useCreateWt } from '@/api/hooks/useWt';
import { useWarehouses, useProjects } from '@/api/hooks/useMasterData';
import { previewNextNumber } from '@/utils/autoNumber';
import { displayStr } from '@/utils/displayStr';
import { generateWtPdf } from '@/utils/pdfExport';

export const StockTransferForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({
    transferType: 'inter_warehouse',
  });
  const [lineItems, setLineItems] = useState<VoucherLineItem[]>([]);

  const createMutation = useCreateWt();
  const warehouseQuery = useWarehouses({ pageSize: 200 });
  const projectQuery = useProjects({ pageSize: 200 });
  const warehouses = (warehouseQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;
  const projects = (projectQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;

  const totalValue = useMemo(() => lineItems.reduce((s, i) => s + i.totalPrice, 0), [lineItems]);
  const nextNumber = useMemo(() => previewNextNumber('stock-transfer'), []);

  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);
  const submitting = createMutation.isPending;

  const handleChange = (key: string, value: string | number | boolean | null) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Map frontend field names → Prisma StockTransfer model field names
    const transferTypeMap: Record<string, string> = {
      inter_warehouse: 'warehouse_to_warehouse',
      inter_project: 'project_to_project',
    };

    const dateStr = String(formData.date || new Date().toISOString().split('T')[0]);
    const transferDate = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00.000Z`;

    const payload: Record<string, unknown> = {
      transferType: transferTypeMap[String(formData.transferType)] || formData.transferType,
      fromWarehouseId: formData.fromWarehouse || undefined,
      toWarehouseId: formData.toWarehouse || undefined,
      fromProjectId: formData.fromProject || undefined,
      toProjectId: formData.toProject || undefined,
      transferDate,
      notes: formData.notes,
      lines: lineItems.map(li => ({
        itemId: li.itemId,
        quantity: li.quantity,
        uomId: li.uomId,
      })),
    };

    createMutation.mutate(payload, {
      onSuccess: res => {
        const data = (res as { data?: { transferNumber?: string } })?.data;
        setDocumentNumber(data?.transferNumber ?? 'WT-NEW');
        setSubmitted(true);
      },
    });
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
        <h2 className="text-3xl font-bold text-white mb-2">Stock Transfer Created</h2>
        <p className="text-gray-400 mb-6">
          Transfer <span className="text-nesma-secondary font-medium">{documentNumber}</span> —{' '}
          {totalValue.toLocaleString()} SAR
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              reset();
              setFormData({ transferType: 'inter_warehouse' });
              setLineItems([]);
            }}
            className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 transition-all"
          >
            Create Another
          </button>
          <button
            onClick={() => navigate('/admin/warehouse/stock-transfer')}
            className="px-6 py-3 bg-nesma-primary border border-nesma-primary/50 text-white rounded-xl transition-all"
          >
            View All Transfers
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
        <span className="text-white font-medium">Stock Transfer</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <div className="border-b border-white/10 p-8 bg-gradient-to-r from-nesma-primary/20 to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Stock Transfer</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-mono bg-nesma-secondary/10 text-nesma-secondary border border-nesma-secondary/30 px-2 py-1 rounded">
                  {nextNumber}
                </span>
              </div>
            </div>
            {documentNumber && (
              <ExportButton
                onExportPdf={() =>
                  generateWtPdf({
                    documentNumber: documentNumber ?? nextNumber,
                    fromWarehouse: String(formData.fromWarehouse ?? ''),
                    toWarehouse: String(formData.toWarehouse ?? ''),
                    transferType: String(formData.transferType ?? 'inter_warehouse'),
                    requestedBy: '',
                    status: 'created',
                    items: lineItems.map(li => ({
                      itemCode: li.itemCode ?? '',
                      itemName: li.itemName ?? '',
                      unit: li.unit ?? '',
                      qty: li.quantity ?? 0,
                    })),
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
              Transfer Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Transfer Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={String(formData.transferType ?? '')}
                  onChange={e => handleChange('transferType', e.target.value)}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="inter_warehouse">Between Warehouses</option>
                  <option value="inter_project">Between Projects</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  onChange={e => handleChange('date', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  From Warehouse <span className="text-red-400">*</span>
                </label>
                <select
                  onChange={e => handleChange('fromWarehouse', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">Select...</option>
                  {warehouses.map(w => (
                    <option key={w.id as string} value={w.id as string}>
                      {displayStr(w)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  To Warehouse <span className="text-red-400">*</span>
                </label>
                <select
                  onChange={e => handleChange('toWarehouse', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">Select...</option>
                  {warehouses.map(w => (
                    <option key={w.id as string} value={w.id as string}>
                      {displayStr(w)}
                    </option>
                  ))}
                </select>
              </div>
              {formData.transferType === 'inter_project' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">From Project</label>
                    <select
                      onChange={e => handleChange('fromProject', e.target.value)}
                      className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                    >
                      <option value="">Select...</option>
                      {projects.map(p => (
                        <option key={p.id as string} value={p.id as string}>
                          {displayStr(p)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">To Project</label>
                    <select
                      onChange={e => handleChange('toProject', e.target.value)}
                      className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                    >
                      <option value="">Select...</option>
                      {projects.map(p => (
                        <option key={p.id as string} value={p.id as string}>
                          {displayStr(p)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Approval indicator for inter-project */}
          {formData.transferType === 'inter_project' && (
            <div className="glass-card rounded-xl p-4 border border-amber-500/20 bg-amber-500/5">
              <p className="text-sm text-amber-400">Inter-project transfers require approval before processing.</p>
            </div>
          )}

          <LineItemsTable items={lineItems} onItemsChange={setLineItems} />

          <div className="pt-8 border-t border-white/10 flex justify-between items-center">
            {totalValue > 0 && (
              <div className="text-sm text-gray-400">
                Total Value:{' '}
                <span className="text-nesma-secondary font-bold text-lg">{totalValue.toLocaleString()} SAR</span>
              </div>
            )}
            <div className="flex gap-4 ml-auto">
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
                {submitting ? 'Saving...' : 'Create Transfer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
