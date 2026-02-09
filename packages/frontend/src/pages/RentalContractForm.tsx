import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, FileSignature, CheckCircle } from 'lucide-react';
import type { VoucherLineItem, Supplier } from '@nit-scs-v2/shared/types';
import { LineItemsTable } from '@/components/LineItemsTable';
import { useCreateRentalContract } from '@/api/hooks';
import { useSuppliers } from '@/api/hooks/useMasterData';
import { previewNextNumber } from '@/utils/autoNumber';

export const RentalContractForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [lineItems, setLineItems] = useState<VoucherLineItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const createMutation = useCreateRentalContract();

  const supplierQuery = useSuppliers({ pageSize: 200 });
  const suppliers = (supplierQuery.data?.data ?? []) as Supplier[];

  const nextNumber = useMemo(() => previewNextNumber('rc'), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...formData, lineItems } as Record<string, unknown>, {
      onSuccess: res => {
        setDocumentNumber((res as unknown as { data?: { formNumber?: string } }).data?.formNumber ?? nextNumber);
        setSubmitted(true);
      },
    });
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Rental Contract Created</h2>
        <p className="text-gray-400 mb-6">Document #{documentNumber}</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({});
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
        <FileSignature className="w-8 h-8 text-nesma-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Rental Contract</h1>
          <p className="text-gray-400 text-sm">Equipment rental agreement — #{nextNumber}</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Header Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Supplier</label>
            <select
              value={(formData.supplierId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, supplierId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select supplier...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Equipment Type</label>
            <input
              type="text"
              value={(formData.equipmentType as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, equipmentType: e.target.value }))}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Start Date</label>
            <input
              type="date"
              value={(formData.startDate as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">End Date</label>
            <input
              type="date"
              value={(formData.endDate as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Monthly Rate</label>
            <input
              type="number"
              value={(formData.monthlyRate as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, monthlyRate: Number(e.target.value) }))}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Daily Rate</label>
            <input
              type="number"
              value={(formData.dailyRate as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, dailyRate: Number(e.target.value) }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Insurance Value</label>
            <input
              type="number"
              value={(formData.insuranceValue as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, insuranceValue: Number(e.target.value) }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Insurance Expiry</label>
            <input
              type="date"
              value={(formData.insuranceExpiry as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, insuranceExpiry: e.target.value }))}
              className="input-field w-full"
            />
          </div>
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
          <Save className="w-4 h-4" />
          {createMutation.isPending ? 'Creating...' : 'Create Rental Contract'}
        </button>
      </div>
    </form>
  );
};
