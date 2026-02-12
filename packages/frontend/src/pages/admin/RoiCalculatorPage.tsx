import React, { useState, useCallback } from 'react';
import { Calculator, DollarSign, Clock, Target, TrendingDown, Loader2, BarChart3, ArrowRight } from 'lucide-react';
import { useCalculateRoi, type RoiInput, type RoiResult } from '@/api/hooks/useRoiCalculator';

// ── Default values ─────────────────────────────────────────────────────

const DEFAULTS: RoiInput = {
  monthlyOrders: 5000,
  warehouseWorkers: 20,
  avgPickTimeMinutes: 3.5,
  currentAccuracyPercent: 95,
  avgShippingCostPerOrder: 12,
  avgInventoryValue: 500_000,
  currentShrinkagePercent: 2,
};

// ── Slider config ──────────────────────────────────────────────────────

interface SliderDef {
  key: keyof RoiInput;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: SliderDef[] = [
  { key: 'monthlyOrders', label: 'Monthly Orders', min: 100, max: 50000, step: 100, unit: '' },
  { key: 'warehouseWorkers', label: 'Warehouse Workers', min: 1, max: 200, step: 1, unit: '' },
  { key: 'avgPickTimeMinutes', label: 'Avg Pick Time', min: 0.5, max: 15, step: 0.5, unit: 'min' },
  { key: 'currentAccuracyPercent', label: 'Current Accuracy', min: 80, max: 99, step: 0.5, unit: '%' },
  { key: 'avgShippingCostPerOrder', label: 'Avg Shipping Cost', min: 1, max: 100, step: 1, unit: '$' },
  { key: 'avgInventoryValue', label: 'Avg Inventory Value', min: 10000, max: 5000000, step: 10000, unit: '$' },
  { key: 'currentShrinkagePercent', label: 'Current Shrinkage', min: 0.1, max: 10, step: 0.1, unit: '%' },
];

// ── Helpers ────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number, unit: string): string {
  if (unit === '$') {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  }
  return `${value}${unit ? ` ${unit}` : ''}`;
}

// ── Component ──────────────────────────────────────────────────────────

export const RoiCalculatorPage: React.FC = () => {
  const [inputs, setInputs] = useState<RoiInput>(DEFAULTS);
  const [result, setResult] = useState<RoiResult | null>(null);

  const mutation = useCalculateRoi();

  const handleChange = useCallback((key: keyof RoiInput, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleCalculate = useCallback(() => {
    mutation.mutate(inputs, {
      onSuccess: res => {
        const data = (res as unknown as { data?: RoiResult })?.data;
        if (data) setResult(data);
      },
    });
  }, [inputs, mutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">ROI Calculator</h1>
            <p className="text-sm text-gray-400">Estimate your savings with NIT Supply Chain V2</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel — Inputs */}
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-sm font-semibold text-white mb-5">Your Operational Data</h2>

          <div className="space-y-5">
            {SLIDERS.map(s => (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400">{s.label}</label>
                  <span className="text-sm font-medium text-white">{formatNumber(inputs[s.key], s.unit)}</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={inputs[s.key]}
                  onChange={e => handleChange(s.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-nesma-primary
                    [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-nesma-primary/30
                    [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>{formatNumber(s.min, s.unit)}</span>
                  <span>{formatNumber(s.max, s.unit)}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleCalculate}
            disabled={mutation.isPending}
            className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-nesma-primary text-white rounded-xl hover:bg-nesma-primary/80 transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Calculate ROI
          </button>
        </div>

        {/* Right Panel — Results */}
        <div className="space-y-4">
          {!result ? (
            <div className="glass-card rounded-2xl p-12 border border-white/10 text-center h-full flex flex-col items-center justify-center">
              <ArrowRight className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Adjust the sliders and click Calculate to see your estimated ROI.</p>
            </div>
          ) : (
            <>
              {/* Primary KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Annual Savings</span>
                  </div>
                  <div className="text-3xl font-bold text-emerald-400">{formatCurrency(result.annualSavings)}</div>
                </div>
                <div className="glass-card rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">ROI Payback</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-400">
                    {result.roiMonths}
                    <span className="text-lg font-normal text-gray-500"> mo</span>
                  </div>
                </div>
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-nesma-secondary" />
                    <span className="text-xs text-gray-500">Monthly Savings</span>
                  </div>
                  <div className="text-xl font-bold text-white">{formatCurrency(result.totalMonthlySavings)}</div>
                </div>
                <div className="glass-card rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs text-gray-500">Time Saved/Mo</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    {result.timeSavingsHoursMonthly.toFixed(0)}
                    <span className="text-sm font-normal text-gray-500"> hrs</span>
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-gray-500">Accuracy Boost</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    +{result.accuracyImprovement}
                    <span className="text-sm font-normal text-gray-500"> pp</span>
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-gray-500">Shrinkage Saved</span>
                  </div>
                  <div className="text-xl font-bold text-white">{formatCurrency(result.shrinkageReduction)}/mo</div>
                </div>
              </div>

              {/* Savings Breakdown */}
              <div className="glass-card rounded-2xl p-5 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-nesma-primary" />
                  <h3 className="text-sm font-semibold text-white">Savings Breakdown</h3>
                </div>

                <div className="space-y-3">
                  <BreakdownBar
                    label="Labor Savings"
                    value={result.laborSavingsMonthly}
                    percent={result.breakdown.laborPercent}
                    color="bg-emerald-500"
                  />
                  <BreakdownBar
                    label="Shipping Reduction"
                    value={result.shippingCostReduction}
                    percent={result.breakdown.shippingPercent}
                    color="bg-blue-500"
                  />
                  <BreakdownBar
                    label="Shrinkage Reduction"
                    value={result.shrinkageReduction}
                    percent={result.breakdown.shrinkagePercent}
                    color="bg-amber-500"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Sub-component ──────────────────────────────────────────────────────

function BreakdownBar({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: number;
  percent: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-medium text-white">
          {formatCurrency(value)}/mo ({percent}%)
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
