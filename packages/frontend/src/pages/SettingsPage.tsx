import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Shield, Clock, DollarSign, Hash, Globe, Loader2 } from 'lucide-react';
import { MI_APPROVAL_LEVELS, JO_APPROVAL_LEVELS } from '@nit-scs-v2/shared/constants';
import { previewNextNumber } from '@/utils/autoNumber';
import { useSettings, useUpdateSettings } from '@/api/hooks/useSettings';
import { toast } from '@/components/Toaster';

const DEFAULT_SETTINGS = {
  vatRate: 15,
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  dateFormat: 'DD/MM/YYYY',
  overDeliveryTolerance: 10,
  backdateLimit: 7,
};

export const SettingsPage: React.FC = () => {
  const { data: savedSettings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, [savedSettings]);

  const docTypes = [
    'mrrv',
    'mirv',
    'mrv',
    'rfim',
    'osd',
    'jo',
    'gatepass',
    'stock-transfer',
    'mrf',
    'shipment',
    'customs',
  ];

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-nesma-secondary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-3xl font-bold text-white glow-text">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">System configuration and parameters</p>
      </div>

      {/* General Settings */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-5 border-b border-white/10 bg-white/5 flex items-center gap-3">
          <Globe size={18} className="text-nesma-secondary" />
          <h3 className="text-sm font-bold text-white">General</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">VAT Rate (%)</label>
            <input
              type="number"
              value={settings.vatRate}
              onChange={e => setSettings(s => ({ ...s, vatRate: Number(e.target.value) }))}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Currency</label>
            <input
              type="text"
              value={settings.currency}
              readOnly
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 outline-none cursor-not-allowed"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Timezone</label>
            <input
              type="text"
              value={settings.timezone}
              readOnly
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 outline-none cursor-not-allowed"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Date Format</label>
            <select
              value={settings.dateFormat}
              onChange={e => setSettings(s => ({ ...s, dateFormat: e.target.value }))}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Over-Delivery Tolerance (%)</label>
            <input
              type="number"
              value={settings.overDeliveryTolerance}
              onChange={e => setSettings(s => ({ ...s, overDeliveryTolerance: Number(e.target.value) }))}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Backdate Limit (days)</label>
            <input
              type="number"
              value={settings.backdateLimit}
              onChange={e => setSettings(s => ({ ...s, backdateLimit: Number(e.target.value) }))}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-nesma-secondary outline-none"
            />
          </div>
        </div>
      </div>

      {/* Approval Thresholds */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-5 border-b border-white/10 bg-white/5 flex items-center gap-3">
          <Shield size={18} className="text-nesma-secondary" />
          <h3 className="text-sm font-bold text-white">Approval Thresholds</h3>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-bold text-gray-300 mb-3">MI / MR Approval (5 Levels)</h4>
            <div className="space-y-2">
              {MI_APPROVAL_LEVELS.map(level => (
                <div
                  key={level.level}
                  className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-nesma-primary/20 flex items-center justify-center text-xs font-bold text-nesma-secondary border border-nesma-primary/30">
                      L{level.level}
                    </span>
                    <span className="text-sm text-gray-300">{level.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      {level.minAmount.toLocaleString()} -{' '}
                      {level.maxAmount === Infinity ? '500K+' : level.maxAmount.toLocaleString()} SAR
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {level.slaHours}h SLA
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-300 mb-3">Job Order Approval (4 Levels)</h4>
            <div className="space-y-2">
              {JO_APPROVAL_LEVELS.map(level => (
                <div
                  key={level.level}
                  className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-nesma-primary/20 flex items-center justify-center text-xs font-bold text-nesma-secondary border border-nesma-primary/30">
                      L{level.level}
                    </span>
                    <span className="text-sm text-gray-300">{level.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      {level.minAmount.toLocaleString()} -{' '}
                      {level.maxAmount === Infinity ? '100K+' : level.maxAmount.toLocaleString()} SAR
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {level.slaHours}h SLA
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Numbering Preview */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-5 border-b border-white/10 bg-white/5 flex items-center gap-3">
          <Hash size={18} className="text-nesma-secondary" />
          <h3 className="text-sm font-bold text-white">Auto-Numbering Preview</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {docTypes.map(type => (
              <div key={type} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{type.toUpperCase()}</p>
                <p className="text-sm font-mono text-nesma-secondary mt-1">{previewNextNumber(type)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          disabled={updateSettings.isPending}
          onClick={() => {
            updateSettings.mutate(settings, {
              onSuccess: () => toast.success('Settings saved', 'Configuration updated successfully'),
              onError: err => toast.error('Save failed', err instanceof Error ? err.message : 'Unknown error'),
            });
          }}
          className="px-8 py-3 bg-nesma-primary hover:bg-nesma-accent text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
        >
          {updateSettings.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};
