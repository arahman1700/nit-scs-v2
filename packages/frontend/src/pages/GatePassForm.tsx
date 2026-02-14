import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, LogOut, CheckCircle } from 'lucide-react';
import { useMirvList } from '@/api/hooks/useMirv';
import { useMrrvList } from '@/api/hooks/useMrrv';
import { useCreateGatePass } from '@/api/hooks/useGatePasses';
import { useWarehouses } from '@/api/hooks/useMasterData';
import type { Warehouse } from '@nit-scs-v2/shared/types';
import { previewNextNumber } from '@/utils/autoNumber';
import { displayStr } from '@/utils/displayStr';

export const GatePassForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedMirv = searchParams.get('mirv');
  const linkedMrrv = searchParams.get('mrrv');

  const mirvQuery = useMirvList({ pageSize: 100 });
  const mrrvQuery = useMrrvList({ pageSize: 100 });
  const warehouseQuery = useWarehouses({ pageSize: 200 });
  const mirvData = (mirvQuery.data?.data ?? []) as Array<Record<string, unknown>>;
  const mrrvData = (mrrvQuery.data?.data ?? []) as Array<Record<string, unknown>>;
  const warehouses = (warehouseQuery.data?.data ?? []) as Warehouse[];

  const createMutation = useCreateGatePass();

  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>(
    (): Record<string, string | number | boolean | null> => {
      if (linkedMirv) {
        return { type: 'Outbound', linkedDocument: linkedMirv, linkedDocumentType: 'MIRV' };
      }
      if (linkedMrrv) {
        return { type: 'Inbound', linkedDocument: linkedMrrv, linkedDocumentType: 'MRRV' };
      }
      return { type: 'Outbound' };
    },
  );

  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);
  const submitting = createMutation.isPending;

  const nextNumber = useMemo(() => previewNextNumber('gatepass'), []);

  const handleChange = (key: string, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { ...formData, date: formData.date || new Date().toISOString().split('T')[0] },
      {
        onSuccess: res => {
          setDocumentNumber((res as { data?: { formNumber?: string } })?.data?.formNumber ?? 'GP-NEW');
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
        <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6 border border-green-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Gate Pass Created</h2>
        <p className="text-gray-400 mb-6">
          Gate Pass <span className="text-nesma-secondary font-medium">{documentNumber}</span> has been created.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              reset();
              setFormData({ type: 'Outbound' });
            }}
            className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 transition-all"
          >
            Create Another
          </button>
          <button
            onClick={() => navigate('/admin/warehouse/gate-pass')}
            className="px-6 py-3 bg-nesma-primary border border-nesma-primary/50 text-white rounded-xl hover:shadow-lg transition-all"
          >
            View All Gate Passes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10 animate-fade-in">
      <div className="flex items-center gap-2 mb-8 text-sm text-gray-400">
        <span
          onClick={() => navigate('/admin')}
          className="cursor-pointer hover:text-nesma-secondary transition-colors"
        >
          Dashboard
        </span>
        <span className="text-gray-600">/</span>
        <span className="text-white font-medium">Gate Pass</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <div className="border-b border-white/10 p-8 bg-gradient-to-r from-nesma-primary/20 to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Gate Pass</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-mono bg-nesma-secondary/10 text-nesma-secondary border border-nesma-secondary/30 px-2 py-1 rounded">
                  {nextNumber}
                </span>
                <span className="text-xs text-gray-500">Auto-generated on submit</span>
              </div>
            </div>
            <div className="h-14 w-14 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <LogOut className="text-nesma-secondary" size={28} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Pass Type */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
              Pass Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={String(formData.type ?? '')}
                  onChange={e => handleChange('type', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                  <option value="Transfer">Transfer</option>
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
                  Warehouse <span className="text-red-400">*</span>
                </label>
                <select
                  value={String(formData.warehouse ?? '')}
                  onChange={e => handleChange('warehouse', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">Select...</option>
                  {warehouses.map(w => (
                    <option key={w.id as string} value={w.name as string}>
                      {w.name as string}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Linked Document</label>
                <select
                  value={String(formData.linkedDocument ?? '')}
                  onChange={e => handleChange('linkedDocument', e.target.value)}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">None (Manual)</option>
                  <optgroup label="MI (Material Issuance)">
                    {mirvData.map(m => (
                      <option key={m.id as string} value={m.id as string}>
                        {m.id as string} - {displayStr(m.project) || 'N/A'}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="GRN (Goods Receipt Notes)">
                    {mrrvData.map(m => (
                      <option key={m.id as string} value={m.id as string}>
                        {m.id as string} - {displayStr(m.supplier) || 'N/A'}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Vehicle / Driver */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
              Vehicle & Driver
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Vehicle Plate <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ABC 1234"
                  onChange={e => handleChange('vehiclePlate', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Driver Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full name"
                  onChange={e => handleChange('driverName', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Driver ID Number</label>
                <input
                  type="text"
                  placeholder="National ID"
                  onChange={e => handleChange('driverIdNumber', e.target.value)}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
              Additional Information
            </h3>
            <textarea
              placeholder="Notes..."
              onChange={e => handleChange('notes', e.target.value)}
              className="nesma-input px-4 py-3 w-full min-h-[100px] bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
            />
          </div>

          {/* Submit */}
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
              className="px-8 py-3 bg-nesma-primary hover:bg-nesma-accent text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-nesma-primary/30 transition-all transform hover:-translate-y-1 disabled:opacity-50"
            >
              <Save size={18} />
              {submitting ? 'Saving...' : 'Create Gate Pass'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
