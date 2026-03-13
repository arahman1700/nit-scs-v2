import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { toast } from '@/components/Toaster';
import {
  Settings,
  Building2,
  DollarSign,
  FileText,
  Package,
  Plug,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────

interface SettingsMap {
  [key: string]: string;
}

interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

// ── Default values (mirror backend defaults) ─────────────────────────────

const DEFAULT_SETTINGS: SettingsMap = {
  // General
  companyName: 'NIT Supply Chain',
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  dateFormat: 'DD/MM/YYYY',
  language: 'en',
  // Financial
  vatRate: '15',
  paymentTermsDays: '30',
  currencyDecimalPlaces: '2',
  // Document
  overDeliveryTolerance: '10',
  backdateLimit: '7',
  autoNumberPrefix: 'NIT',
  documentRetentionDays: '365',
  requireDigitalSignature: 'false',
  // Inventory
  lowStockAlertThreshold: '20',
  reorderPointMethod: 'fixed',
  abcAnalysisFrequency: 'quarterly',
  expiryWarningDays: '30',
  // Integration
  oracleSyncInterval: '15',
  oracleSyncEnabled: 'true',
  smtpHost: 'smtp.office365.com',
  pushNotificationsEnabled: 'true',
};

// ── Option lists ─────────────────────────────────────────────────────────

const CURRENCY_OPTIONS = [
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (GMT+3)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (GMT+5:30)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1)' },
  { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
  { value: 'America/Chicago', label: 'America/Chicago (GMT-6)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (GMT-8)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
];

const DECIMAL_OPTIONS = [
  { value: '0', label: '0 decimal places' },
  { value: '2', label: '2 decimal places' },
  { value: '3', label: '3 decimal places' },
];

const REORDER_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'moving_average', label: 'Moving Average' },
  { value: 'min_max', label: 'Min-Max' },
];

const ABC_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const SYNC_INTERVAL_OPTIONS = [
  { value: '5', label: 'Every 5 minutes' },
  { value: '15', label: 'Every 15 minutes' },
  { value: '30', label: 'Every 30 minutes' },
  { value: '60', label: 'Every 1 hour' },
];

// ── Field definitions ────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'select' | 'toggle' | 'readonly';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  step?: number;
  suffix?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

interface SectionDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: 'general',
    title: 'General Settings',
    description: 'Company information, locale, and display preferences',
    icon: Building2,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    fields: [
      { key: 'companyName', label: 'Company Name', type: 'text', placeholder: 'Enter company name' },
      { key: 'currency', label: 'Default Currency', type: 'select', options: CURRENCY_OPTIONS },
      { key: 'timezone', label: 'Default Timezone', type: 'select', options: TIMEZONE_OPTIONS },
      { key: 'dateFormat', label: 'Date Format', type: 'select', options: DATE_FORMAT_OPTIONS },
      { key: 'language', label: 'Language', type: 'select', options: LANGUAGE_OPTIONS },
    ],
  },
  {
    id: 'financial',
    title: 'Financial Settings',
    description: 'Tax rates, payment terms, and currency formatting',
    icon: DollarSign,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    fields: [
      { key: 'vatRate', label: 'VAT Rate', type: 'number', step: 0.01, suffix: '%', min: 0, max: 100 },
      { key: 'paymentTermsDays', label: 'Default Payment Terms', type: 'number', suffix: 'days', min: 0 },
      { key: 'currencyDecimalPlaces', label: 'Currency Decimal Places', type: 'select', options: DECIMAL_OPTIONS },
    ],
  },
  {
    id: 'document',
    title: 'Document Settings',
    description: 'Document numbering, tolerances, and retention policies',
    icon: FileText,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15',
    fields: [
      {
        key: 'overDeliveryTolerance',
        label: 'Over-delivery Tolerance',
        type: 'number',
        suffix: '%',
        min: 0,
        max: 100,
        step: 0.1,
      },
      { key: 'backdateLimit', label: 'Backdate Limit', type: 'number', suffix: 'days', min: 0 },
      { key: 'autoNumberPrefix', label: 'Auto-number Prefix Format', type: 'text', placeholder: 'e.g. NIT' },
      { key: 'documentRetentionDays', label: 'Document Retention Period', type: 'number', suffix: 'days', min: 1 },
      { key: 'requireDigitalSignature', label: 'Require Digital Signature', type: 'toggle' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Settings',
    description: 'Stock alerts, reorder methods, and analysis schedules',
    icon: Package,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    fields: [
      {
        key: 'lowStockAlertThreshold',
        label: 'Low Stock Alert Threshold',
        type: 'number',
        suffix: '%',
        min: 0,
        max: 100,
      },
      {
        key: 'reorderPointMethod',
        label: 'Reorder Point Calculation Method',
        type: 'select',
        options: REORDER_OPTIONS,
      },
      { key: 'abcAnalysisFrequency', label: 'ABC Analysis Frequency', type: 'select', options: ABC_FREQUENCY_OPTIONS },
      { key: 'expiryWarningDays', label: 'Expiry Warning Days', type: 'number', suffix: 'days', min: 1 },
    ],
  },
  {
    id: 'integration',
    title: 'Integration Settings',
    description: 'External system sync, email, and notification configuration',
    icon: Plug,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
    fields: [
      { key: 'oracleSyncInterval', label: 'Oracle PO Sync Interval', type: 'select', options: SYNC_INTERVAL_OPTIONS },
      { key: 'oracleSyncEnabled', label: 'Oracle PO Sync Enabled', type: 'toggle' },
      { key: 'smtpHost', label: 'Email SMTP Host', type: 'readonly' },
      { key: 'pushNotificationsEnabled', label: 'Push Notifications Enabled', type: 'toggle' },
    ],
  },
];

// ── Hooks (fetch & update) ───────────────────────────────────────────────

function useAllSettings() {
  return useQuery({
    queryKey: ['settings', 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SettingsMap>>('/settings', {
        params: { pageSize: 100 },
      });
      return data.data;
    },
  });
}

function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: SettingsMap) => {
      const { data } = await apiClient.put<ApiResponse<SettingsMap>>('/settings', settings);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// ── Sub-components ───────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-nesma-primary/50
        ${checked ? 'bg-nesma-primary' : 'bg-white/20'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg
          ring-0 transition-transform duration-300
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

interface ModifiedBadgeProps {
  currentValue: string;
  defaultValue: string;
}

function ModifiedBadge({ currentValue, defaultValue }: ModifiedBadgeProps) {
  if (currentValue === defaultValue) return null;
  return <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full">Modified</span>;
}

interface FieldRendererProps {
  field: FieldDef;
  value: string;
  defaultValue: string;
  onChange: (key: string, value: string) => void;
  onReset: (key: string) => void;
}

function FieldRenderer({ field, value, defaultValue, onChange, onReset }: FieldRendererProps) {
  const isModified = value !== defaultValue;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-white/5 last:border-b-0">
      {/* Label + badge */}
      <div className="sm:w-64 shrink-0 flex items-center gap-2">
        <label className="text-sm text-gray-400">{field.label}</label>
        <ModifiedBadge currentValue={value} defaultValue={defaultValue} />
      </div>

      {/* Input */}
      <div className="flex-1 flex items-center gap-2">
        {field.type === 'text' && (
          <input
            type="text"
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white w-full focus:outline-none focus:border-nesma-secondary/50 transition-all duration-300"
            value={value}
            placeholder={field.placeholder}
            onChange={e => onChange(field.key, e.target.value)}
          />
        )}

        {field.type === 'number' && (
          <div className="flex items-center gap-2 w-full">
            <input
              type="number"
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white w-full max-w-[200px] focus:outline-none focus:border-nesma-secondary/50 transition-all duration-300"
              value={value}
              step={field.step ?? 1}
              min={field.min}
              max={field.max}
              onChange={e => onChange(field.key, e.target.value)}
            />
            {field.suffix && <span className="text-sm text-gray-400">{field.suffix}</span>}
          </div>
        )}

        {field.type === 'select' && (
          <select
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white w-full max-w-[320px] focus:outline-none focus:border-nesma-secondary/50 transition-all duration-300"
            value={value}
            onChange={e => onChange(field.key, e.target.value)}
          >
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-nesma-dark text-white">
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {field.type === 'toggle' && (
          <ToggleSwitch checked={value === 'true'} onChange={checked => onChange(field.key, String(checked))} />
        )}

        {field.type === 'readonly' && (
          <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-gray-400 w-full max-w-[320px] cursor-not-allowed">
            {value}
          </div>
        )}

        {/* Reset button */}
        {isModified && field.type !== 'readonly' && (
          <button
            type="button"
            onClick={() => onReset(field.key)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300 shrink-0"
            aria-label={`Reset ${field.label} to default`}
            title="Reset to default"
          >
            <RotateCcw size={14} className="text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

interface SectionCardProps {
  section: SectionDef;
  localSettings: SettingsMap;
  onChange: (key: string, value: string) => void;
  onReset: (key: string) => void;
  onSaveSection: (sectionId: string) => void;
  isSaving: boolean;
  savingSectionId: string | null;
  hasChanges: boolean;
}

function SectionCard({
  section,
  localSettings,
  onChange,
  onReset,
  onSaveSection,
  isSaving,
  savingSectionId,
  hasChanges,
}: SectionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = section.icon;
  const isSavingThisSection = isSaving && savingSectionId === section.id;

  return (
    <div className="glass-card rounded-2xl p-6">
      {/* Section header */}
      <button
        type="button"
        className="flex items-center justify-between w-full text-left group"
        onClick={() => setCollapsed(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${section.iconBg} flex items-center justify-center shrink-0`}>
            <Icon size={20} className={section.iconColor} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              {hasChanges && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}
            </div>
            <p className="text-sm text-gray-400">{section.description}</p>
          </div>
        </div>
        <div className="shrink-0 p-2">
          {collapsed ? (
            <ChevronRight size={20} className="text-gray-400 group-hover:text-white transition-colors" />
          ) : (
            <ChevronDown size={20} className="text-gray-400 group-hover:text-white transition-colors" />
          )}
        </div>
      </button>

      {/* Section body */}
      {!collapsed && (
        <div className="mt-4">
          <div className="space-y-0">
            {section.fields.map(field => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={localSettings[field.key] ?? DEFAULT_SETTINGS[field.key] ?? ''}
                defaultValue={DEFAULT_SETTINGS[field.key] ?? ''}
                onChange={onChange}
                onReset={onReset}
              />
            ))}
          </div>

          {/* Section save button */}
          <div className="flex justify-end mt-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => onSaveSection(section.id)}
              disabled={isSaving || !hasChanges}
              className="bg-nesma-primary hover:bg-nesma-primary/80 text-white rounded-lg px-5 py-2 text-sm font-medium flex items-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingThisSection ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSavingThisSection ? 'Saving...' : 'Save Section'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/10" />
            <div>
              <div className="h-5 w-48 bg-white/10 rounded mb-2" />
              <div className="h-3 w-72 bg-white/10 rounded" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(j => (
              <div key={j} className="flex items-center gap-4">
                <div className="h-4 w-40 bg-white/10 rounded" />
                <div className="h-10 flex-1 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function SystemSettingsPage() {
  const { data: serverSettings, isLoading, isError } = useAllSettings();
  const saveMutation = useSaveSettings();

  // Local draft state for editing
  const [localSettings, setLocalSettings] = useState<SettingsMap>({});
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);

  // Seed local state when server data loads
  useEffect(() => {
    if (serverSettings) {
      setLocalSettings(prev => {
        // Merge defaults, server settings, and any unsaved local changes
        const merged = { ...DEFAULT_SETTINGS, ...serverSettings };
        // Preserve any keys the user has edited locally that differ from server
        // On initial load, prev will be empty, so this effectively just uses server values
        if (Object.keys(prev).length === 0) {
          return merged;
        }
        return prev;
      });
    }
  }, [serverSettings]);

  // Computed: which sections have changes vs. server state
  const sectionChanges = useMemo(() => {
    const merged = { ...DEFAULT_SETTINGS, ...serverSettings };
    const result: Record<string, boolean> = {};
    for (const section of SECTIONS) {
      result[section.id] = section.fields.some(f => (localSettings[f.key] ?? '') !== (merged[f.key] ?? ''));
    }
    return result;
  }, [localSettings, serverSettings]);

  const totalChanges = useMemo(() => Object.values(sectionChanges).filter(Boolean).length, [sectionChanges]);

  const handleChange = useCallback((key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(
    (key: string) => {
      const serverValue = serverSettings?.[key] ?? DEFAULT_SETTINGS[key] ?? '';
      setLocalSettings(prev => ({ ...prev, [key]: serverValue }));
    },
    [serverSettings],
  );

  const handleSaveSection = useCallback(
    async (sectionId: string) => {
      const section = SECTIONS.find(s => s.id === sectionId);
      if (!section) return;

      const payload: SettingsMap = {};
      const merged = { ...DEFAULT_SETTINGS, ...serverSettings };
      for (const field of section.fields) {
        if (field.type === 'readonly') continue;
        const localVal = localSettings[field.key] ?? '';
        const serverVal = merged[field.key] ?? '';
        if (localVal !== serverVal) {
          payload[field.key] = localVal;
        }
      }

      if (Object.keys(payload).length === 0) {
        toast.info('No changes', 'No settings were modified in this section.');
        return;
      }

      setSavingSectionId(sectionId);
      try {
        await saveMutation.mutateAsync(payload);
        toast.success('Settings saved', `${section.title} updated successfully.`);
      } catch {
        toast.error('Save failed', 'Could not save settings. Please try again.');
      } finally {
        setSavingSectionId(null);
      }
    },
    [localSettings, serverSettings, saveMutation],
  );

  const handleSaveAll = useCallback(async () => {
    const merged = { ...DEFAULT_SETTINGS, ...serverSettings };
    const payload: SettingsMap = {};
    for (const section of SECTIONS) {
      for (const field of section.fields) {
        if (field.type === 'readonly') continue;
        const localVal = localSettings[field.key] ?? '';
        const serverVal = merged[field.key] ?? '';
        if (localVal !== serverVal) {
          payload[field.key] = localVal;
        }
      }
    }

    if (Object.keys(payload).length === 0) {
      toast.info('No changes', 'No settings have been modified.');
      return;
    }

    setSavingSectionId('all');
    try {
      await saveMutation.mutateAsync(payload);
      toast.success('All settings saved', `${Object.keys(payload).length} setting(s) updated successfully.`);
    } catch {
      toast.error('Save failed', 'Could not save settings. Please try again.');
    } finally {
      setSavingSectionId(null);
    }
  }, [localSettings, serverSettings, saveMutation]);

  const handleResetAll = useCallback(() => {
    const merged = { ...DEFAULT_SETTINGS, ...serverSettings };
    setLocalSettings(merged);
    toast.info('Changes discarded', 'All settings reset to their last saved values.');
  }, [serverSettings]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Settings size={22} className="text-nesma-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Configuration</h1>
            <p className="text-sm text-gray-400">Loading settings...</p>
          </div>
        </div>
        <SettingsSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Settings size={22} className="text-nesma-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Configuration</h1>
            <p className="text-sm text-gray-400">Manage global system settings and preferences</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-12 text-center">
          <Settings size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-400 mb-2">Failed to load system settings.</p>
          <button onClick={() => window.location.reload()} className="text-nesma-secondary text-sm hover:underline">
            Reload page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Settings size={22} className="text-nesma-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Configuration</h1>
            <p className="text-sm text-gray-400">Manage global system settings and preferences</p>
          </div>
        </div>

        {/* Global action buttons */}
        <div className="flex items-center gap-3">
          {totalChanges > 0 && (
            <span className="text-xs text-amber-400">{totalChanges} section(s) with unsaved changes</span>
          )}
          <button
            type="button"
            onClick={handleResetAll}
            disabled={totalChanges === 0}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard All
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saveMutation.isPending || totalChanges === 0}
            className="bg-nesma-primary hover:bg-nesma-primary/80 text-white rounded-lg px-5 py-2 text-sm font-medium flex items-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingSectionId === 'all' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {savingSectionId === 'all' ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map(section => (
        <SectionCard
          key={section.id}
          section={section}
          localSettings={localSettings}
          onChange={handleChange}
          onReset={handleReset}
          onSaveSection={handleSaveSection}
          isSaving={saveMutation.isPending}
          savingSectionId={savingSectionId}
          hasChanges={sectionChanges[section.id] ?? false}
        />
      ))}

      {/* Footer */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-xs text-gray-400 text-center">
          Changes to system settings may require a page refresh to take effect across all users. Critical changes are
          logged in the audit trail.
        </p>
      </div>
    </div>
  );
}
