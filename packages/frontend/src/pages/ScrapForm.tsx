import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Recycle, CheckCircle } from 'lucide-react';
import { SCRAP_MATERIAL_TYPES } from '@nit-scs-v2/shared/constants';
import type { Project, Warehouse } from '@nit-scs-v2/shared/types';
import { useCreateScrap } from '@/api/hooks';
import { useProjects, useWarehouses } from '@/api/hooks/useMasterData';
import { previewNextNumber } from '@/utils/autoNumber';

export const ScrapForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const createMutation = useCreateScrap();

  const projectQuery = useProjects({ pageSize: 200 });
  const projects = (projectQuery.data?.data ?? []) as Project[];

  const warehouseQuery = useWarehouses({ pageSize: 200 });
  const warehouses = (warehouseQuery.data?.data ?? []) as Warehouse[];

  const nextNumber = useMemo(() => previewNextNumber('scrap'), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData as Record<string, unknown>, {
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
        <h2 className="text-2xl font-bold text-white mb-2">Scrap Report Created</h2>
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
        <Recycle className="w-8 h-8 text-nesma-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Scrap Report Form</h1>
          <p className="text-gray-400 text-sm">Report scrap materials for disposal — #{nextNumber}</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Scrap Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Project</label>
            <select
              value={(formData.projectId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, projectId: e.target.value }))}
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
            <label className="block text-gray-400 text-sm mb-1">Warehouse</label>
            <select
              value={(formData.warehouseId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, warehouseId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select warehouse...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Material Type</label>
            <select
              value={(formData.materialType as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, materialType: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select material type...</option>
              {SCRAP_MATERIAL_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Quantity</label>
            <input
              type="number"
              value={(formData.qty as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, qty: Number(e.target.value) }))}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Packaging</label>
            <input
              type="text"
              value={(formData.packaging as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, packaging: e.target.value }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Condition</label>
            <select
              value={(formData.condition as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, condition: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select condition...</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Estimated Value</label>
            <input
              type="number"
              value={(formData.estimatedValue as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, estimatedValue: Number(e.target.value) }))}
              className="input-field w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-1">Description</label>
          <textarea
            value={(formData.description as string) ?? ''}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
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
          {createMutation.isPending ? 'Creating...' : 'Create Scrap Report'}
        </button>
      </div>
    </form>
  );
};
