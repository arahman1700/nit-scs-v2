import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Droplets, CheckCircle, Loader2 } from 'lucide-react';
import type { Generator } from '@nit-scs-v2/shared/types';
import { useCreateGeneratorFuel, useGeneratorFuel, useUpdateGeneratorFuel } from '@/api/hooks';
import { useGenerators } from '@/api/hooks/useMasterData';

interface FuelDoc {
  id?: string;
  formNumber?: string;
  [key: string]: unknown;
}

export const GeneratorFuelForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const createMutation = useCreateGeneratorFuel();
  const updateMutation = useUpdateGeneratorFuel();

  // Fetch existing doc if editing
  const detailQuery = useGeneratorFuel(id);
  const existingDoc = (detailQuery.data as { data?: FuelDoc } | undefined)?.data;

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

  // Auto-calculate total cost
  React.useEffect(() => {
    const qty = formData.fuelQtyLiters as number | null;
    const costPerLiter = formData.costPerLiter as number | null;
    if (qty && costPerLiter) {
      setFormData(p => ({ ...p, totalCost: Math.round(qty * costPerLiter * 100) / 100 }));
    }
  }, [formData.fuelQtyLiters, formData.costPerLiter]);

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
        <h2 className="text-2xl font-bold text-white mb-2">{isEditMode ? 'Fuel Log Updated' : 'Fuel Log Created'}</h2>
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
        <span className="ml-3 text-gray-400">Loading fuel log...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Droplets className="w-8 h-8 text-nesma-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Generator Fuel Log</h1>
          <p className="text-gray-400 text-sm">Record fuel consumption for generators</p>
        </div>
      </div>

      {/* ── Fuel Details ────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Fuel Details</h2>
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

          {/* Fuel Date */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Fuel Date</label>
            <input
              type="date"
              value={(formData.fuelDate as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, fuelDate: e.target.value }))}
              className="input-field w-full"
              required
            />
          </div>

          {/* Fuel Quantity */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Fuel Quantity (Liters)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={(formData.fuelQtyLiters as number) ?? ''}
              onChange={e =>
                setFormData(p => ({ ...p, fuelQtyLiters: e.target.value ? Number(e.target.value) : null }))
              }
              className="input-field w-full"
              required
            />
          </div>

          {/* Meter Reading */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Meter Reading</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={(formData.meterReading as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, meterReading: e.target.value ? Number(e.target.value) : null }))}
              className="input-field w-full"
              placeholder="Optional"
            />
          </div>

          {/* Fuel Supplier */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Fuel Supplier</label>
            <input
              type="text"
              value={(formData.fuelSupplier as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, fuelSupplier: e.target.value }))}
              className="input-field w-full"
              placeholder="Optional"
            />
          </div>

          {/* Cost Per Liter */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Cost Per Liter</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={(formData.costPerLiter as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, costPerLiter: e.target.value ? Number(e.target.value) : null }))}
              className="input-field w-full"
              placeholder="Optional"
            />
          </div>

          {/* Total Cost (auto-calculated or manual) */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Total Cost</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={(formData.totalCost as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, totalCost: e.target.value ? Number(e.target.value) : null }))}
              className="input-field w-full"
              placeholder="Auto-calculated or enter manually"
            />
          </div>
        </div>
      </div>

      {/* ── Notes ───────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Additional Information</h2>
        <div>
          <label className="block text-gray-400 text-sm mb-1">Notes</label>
          <textarea
            value={(formData.notes as string) ?? ''}
            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
            className="input-field w-full"
            rows={3}
            placeholder="Additional notes or remarks..."
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
          {isPending ? 'Saving...' : isEditMode ? 'Update Fuel Log' : 'Create Fuel Log'}
        </button>
      </div>
    </form>
  );
};
