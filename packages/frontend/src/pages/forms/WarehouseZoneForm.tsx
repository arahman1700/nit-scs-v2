import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, MapPin, CheckCircle, Loader2 } from 'lucide-react';
import type { Warehouse } from '@nit-scs-v2/shared/types';
import { useCreateWarehouseZone, useWarehouseZone, useUpdateWarehouseZone } from '@/api/hooks';
import { useWarehouses } from '@/api/hooks/useMasterData';

interface ZoneDoc {
  id?: string;
  formNumber?: string;
  [key: string]: unknown;
}

const ZONE_TYPES = [
  { value: 'civil', label: 'Civil' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'container', label: 'Container' },
  { value: 'open_yard', label: 'Open Yard' },
  { value: 'hazardous', label: 'Hazardous' },
];

export const WarehouseZoneForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const createMutation = useCreateWarehouseZone();
  const updateMutation = useUpdateWarehouseZone();

  // Fetch existing doc if editing
  const detailQuery = useWarehouseZone(id);
  const existingDoc = (detailQuery.data as { data?: ZoneDoc } | undefined)?.data;

  // Master data
  const warehouseQuery = useWarehouses({ pageSize: 200 });
  const warehouses = (warehouseQuery.data?.data ?? []) as Warehouse[];

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
        <h2 className="text-2xl font-bold text-white mb-2">{isEditMode ? 'Zone Updated' : 'Zone Created'}</h2>
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
        <span className="ml-3 text-gray-400">Loading zone...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <MapPin className="w-8 h-8 text-nesma-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Warehouse Zone Form</h1>
          <p className="text-gray-400 text-sm">Define zones within a warehouse for material organization</p>
        </div>
      </div>

      {/* ── Zone Details ────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Zone Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Warehouse */}
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

          {/* Zone Name */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Zone Name</label>
            <input
              type="text"
              value={(formData.zoneName as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, zoneName: e.target.value }))}
              className="input-field w-full"
              placeholder="e.g. Civil Materials Zone"
              required
            />
          </div>

          {/* Zone Code */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Zone Code</label>
            <input
              type="text"
              value={(formData.zoneCode as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, zoneCode: e.target.value }))}
              className="input-field w-full"
              placeholder="e.g. A, B, C, D"
              required
            />
          </div>

          {/* Zone Type */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Zone Type</label>
            <select
              value={(formData.zoneType as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, zoneType: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select type...</option>
              {ZONE_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Capacity</label>
            <input
              type="number"
              min="0"
              value={(formData.capacity as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, capacity: e.target.value ? Number(e.target.value) : null }))}
              className="input-field w-full"
              placeholder="Optional"
            />
          </div>

          {/* Current Occupancy */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Current Occupancy</label>
            <input
              type="number"
              min="0"
              value={(formData.currentOccupancy as number) ?? ''}
              onChange={e =>
                setFormData(p => ({
                  ...p,
                  currentOccupancy: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="input-field w-full"
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6 py-2 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2">
          <Save className="w-4 h-4" />
          {isPending ? 'Saving...' : isEditMode ? 'Update Zone' : 'Create Zone'}
        </button>
      </div>
    </form>
  );
};
