import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeftRight, CheckCircle, Loader2, PlayCircle } from 'lucide-react';
import type { Warehouse, Employee } from '@nit-scs-v2/shared/types';
import { toast } from '@/components/Toaster';
import { ExportButton } from '@/components/ExportButton';
import {
  useCreateHandover,
  useHandover,
  useUpdateHandover,
  useStartHandoverVerification,
  useCompleteHandover,
} from '@/api/hooks';
import { useWarehouses, useEmployees } from '@/api/hooks/useMasterData';
import { previewNextNumber } from '@/utils/autoNumber';
import { generateHandoverPdf } from '@/utils/pdfExport';

interface HandoverDoc {
  id?: string;
  formNumber?: string;
  status?: string;
  inventoryVerified?: boolean;
  [key: string]: unknown;
}

export const HandoverForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const createMutation = useCreateHandover();
  const updateMutation = useUpdateHandover();
  const startVerification = useStartHandoverVerification();
  const completeMutation = useCompleteHandover();

  // Fetch existing doc if editing
  const detailQuery = useHandover(id);
  const existingDoc = (detailQuery.data as { data?: HandoverDoc } | undefined)?.data;

  // Master data
  const warehouseQuery = useWarehouses({ pageSize: 200 });
  const warehouses = (warehouseQuery.data?.data ?? []) as Warehouse[];

  const employeeQuery = useEmployees({ pageSize: 500 });
  const employees = (employeeQuery.data?.data ?? []) as Employee[];

  const nextNumber = useMemo(() => previewNextNumber('handover'), []);

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
          toast.success('Handover Updated', 'Document has been saved successfully');
        },
        onError: (err: Error) => {
          toast.error('Update Failed', err.message || 'Failed to update handover');
        },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: res => {
          setDocumentNumber((res as unknown as { data?: { formNumber?: string } }).data?.formNumber ?? nextNumber);
          setSubmitted(true);
          toast.success('Handover Created', 'New handover document has been created');
        },
        onError: (err: Error) => {
          toast.error('Creation Failed', err.message || 'Failed to create handover');
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
        <h2 className="text-2xl font-bold text-white mb-2">{isEditMode ? 'Handover Updated' : 'Handover Created'}</h2>
        <p className="text-gray-400 mb-6">Document #{documentNumber}</p>
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
        <span className="ml-3 text-gray-400">Loading handover...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <ArrowLeftRight className="w-8 h-8 text-nesma-secondary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Warehouse Handover Form</h1>
          <p className="text-gray-400 text-sm">
            Employee-to-employee warehouse handover -- #{isEditMode ? id : nextNumber}
          </p>
        </div>
        {isEditMode && existingDoc && (
          <ExportButton
            onExportPdf={() => {
              const warehouse = warehouses.find(w => w.id === formData.warehouseId);
              const outgoing = employees.find(e => e.id === formData.outgoingEmployeeId);
              const incoming = employees.find(e => e.id === formData.incomingEmployeeId);
              generateHandoverPdf({
                documentNumber: existingDoc.formNumber ?? id ?? '',
                warehouse: warehouse?.name ?? String(formData.warehouseId ?? ''),
                outgoingEmployee: outgoing?.name ?? String(formData.outgoingEmployeeId ?? ''),
                incomingEmployee: incoming?.name ?? String(formData.incomingEmployeeId ?? ''),
                handoverDate: String(formData.handoverDate ?? ''),
                inventoryVerified: !!formData.inventoryVerified,
                discrepanciesFound: String(formData.discrepancies ?? ''),
                status: String(existingDoc.status ?? ''),
                notes: String(formData.notes ?? ''),
              });
            }}
          />
        )}
      </div>

      {/* ── Handover Details ────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Handover Details</h2>
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

          {/* Handover Date */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Handover Date</label>
            <input
              type="date"
              value={(formData.handoverDate as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, handoverDate: e.target.value }))}
              className="input-field w-full"
              required
            />
          </div>

          {/* Outgoing Employee */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Outgoing Employee</label>
            <select
              value={(formData.outgoingEmployeeId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, outgoingEmployeeId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select outgoing employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Incoming Employee */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Incoming Employee</label>
            <select
              value={(formData.incomingEmployeeId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, incomingEmployeeId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select incoming employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Verification ────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Inventory Verification</h2>

        {/* Inventory Verified Checkbox */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!formData.inventoryVerified}
            onChange={e => setFormData(p => ({ ...p, inventoryVerified: e.target.checked }))}
            className="w-5 h-5 rounded border-white/20 bg-white/5 text-nesma-primary focus:ring-nesma-secondary focus:ring-offset-0"
          />
          <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
            Inventory has been physically verified and counted
          </span>
        </label>

        {/* Discrepancies Found */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">Discrepancies Found</label>
          <textarea
            value={(formData.discrepancies as string) ?? ''}
            onChange={e => setFormData(p => ({ ...p, discrepancies: e.target.value }))}
            className="input-field w-full"
            rows={4}
            placeholder="Describe any discrepancies found during inventory verification..."
          />
        </div>

        {/* Notes */}
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
          {isPending ? 'Saving...' : isEditMode ? 'Update Handover' : 'Create Handover'}
        </button>
      </div>

      {/* ── Workflow Actions ──────────────────────────────────────────── */}
      {isEditMode && existingDoc && (
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold">Workflow Actions</h2>
          <div className="flex items-center gap-3">
            {existingDoc.status === 'initiated' && (
              <button
                type="button"
                onClick={() =>
                  startVerification.mutate(id!, {
                    onSuccess: () => {
                      detailQuery.refetch();
                      toast.success('Verification Started');
                    },
                    onError: (err: Error) => {
                      toast.error('Action Failed', err.message);
                    },
                  })
                }
                disabled={startVerification.isPending}
                className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                {startVerification.isPending ? 'Starting...' : 'Start Verification'}
              </button>
            )}
            {existingDoc.status === 'in_progress' && (
              <button
                type="button"
                onClick={() =>
                  completeMutation.mutate(id!, {
                    onSuccess: () => {
                      detailQuery.refetch();
                      toast.success('Handover Completed');
                    },
                    onError: (err: Error) => {
                      toast.error('Action Failed', err.message);
                    },
                  })
                }
                disabled={completeMutation.isPending || !existingDoc.inventoryVerified}
                className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {completeMutation.isPending ? 'Completing...' : 'Complete Handover'}
              </button>
            )}
            {existingDoc.status === 'completed' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Completed
              </span>
            )}
          </div>
          {existingDoc.status === 'in_progress' && !existingDoc.inventoryVerified && (
            <p className="text-amber-400 text-xs">Inventory must be verified before completing the handover.</p>
          )}
        </div>
      )}
    </form>
  );
};
