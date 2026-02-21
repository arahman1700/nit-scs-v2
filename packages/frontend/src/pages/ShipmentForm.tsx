import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Ship, CheckCircle, Plus, Trash2 } from 'lucide-react';
import type { ShipmentLine, ShipmentDocument } from '@nit-scs-v2/shared/types';
import { ExportButton } from '@/components/ExportButton';
import { useCreateShipment } from '@/api/hooks/useShipments';
import { useSuppliers } from '@/api/hooks/useMasterData';
import type { Supplier } from '@nit-scs-v2/shared/types';
import { previewNextNumber } from '@/utils/autoNumber';
import { generateShipmentPdf } from '@/utils/pdfExport';

const PORTS = [
  'Dammam (King Abdulaziz Port)',
  'Jeddah (Islamic Port)',
  'Jubail (Commercial Port)',
  'Riyadh (Dry Port)',
  'Yanbu',
  'Jizan',
];
const DOCUMENT_TYPES: ShipmentDocument['type'][] = ['BOL', 'Invoice', 'Packing List', 'COO', 'Insurance'];

export const ShipmentForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({ shipmentType: 'Sea' });
  const [shipmentLines, setShipmentLines] = useState<ShipmentLine[]>([]);
  const [docChecklist, setDocChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(DOCUMENT_TYPES.map(t => [t, false])),
  );

  const createMutation = useCreateShipment();
  const supplierQuery = useSuppliers({ pageSize: 200 });
  const suppliers = (supplierQuery.data?.data ?? []) as Supplier[];

  const nextNumber = useMemo(() => previewNextNumber('shipment'), []);
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);
  const submitting = createMutation.isPending;

  const handleChange = (key: string, value: string | number | boolean | null) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const addLine = () => {
    setShipmentLines(prev => [
      ...prev,
      { id: `sl-${Date.now()}`, itemCode: '', itemName: '', quantity: 0, unit: 'Piece' },
    ]);
  };

  const removeLine = (id: string) => setShipmentLines(prev => prev.filter(l => l.id !== id));

  const updateLine = (id: string, field: string, value: string | number) => {
    setShipmentLines(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const reset = () => {
    setSubmitted(false);
    setDocumentNumber(null);
    createMutation.reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const documents = DOCUMENT_TYPES.map(type => ({
      id: `doc-${type}`,
      type,
      name: type,
      uploaded: docChecklist[type],
    }));
    createMutation.mutate(
      {
        ...formData,
        lineItems: shipmentLines,
        documents,
        status: 'draft',
      },
      {
        onSuccess: res => {
          setDocumentNumber((res as { data?: { formNumber?: string } })?.data?.formNumber ?? 'SHP-NEW');
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
        <h2 className="text-3xl font-bold text-white mb-2">Shipment Created</h2>
        <p className="text-gray-400 mb-6">
          Shipment <span className="text-nesma-secondary font-medium">{documentNumber}</span>
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              reset();
              setFormData({ shipmentType: 'Sea' });
              setShipmentLines([]);
            }}
            className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 transition-all"
          >
            Create Another
          </button>
          <button
            onClick={() => navigate('/admin/shipping/shipments')}
            className="px-6 py-3 bg-nesma-primary border border-nesma-primary/50 text-white rounded-xl transition-all"
          >
            View Shipments
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
        <span className="text-white font-medium">New Shipment</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <div className="border-b border-white/10 p-8 bg-gradient-to-r from-nesma-primary/20 to-transparent flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Shipment Tracking</h1>
            <span className="text-xs font-mono bg-nesma-secondary/10 text-nesma-secondary border border-nesma-secondary/30 px-2 py-1 rounded">
              {nextNumber}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {documentNumber && (
              <ExportButton
                onExportPdf={() =>
                  generateShipmentPdf({
                    documentNumber: documentNumber ?? nextNumber,
                    supplier: String(formData.supplier ?? ''),
                    poNumber: '',
                    carrier: String(formData.agent ?? ''),
                    etd: String(formData.etd ?? ''),
                    eta: String(formData.eta ?? ''),
                    port: String(formData.port ?? ''),
                    status: 'draft',
                    items: shipmentLines.map(sl => ({
                      itemCode: sl.itemCode ?? '',
                      itemName: sl.itemName ?? '',
                      unit: sl.unit ?? '',
                      qty: sl.quantity ?? 0,
                      weight: 0,
                    })),
                    notes: String(formData.description ?? ''),
                  })
                }
              />
            )}
            <div className="h-14 w-14 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <Ship className="text-nesma-secondary" size={28} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Shipment Info */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
              Shipment Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Supplier <span className="text-red-400">*</span>
                </label>
                <select
                  onChange={e => handleChange('supplier', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">Select...</option>
                  {suppliers.map(s => (
                    <option key={s.id as string} value={s.name as string}>
                      {s.name as string}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Shipment Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={String(formData.shipmentType ?? '')}
                  onChange={e => handleChange('shipmentType', e.target.value)}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="Sea">Sea Freight</option>
                  <option value="Air">Air Freight</option>
                  <option value="Land">Land Transport</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  Port of Discharge <span className="text-red-400">*</span>
                </label>
                <select
                  onChange={e => handleChange('port', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                >
                  <option value="">Select...</option>
                  {PORTS.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Estimated Value (SAR)</label>
                <input
                  type="number"
                  min="0"
                  onChange={e => handleChange('value', Number(e.target.value))}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  ETD <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  onChange={e => handleChange('etd', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  ETA <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  onChange={e => handleChange('eta', e.target.value)}
                  required
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">
                  {formData.shipmentType === 'Sea'
                    ? 'Container No.'
                    : formData.shipmentType === 'Air'
                      ? 'AWB Number'
                      : 'Truck Plate'}
                </label>
                <input
                  type="text"
                  onChange={e => handleChange('containerNumber', e.target.value)}
                  placeholder={formData.shipmentType === 'Sea' ? 'MSKU1234567' : 'AWB-12345678'}
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Freight Agent</label>
                <input
                  type="text"
                  onChange={e => handleChange('agent', e.target.value)}
                  placeholder="Agent name"
                  className="nesma-input px-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Description</label>
              <textarea
                onChange={e => handleChange('description', e.target.value)}
                placeholder="Shipment description..."
                className="nesma-input px-4 py-3 w-full min-h-[80px] bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
              />
            </div>
          </div>

          {/* Shipment Lines */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
                Items
              </h3>
              <button
                type="button"
                onClick={addLine}
                className="px-4 py-2 bg-white/5 text-gray-300 border border-white/10 rounded-lg text-sm flex items-center gap-2 hover:bg-white/10 transition-all"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
            {shipmentLines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="pb-3 px-2">#</th>
                      <th className="pb-3 px-2">Item Code</th>
                      <th className="pb-3 px-2 min-w-[200px]">Description</th>
                      <th className="pb-3 px-2">Qty</th>
                      <th className="pb-3 px-2">Unit</th>
                      <th className="pb-3 px-2">HS Code</th>
                      <th className="pb-3 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {shipmentLines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-white/5 group">
                        <td className="py-3 px-2 text-gray-500 text-sm">{idx + 1}</td>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={line.itemCode}
                            onChange={e => updateLine(line.id, 'itemCode', e.target.value)}
                            className="w-24 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs font-mono focus:border-nesma-secondary outline-none"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={line.itemName}
                            onChange={e => updateLine(line.id, 'itemName', e.target.value)}
                            className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none"
                            placeholder="Item description"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="0"
                            value={line.quantity}
                            onChange={e => updateLine(line.id, 'quantity', Number(e.target.value))}
                            className="w-20 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm text-center focus:border-nesma-secondary outline-none"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={line.unit}
                            onChange={e => updateLine(line.id, 'unit', e.target.value)}
                            className="w-20 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs focus:border-nesma-secondary outline-none"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={line.hsCode || ''}
                            onChange={e => updateLine(line.id, 'hsCode', e.target.value)}
                            className="w-24 px-2 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs focus:border-nesma-secondary outline-none"
                            placeholder="8544.xx"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Document Checklist */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
              Document Checklist
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {DOCUMENT_TYPES.map(type => (
                <label
                  key={type}
                  className="flex items-center gap-3 p-3 border border-white/10 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={docChecklist[type]}
                    onChange={e => setDocChecklist(prev => ({ ...prev, [type]: e.target.checked }))}
                    className="w-4 h-4 text-nesma-secondary rounded border-gray-500 bg-transparent"
                  />
                  <span className="text-sm text-gray-300">{type}</span>
                </label>
              ))}
            </div>
          </div>

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
              {submitting ? 'Saving...' : 'Create Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
