import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Truck, CheckCircle, Loader2 } from 'lucide-react';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';
import { LineItemsTable } from '@/components/LineItemsTable';
import { useProjects } from '@/api/hooks/useMasterData';
import { useCreateImsf } from '@/api/hooks/useImsf';
import type { Project } from '@nit-scs-v2/shared/types';
import { previewNextNumber } from '@/utils/autoNumber';

export const ImsfForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({
    materialType: 'normal',
  });
  const [lineItems, setLineItems] = useState<VoucherLineItem[]>([]);

  const projectQuery = useProjects({ pageSize: 200 });
  const projects = (projectQuery.data?.data ?? []) as Project[];

  const nextNumber = useMemo(() => previewNextNumber('imsf'), []);
  const createMutation = useCreateImsf();

  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      lines: lineItems.map(li => ({
        itemCode: li.itemCode,
        itemName: li.itemName,
        unit: li.unit,
        quantity: li.quantity,
      })),
    };
    createMutation.mutate(payload, {
      onSuccess: res => {
        const doc = res as unknown as { data?: { imsfNumber?: string } };
        setDocumentNumber(doc.data?.imsfNumber ?? nextNumber);
        setSubmitted(true);
      },
    });
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">IMSF Created</h2>
        <p className="text-gray-400 mb-6">Document #{documentNumber}</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({ materialType: 'normal' });
              setLineItems([]);
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
        <Truck className="w-8 h-8 text-nesma-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Internal Material Shifting Form</h1>
          <p className="text-gray-400 text-sm">Transfer materials between projects — #{nextNumber}</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Header Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Sender Project</label>
            <select
              value={(formData.senderProjectId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, senderProjectId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Receiver Project</label>
            <select
              value={(formData.receiverProjectId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, receiverProjectId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Material Type</label>
            <select
              value={(formData.materialType as string) ?? 'normal'}
              onChange={e => setFormData(p => ({ ...p, materialType: e.target.value }))}
              className="input-field w-full"
            >
              <option value="normal">Normal</option>
              <option value="hazardous">Hazardous</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Required Date</label>
            <input
              type="date"
              value={(formData.requiredDate as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, requiredDate: e.target.value }))}
              className="input-field w-full"
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

      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">Line Items</h2>
        <LineItemsTable items={lineItems} onItemsChange={setLineItems} />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6 py-2 rounded-lg">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || lineItems.length === 0}
          className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {createMutation.isPending ? 'Creating...' : 'Create IMSF'}
        </button>
      </div>
    </form>
  );
};
