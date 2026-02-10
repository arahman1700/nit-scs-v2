import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Wrench, CheckCircle, Loader2 } from 'lucide-react';
import type { Generator } from '@nit-scs-v2/shared/types';
import { useCreateGeneratorMaintenance, useGeneratorMaintenance, useUpdateGeneratorMaintenance } from '@/api/hooks';
import { useGenerators } from '@/api/hooks/useMasterData';

interface MaintenanceDoc {
  id?: string;
  formNumber?: string;
  [key: string]: unknown;
}

const MAINTENANCE_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
];

export const GeneratorMaintenanceForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const createMutation = useCreateGeneratorMaintenance();
  const updateMutation = useUpdateGeneratorMaintenance();

  // Fetch existing doc if editing
  const detailQuery = useGeneratorMaintenance(id);
  const existingDoc = (detailQuery.data as { data?: MaintenanceDoc } | undefined)?.data;

  // Master data
  const generatorQuery = useGenerators({ pageSize: 200 });
  const generators = (generatorQuery.data?.data ?? []) as Generator[];

  // Populate form from existing doc
  React.useEffect(() => {
    if (existingDoc && isEditMode) {
      const data: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(existingDoc)) {
        if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
          data[key] = value as string | number | boolean | null;
        }
      }
      setFormData(data);
    }
  }, [existingDoc, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData } as Record<string, unknown>;

    if (isEditMode && id) {
      updateMutation.mutate({ ...payload, id } as Record<string, unknown> & { id: string }, {
        onSuccess: () => {
          setDocumentNumber(existingDoc?.formNumber ?? id);
          setSubmitted(true);
        },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: res => {
          setDocumentNumber((res as unknown as { data?: { formNumber?: string } }).data?.formNumber ?? 'NEW');
          setSubmitted(true);
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Success View ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">
          {isEditMode ? 'Maintenance Updated' : 'Maintenance Scheduled'}
        </h2>
        <p className="text-gray-400 mb-6">Record #{documentNumber}</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({});
            }}
            className="btn-secondary px-4 py-2 rounded-lg"
          >
            {isEditMode ? 'Continue Editing' : 'Create Another'}
          </button>
          <button onClick={() => navigate(-1)} className="btn-primary px-4 py-2 rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Loading existing doc ─────────────────────────────────────────────────
  if (isEditMode && detailQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
        <span className="ml-3 text-gray-400">Loading maintenance record...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Wrench className="w-8 h-8 text-nesma-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Generator Maintenance Form</h1>
          <p className="text-gray-400 text-sm">Schedule and record generator maintenance activities</p>
        </div>
      </div>

      {/* ── Maintenance Details ──────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Maintenance Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Generator */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Generator</label>
            <select
              value={(formData.generatorId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, generatorId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select generator...</option>
              {generators.map(g => (
                <option key={g.id} value={g.id}>
                  {g.assetId} — {g.manufacturer} {g.model ?? ''} ({g.capacityKva} kVA)
                </option>
              ))}
            </select>
          </div>

          {/* Maintenance Type */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Maintenance Type</label>
            <select
              value={(formData.maintenanceType as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, maintenanceType: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select type...</option>
              {MAINTENANCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Scheduled Date</label>
            <input
              type="date"
              value={(formData.scheduledDate as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, scheduledDate: e.target.value }))}
              className="input-field w-full"
              required
            />
          </div>

          {/* Cost */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Cost</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={(formData.cost as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, cost: e.target.value ? Number(e.target.value) : null }))}
              className="input-field w-full"
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* ── Findings & Parts ───────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Findings &amp; Parts</h2>

        {/* Findings */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">Findings</label>
          <textarea
            value={(formData.findings as string) ?? ''}
            onChange={e => setFormData(p => ({ ...p, findings: e.target.value }))}
            className="input-field w-full"
            rows={3}
            placeholder="Describe maintenance findings..."
          />
        </div>

        {/* Parts Replaced */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">Parts Replaced</label>
          <textarea
            value={(formData.partsReplaced as string) ?? ''}
            onChange={e => setFormData(p => ({ ...p, partsReplaced: e.target.value }))}
            className="input-field w-full"
            rows={3}
            placeholder="List any parts replaced during maintenance..."
          />
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6 py-2 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2">
          <Save className="w-4 h-4" />
          {isPending ? 'Saving...' : isEditMode ? 'Update Maintenance' : 'Schedule Maintenance'}
        </button>
      </div>
    </form>
  );
};
