import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, FileCheck, CheckCircle } from 'lucide-react';
import { useShipmentList, useAddCustomsStage } from '@/api/hooks/useShipments';
import { previewNextNumber } from '@/utils/autoNumber';

/** Safely extract a display string from a value that may be a string or a nested relation object */
const displayStr = (val: unknown): string => {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return String(obj.supplierName ?? obj.warehouseName ?? obj.projectName ?? obj.fullName ?? obj.name ?? obj.id ?? '');
  }
  return String(val);
};

export const CustomsForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});

  const shipmentQuery = useShipmentList({ pageSize: 100 });
  const shipmentData = (shipmentQuery.data?.data ?? []) as Array<Record<string, unknown>>;

  const createMutation = useAddCustomsStage();

  const nextNumber = useMemo(() => previewNextNumber('customs'), []);
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);
  const submitting = createMutation.isPending;

  const handleChange = (key: string, value: string | number | boolean | null) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const reset = () => {
    setSubmitted(false);
    setDocumentNumber(null);
    createMutation.reset();
  };

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const { shipmentId, ...rest } = formData;
    if (!shipmentId) {
      setValidationError('Please select a shipment before submitting.');
      return;
    }

    createMutation.mutate(
      {
        id: shipmentId as string,
        ...rest,
        status: 'Submitted',
        submissionDate: new Date().toISOString().split('T')[0],
      },
      {
        onSuccess: res => {
          setDocumentNumber((res as { data?: { formNumber?: string } })?.data?.formNumber ?? 'CUS-NEW');
          setSubmitted(true);
        },
      },
    );
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] glass-card rounded-2xl p-8 text-center animate-fade-in mx-auto max-w-2xl mt-10 border border-green-500/30 bg-gradient-to-b from-green-900/10 to-transparent">
        <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6 border border-green-500/50">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Customs Record Created</h2>
        <p className="text-gray-400 mb-6">
          <span className="text-nesma-secondary font-medium">{documentNumber}</span>
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              reset();
              setFormData({});
            }}
            className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 transition-all"
          >
            Create Another
          </button>
          <button
            onClick={() => navigate('/admin/shipping/customs')}
            className="px-6 py-3 bg-nesma-primary border border-nesma-primary/50 text-white rounded-xl transition-all"
          >
            View Customs
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
        <span className="text-white font-medium">Customs Clearance</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <div className="border-b border-white/10 p-8 bg-gradient-to-r from-nesma-primary/20 to-transparent flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Customs Clearance</h1>
            <span className="text-xs font-mono bg-nesma-secondary/10 text-nesma-secondary border border-nesma-secondary/30 px-2 py-1 rounded">
              {nextNumber}
            </span>
          </div>
          <div className="h-14 w-14 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
            <FileCheck className="text-nesma-secondary" size={28} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
              Shipment Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Linked Shipment <span className="text-red-400">*</span>
                </label>
                <select
                  onChange={e => handleChange('shipmentId', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">Select Shipment...</option>
                  {shipmentData.map(s => (
                    <option key={s.id as string} value={s.id as string}>
                      {s.id as string} - {displayStr(s.supplier) || 'N/A'} ({(s.status as string) || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Declaration Number</label>
                <input
                  type="text"
                  onChange={e => handleChange('declarationNumber', e.target.value)}
                  placeholder="SAD-2026-XXXXX"
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
              Customs Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">HS Code</label>
                <input
                  type="text"
                  onChange={e => handleChange('hsCode', e.target.value)}
                  placeholder="8544.49"
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Customs Broker</label>
                <input
                  type="text"
                  onChange={e => handleChange('brokerName', e.target.value)}
                  placeholder="Broker name"
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Customs Fees (SAR)</label>
                <input
                  type="number"
                  min="0"
                  onChange={e => handleChange('customsFees', Number(e.target.value))}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">VAT Amount (SAR)</label>
                <input
                  type="number"
                  min="0"
                  onChange={e => handleChange('vatAmount', Number(e.target.value))}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Broker Contact</label>
                <input
                  type="text"
                  onChange={e => handleChange('brokerContact', e.target.value)}
                  placeholder="Phone/Email"
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Notes</label>
              <textarea
                onChange={e => handleChange('notes', e.target.value)}
                placeholder="Additional customs notes..."
                className="nesma-input px-4 py-3 w-full min-h-[100px] bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
              />
            </div>
          </div>

          {/* Status Flow */}
          <div className="glass-card rounded-xl p-4 border border-white/10 bg-gradient-to-r from-white/5 to-transparent">
            <p className="text-xs text-gray-500 mb-2">Status Flow</p>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {['Submitted', 'Under Review', 'Additional Docs Required', 'Cleared', 'Released'].map((s, i, arr) => (
                <React.Fragment key={s}>
                  <span
                    className={`px-2 py-1 rounded ${i === 0 ? 'bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30' : 'bg-white/5 text-gray-500 border border-white/10'}`}
                  >
                    {s}
                  </span>
                  {i < arr.length - 1 && <span className="text-gray-600">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <FileCheck size={16} className="shrink-0" />
              <span>{validationError}</span>
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
              {submitting ? 'Saving...' : 'Submit to Customs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
