import React, { useState, useMemo } from 'react';
import {
  useTariffRateList,
  useCreateTariffRate,
  useUpdateTariffRate,
  useCalculateDuties,
  useApplyDuties,
} from '@/domains/logistics/hooks/useTariffs';
import type { TariffRate, LineBreakdown, DutyCalculationResult } from '@/domains/logistics/hooks/useTariffs';
import { toast } from '@/components/Toaster';
import { toRecord } from '@/utils/type-helpers';
import {
  Calculator,
  Plus,
  Pencil,
  X,
  Loader2,
  Search,
  FileText,
  CheckCircle,
  ReceiptText,
  DollarSign,
  Percent,
  Globe,
  Hash,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = 'rates' | 'calculator';

interface TariffFormData {
  hsCode: string;
  description: string;
  dutyRate: number;
  vatRate: number;
  country: string;
  effectiveFrom: string;
  effectiveUntil: string;
  exemptionCode: string;
  exemptionDescription: string;
}

const emptyForm: TariffFormData = {
  hsCode: '',
  description: '',
  dutyRate: 0,
  vatRate: 15,
  country: '',
  effectiveFrom: '',
  effectiveUntil: '',
  exemptionCode: '',
  exemptionDescription: '',
};

// ── Component ────────────────────────────────────────────────────────────────

export const TariffPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('rates');
  const [searchQuery, setSearchQuery] = useState('');

  // Tariff rates CRUD
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<TariffRate | null>(null);
  const [formData, setFormData] = useState<TariffFormData>(emptyForm);

  // Duty calculator
  const [shipmentId, setShipmentId] = useState('');
  const [calculationResult, setCalculationResult] = useState<DutyCalculationResult | null>(null);

  // Queries & Mutations
  const { data: ratesRes, isLoading: ratesLoading } = useTariffRateList({ search: searchQuery || undefined });
  const rates: TariffRate[] = (toRecord(ratesRes).data ?? []) as TariffRate[];

  const createMutation = useCreateTariffRate();
  const updateMutation = useUpdateTariffRate();
  const applyMutation = useApplyDuties();

  // useCalculateDuties is a query with enabled: false — call refetch() manually
  const calcQuery = useCalculateDuties(shipmentId || undefined);

  // Filtered rates
  const filteredRates = useMemo(() => {
    if (!searchQuery) return rates;
    const q = searchQuery.toLowerCase();
    return rates.filter(
      r =>
        r.hsCode.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q),
    );
  }, [rates, searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingRate(null);
    setFormData(emptyForm);
    setShowModal(true);
  }

  function openEditModal(rate: TariffRate) {
    setEditingRate(rate);
    setFormData({
      hsCode: rate.hsCode,
      description: rate.description,
      dutyRate: rate.dutyRate,
      vatRate: rate.vatRate,
      country: rate.country,
      effectiveFrom: rate.effectiveFrom?.slice(0, 10) ?? '',
      effectiveUntil: rate.effectiveUntil?.slice(0, 10) ?? '',
      exemptionCode: rate.exemptionCode ?? '',
      exemptionDescription: rate.exemptionDescription ?? '',
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingRate(null);
    setFormData(emptyForm);
  }

  function handleSave() {
    const payload: Record<string, unknown> = {
      hsCode: formData.hsCode,
      description: formData.description,
      dutyRate: Number(formData.dutyRate),
      vatRate: Number(formData.vatRate),
      country: formData.country,
      effectiveFrom: formData.effectiveFrom || undefined,
      effectiveUntil: formData.effectiveUntil || undefined,
      exemptionCode: formData.exemptionCode || undefined,
      exemptionDescription: formData.exemptionDescription || undefined,
    };

    if (editingRate) {
      updateMutation.mutate(
        { id: editingRate.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Tariff rate updated');
            closeModal();
          },
          onError: () => toast.error('Failed to update tariff rate'),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Tariff rate created');
          closeModal();
        },
        onError: () => toast.error('Failed to create tariff rate'),
      });
    }
  }

  function handleCalculate() {
    if (!shipmentId.trim()) return;
    setCalculationResult(null);
    calcQuery.refetch().then(res => {
      const result = (toRecord(res.data).data as DutyCalculationResult | undefined) ?? null;
      if (result) {
        setCalculationResult(result);
      } else if (res.isError) {
        toast.error('Calculation failed', 'Could not calculate duties for this shipment');
      }
    });
  }

  function handleApply() {
    if (!shipmentId.trim()) return;
    applyMutation.mutate(shipmentId, {
      onSuccess: () => {
        toast.success('Duties applied', 'Duties have been saved to the shipment');
      },
      onError: () => toast.error('Failed to apply duties'),
    });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const tabs: { id: TabId; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'rates', label: 'Tariff Rates', icon: ReceiptText },
    { id: 'calculator', label: 'Duty Calculator', icon: Calculator },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Tariff & Duties</h1>
            <p className="text-sm text-gray-400">Manage tariff rates and calculate import duties</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass-card rounded-xl w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'rates' && (
        <RatesTab
          rates={filteredRates}
          isLoading={ratesLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateClick={openCreateModal}
          onEditClick={openEditModal}
        />
      )}

      {activeTab === 'calculator' && (
        <CalculatorTab
          shipmentId={shipmentId}
          onShipmentIdChange={setShipmentId}
          result={calculationResult}
          isCalculating={calcQuery.isFetching}
          isApplying={applyMutation.isPending}
          onCalculate={handleCalculate}
          onApply={handleApply}
        />
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <TariffModal
          isEditing={!!editingRate}
          formData={formData}
          onFormChange={setFormData}
          onSave={handleSave}
          onClose={closeModal}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

// ── Rates Tab ────────────────────────────────────────────────────────────────

const RatesTab: React.FC<{
  rates: TariffRate[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCreateClick: () => void;
  onEditClick: (rate: TariffRate) => void;
}> = ({ rates, isLoading, searchQuery, onSearchChange, onCreateClick, onEditClick }) => (
  <div className="space-y-4">
    {/* Toolbar */}
    <div className="flex flex-col sm:flex-row gap-3 justify-between">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search HS code, description, country..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="input-field w-full pl-10"
        />
      </div>
      <button
        onClick={onCreateClick}
        className="flex items-center gap-2 px-4 py-2.5 bg-nesma-primary text-white rounded-lg hover:bg-nesma-primary/80 transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20"
      >
        <Plus size={16} />
        Add Tariff Rate
      </button>
    </div>

    {/* Table */}
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
              <th className="py-3 px-4 font-medium">HS Code</th>
              <th className="py-3 px-4 font-medium">Description</th>
              <th className="py-3 px-4 font-medium text-right">Duty %</th>
              <th className="py-3 px-4 font-medium text-right">VAT %</th>
              <th className="py-3 px-4 font-medium">Country</th>
              <th className="py-3 px-4 font-medium">Effective From</th>
              <th className="py-3 px-4 font-medium">Effective Until</th>
              <th className="py-3 px-4 font-medium text-center">Status</th>
              <th className="py-3 px-4 font-medium w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                </td>
              </tr>
            ) : rates.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm text-gray-400">No tariff rates found</p>
                </td>
              </tr>
            ) : (
              rates.map(rate => (
                <tr key={rate.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">
                    <span className="text-sm text-nesma-secondary font-mono font-medium">{rate.hsCode}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-200 max-w-xs truncate block">{rate.description}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-white font-medium">{rate.dutyRate}%</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-white font-medium">{rate.vatRate}%</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-300">{rate.country}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-400">{rate.effectiveFrom?.slice(0, 10) ?? '-'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-400">{rate.effectiveUntil?.slice(0, 10) ?? '-'}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        rate.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}
                    >
                      {rate.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onEditClick(rate)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                      aria-label={`Edit tariff rate ${rate.hsCode}`}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ── Calculator Tab ───────────────────────────────────────────────────────────

const CalculatorTab: React.FC<{
  shipmentId: string;
  onShipmentIdChange: (v: string) => void;
  result: DutyCalculationResult | null;
  isCalculating: boolean;
  isApplying: boolean;
  onCalculate: () => void;
  onApply: () => void;
}> = ({ shipmentId, onShipmentIdChange, result, isCalculating, isApplying, onCalculate, onApply }) => (
  <div className="space-y-6">
    {/* Input Section */}
    <div className="glass-card rounded-2xl p-6 border border-white/10">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Calculator size={16} className="text-nesma-secondary" />
        Calculate Import Duties
      </h3>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex-1 w-full sm:max-w-md">
          <label htmlFor="shipment-id-field" className="block text-xs text-gray-400 mb-1.5">
            Shipment ID
          </label>
          <input
            id="shipment-id-field"
            type="text"
            value={shipmentId}
            onChange={e => onShipmentIdChange(e.target.value)}
            placeholder="Enter shipment ID..."
            className="input-field w-full"
          />
        </div>
        <button
          onClick={onCalculate}
          disabled={!shipmentId.trim() || isCalculating}
          className="flex items-center gap-2 px-5 py-2.5 bg-nesma-primary text-white rounded-lg hover:bg-nesma-primary/80 transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCalculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
          Calculate
        </button>
      </div>
    </div>

    {/* Results */}
    {result && (
      <>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                <FileText size={18} />
              </div>
              <span className="text-xs text-gray-400">Shipment</span>
            </div>
            <p className="text-lg font-bold text-white truncate">{result.shipmentNumber}</p>
          </div>
          <div className="glass-card rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <ReceiptText size={18} />
              </div>
              <span className="text-xs text-gray-400">Total Duties</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {result.totalDuties.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                <Percent size={18} />
              </div>
              <span className="text-xs text-gray-400">Total VAT</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {result.totalVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <DollarSign size={18} />
              </div>
              <span className="text-xs text-gray-400">Grand Total</span>
            </div>
            <p className="text-2xl font-bold text-nesma-accent">
              {result.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Line Breakdown Table */}
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-3">
              <span className="w-1 h-5 bg-nesma-secondary rounded-full" />
              Line-by-Line Breakdown
              <span className="text-xs text-gray-400 font-normal ml-1">
                ({result.lineBreakdown.length} line{result.lineBreakdown.length !== 1 ? 's' : ''})
              </span>
            </h3>
            <button
              onClick={onApply}
              disabled={isApplying}
              className="flex items-center gap-2 px-4 py-2 bg-nesma-accent text-white rounded-lg hover:bg-nesma-accent/80 transition-all text-sm font-medium shadow-lg shadow-nesma-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Apply to Shipment
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">HS Code</th>
                  <th className="py-3 px-4 font-medium text-right">Line Value</th>
                  <th className="py-3 px-4 font-medium text-right">Duty Rate</th>
                  <th className="py-3 px-4 font-medium text-right">Duty Amount</th>
                  <th className="py-3 px-4 font-medium text-right">VAT Rate</th>
                  <th className="py-3 px-4 font-medium text-right">VAT Amount</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {result.lineBreakdown.map((line: LineBreakdown, idx: number) => (
                  <tr key={line.shipmentLineId ?? idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-200">{line.description}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-nesma-secondary font-mono">{line.hsCode ?? '-'}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-gray-300 font-mono">
                        {line.lineValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-gray-400">{line.dutyRate}%</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-white font-mono">
                        {line.dutyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-gray-400">{line.vatRate}%</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-white font-mono">
                        {line.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-nesma-accent font-mono font-medium">
                        {line.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-white/5">
                  <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-white">
                    Totals
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-white font-mono font-bold">
                      {result.totalDuties.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-3 px-4" />
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-white font-mono font-bold">
                      {result.totalVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-nesma-accent font-mono font-bold">
                      {result.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </>
    )}
  </div>
);

// ── Tariff Rate Modal ────────────────────────────────────────────────────────

const TariffModal: React.FC<{
  isEditing: boolean;
  formData: TariffFormData;
  onFormChange: (data: TariffFormData) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
}> = ({ isEditing, formData, onFormChange, onSave, onClose, isSaving }) => {
  function update(field: keyof TariffFormData, value: string | number) {
    onFormChange({ ...formData, [field]: value });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass-card rounded-2xl border border-white/10 w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{isEditing ? 'Edit Tariff Rate' : 'New Tariff Rate'}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* HS Code + Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="hs-code-field" className="block text-xs text-gray-400 mb-1.5">
                <Hash size={12} className="inline mr-1" />
                HS Code
              </label>
              <input
                id="hs-code-field"
                type="text"
                value={formData.hsCode}
                onChange={e => update('hsCode', e.target.value)}
                placeholder="e.g. 8471.30"
                className="input-field w-full"
              />
            </div>
            <div>
              <label htmlFor="country-field" className="block text-xs text-gray-400 mb-1.5">
                <Globe size={12} className="inline mr-1" />
                Country
              </label>
              <input
                id="country-field"
                type="text"
                value={formData.country}
                onChange={e => update('country', e.target.value)}
                placeholder="e.g. SA, US, CN"
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="tariff-description-field" className="block text-xs text-gray-400 mb-1.5">
              Description
            </label>
            <input
              id="tariff-description-field"
              type="text"
              value={formData.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Tariff description"
              className="input-field w-full"
            />
          </div>

          {/* Duty Rate + VAT Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="duty-rate-field" className="block text-xs text-gray-400 mb-1.5">
                Duty Rate (%)
              </label>
              <input
                id="duty-rate-field"
                type="number"
                step="0.01"
                min="0"
                value={formData.dutyRate}
                onChange={e => update('dutyRate', Number(e.target.value))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label htmlFor="vat-rate-field" className="block text-xs text-gray-400 mb-1.5">
                VAT Rate (%)
              </label>
              <input
                id="vat-rate-field"
                type="number"
                step="0.01"
                min="0"
                value={formData.vatRate}
                onChange={e => update('vatRate', Number(e.target.value))}
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Effective Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="effective-from-field" className="block text-xs text-gray-400 mb-1.5">
                Effective From
              </label>
              <input
                id="effective-from-field"
                type="date"
                value={formData.effectiveFrom}
                onChange={e => update('effectiveFrom', e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label htmlFor="effective-until-field" className="block text-xs text-gray-400 mb-1.5">
                Effective Until
              </label>
              <input
                id="effective-until-field"
                type="date"
                value={formData.effectiveUntil}
                onChange={e => update('effectiveUntil', e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Exemption */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="exemption-code-field" className="block text-xs text-gray-400 mb-1.5">
                Exemption Code
              </label>
              <input
                id="exemption-code-field"
                type="text"
                value={formData.exemptionCode}
                onChange={e => update('exemptionCode', e.target.value)}
                placeholder="Optional"
                className="input-field w-full"
              />
            </div>
            <div>
              <label htmlFor="exemption-description-field" className="block text-xs text-gray-400 mb-1.5">
                Exemption Description
              </label>
              <input
                id="exemption-description-field"
                type="text"
                value={formData.exemptionDescription}
                onChange={e => update('exemptionDescription', e.target.value)}
                placeholder="Optional"
                className="input-field w-full"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !formData.hsCode || !formData.description}
            className="flex items-center gap-2 px-5 py-2 bg-nesma-primary text-white rounded-lg hover:bg-nesma-primary/80 transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
