import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useDynamicType,
  useCreateDynamicType,
  useUpdateDynamicType,
  useAddField,
  useUpdateField,
  useDeleteField,
  useReorderFields,
} from '@/api/hooks/useDynamicDocumentTypes';
import type { DynamicDocumentType, FieldDefinition, StatusFlowConfig } from '@/api/hooks/useDynamicDocumentTypes';
import { ArrowLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, Eye, ChevronRight, Check, X } from 'lucide-react';

const COL_SPAN_MAP: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
};

// ── Sub-Components ──────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all';

// ── Task 2: Options Editor ──────────────────────────────────────────────

interface FieldOptionsEditorProps {
  options: Array<{ value: string; label: string }>;
  onSave: (options: Array<{ value: string; label: string }>) => void;
}

const FieldOptionsEditor: React.FC<FieldOptionsEditorProps> = ({ options: initialOptions, onSave }) => {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState(initialOptions);

  React.useEffect(() => {
    setOpts(initialOptions);
  }, [initialOptions]);

  const handleMove = (idx: number, dir: -1 | 1) => {
    const next = [...opts];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOpts(next);
    onSave(next);
  };

  const handleUpdate = (idx: number, key: 'value' | 'label', val: string) => {
    const next = [...opts];
    next[idx] = { ...next[idx], [key]: val };
    setOpts(next);
  };

  const handleBlur = () => onSave(opts);

  const handleRemove = (idx: number) => {
    const next = opts.filter((_, i) => i !== idx);
    setOpts(next);
    onSave(next);
  };

  const handleAdd = () => {
    const next = [...opts, { value: `opt_${Date.now()}`, label: 'New Option' }];
    setOpts(next);
    onSave(next);
  };

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-nesma-secondary hover:underline"
      >
        <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Options ({opts.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {opts.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={opt.value}
                onChange={e => handleUpdate(idx, 'value', e.target.value)}
                onBlur={handleBlur}
                className={`${INPUT_CLS} w-32`}
                placeholder="value"
              />
              <input
                value={opt.label}
                onChange={e => handleUpdate(idx, 'label', e.target.value)}
                onBlur={handleBlur}
                className={`${INPUT_CLS} flex-1`}
                placeholder="label"
              />
              <button
                onClick={() => handleMove(idx, -1)}
                disabled={idx === 0}
                className="p-1 rounded hover:bg-white/10 text-gray-500 disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => handleMove(idx, 1)}
                disabled={idx === opts.length - 1}
                className="p-1 rounded hover:bg-white/10 text-gray-500 disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={() => handleRemove(idx)}
                className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={handleAdd} className="flex items-center gap-1 text-xs text-nesma-secondary hover:underline">
            <Plus size={14} /> Add Option
          </button>
        </div>
      )}
    </div>
  );
};

// ── Task 3: Validation Rules Panel ──────────────────────────────────────

interface ValidationRulesPanelProps {
  fieldType: string;
  rules: Record<string, unknown>;
  onSave: (rules: Record<string, unknown>) => void;
}

const ValidationRulesPanel: React.FC<ValidationRulesPanelProps> = ({ fieldType, rules: initialRules, onSave }) => {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<Record<string, unknown>>(initialRules);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<boolean | null>(null);

  React.useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  const updateRule = (key: string, value: unknown) => {
    setRules(r => ({ ...r, [key]: value }));
  };

  const handleBlur = () => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rules)) {
      if (v !== '' && v !== undefined && v !== null) cleaned[k] = v;
    }
    onSave(cleaned);
  };

  const handleTestPattern = () => {
    const pattern = rules.pattern as string;
    if (!pattern) {
      setTestResult(null);
      return;
    }
    try {
      setTestResult(new RegExp(pattern).test(testInput));
    } catch {
      setTestResult(false);
    }
  };

  const showNumber = ['number', 'currency'].includes(fieldType);
  const showText = ['text', 'email', 'phone', 'url', 'textarea'].includes(fieldType);
  const showDate = ['date', 'datetime'].includes(fieldType);
  const showPattern = ['text', 'email', 'phone', 'url'].includes(fieldType);

  if (!showNumber && !showText && !showDate) return null;

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-nesma-secondary hover:underline"
      >
        <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Validation Rules
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          {showNumber && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min</label>
                <input
                  type="number"
                  value={(rules.min as number) ?? ''}
                  onChange={e => updateRule('min', e.target.value ? Number(e.target.value) : '')}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max</label>
                <input
                  type="number"
                  value={(rules.max as number) ?? ''}
                  onChange={e => updateRule('max', e.target.value ? Number(e.target.value) : '')}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
            </>
          )}
          {showText && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min Length</label>
                <input
                  type="number"
                  value={(rules.minLength as number) ?? ''}
                  onChange={e => updateRule('minLength', e.target.value ? Number(e.target.value) : '')}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Length</label>
                <input
                  type="number"
                  value={(rules.maxLength as number) ?? ''}
                  onChange={e => updateRule('maxLength', e.target.value ? Number(e.target.value) : '')}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
            </>
          )}
          {showDate && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min Date</label>
                <input
                  type={fieldType === 'datetime' ? 'datetime-local' : 'date'}
                  value={(rules.min as string) ?? ''}
                  onChange={e => updateRule('min', e.target.value)}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Date</label>
                <input
                  type={fieldType === 'datetime' ? 'datetime-local' : 'date'}
                  value={(rules.max as string) ?? ''}
                  onChange={e => updateRule('max', e.target.value)}
                  onBlur={handleBlur}
                  className={INPUT_CLS}
                />
              </div>
            </>
          )}
          {showPattern && (
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Pattern (regex)</label>
              <div className="flex gap-2">
                <input
                  value={(rules.pattern as string) ?? ''}
                  onChange={e => updateRule('pattern', e.target.value)}
                  onBlur={handleBlur}
                  className={`${INPUT_CLS} flex-1`}
                  placeholder="^[A-Z]{2}-\\d{4}$"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  className={`${INPUT_CLS} flex-1`}
                  placeholder="Test value..."
                />
                <button
                  onClick={handleTestPattern}
                  className="px-3 py-2 rounded-lg bg-white/10 text-xs text-gray-300 hover:bg-white/15 transition-colors"
                >
                  Test
                </button>
                {testResult !== null &&
                  (testResult ? (
                    <Check size={16} className="text-emerald-400" />
                  ) : (
                    <X size={16} className="text-red-400" />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Task 4: Field Configuration Panel ───────────────────────────────────

interface FieldConfigPanelProps {
  field: FieldDefinition;
  siblingFields: FieldDefinition[];
  existingSections: string[];
  onSave: (updates: Partial<FieldDefinition>) => void;
}

const FieldConfigPanel: React.FC<FieldConfigPanelProps> = ({ field, siblingFields, existingSections, onSave }) => {
  const [open, setOpen] = useState(false);

  const cond = (field.conditionalDisplay ?? {}) as {
    dependsOn?: string;
    operator?: string;
    value?: string;
  };

  const handleCondChange = (key: string, value: string) => {
    const next = { ...cond, [key]: value };
    onSave({ conditionalDisplay: next });
  };

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-nesma-secondary hover:underline"
      >
        <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Configuration
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {/* Conditional Display */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Conditional Display</label>
            <div className="flex gap-2">
              <select
                value={cond.dependsOn ?? ''}
                onChange={e => handleCondChange('dependsOn', e.target.value)}
                className={`${INPUT_CLS} flex-1 appearance-none`}
              >
                <option value="">No condition</option>
                {siblingFields
                  .filter(f => f.id !== field.id)
                  .map(f => (
                    <option key={f.id} value={f.fieldKey}>
                      {f.label}
                    </option>
                  ))}
              </select>
              <select
                value={cond.operator ?? 'eq'}
                onChange={e => handleCondChange('operator', e.target.value)}
                className={`${INPUT_CLS} w-20 appearance-none`}
                disabled={!cond.dependsOn}
              >
                <option value="eq">eq</option>
                <option value="ne">ne</option>
                <option value="in">in</option>
              </select>
              <input
                value={cond.value ?? ''}
                onChange={e => handleCondChange('value', e.target.value)}
                onBlur={() => onSave({ conditionalDisplay: cond })}
                className={`${INPUT_CLS} w-32`}
                placeholder="Value"
                disabled={!cond.dependsOn}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Section Name */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Section</label>
              <input
                defaultValue={field.sectionName ?? ''}
                onBlur={e => onSave({ sectionName: e.target.value || undefined })}
                className={INPUT_CLS}
                placeholder="General"
                list={`sections-${field.id}`}
              />
              <datalist id={`sections-${field.id}`}>
                {existingSections.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Column Span */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Column Span</label>
              <select
                defaultValue={field.colSpan}
                onChange={e => onSave({ colSpan: Number(e.target.value) })}
                className={`${INPUT_CLS} appearance-none`}
              >
                <option value={1}>1 column</option>
                <option value={2}>2 columns</option>
                <option value={3}>3 columns</option>
                <option value={4}>4 columns (full)</option>
              </select>
            </div>
          </div>

          {/* Line Item Toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={field.isLineItem}
              onChange={e => onSave({ isLineItem: e.target.checked })}
              className="w-4 h-4 rounded border-gray-500 text-nesma-secondary bg-transparent"
            />
            Line Item Field
          </label>
        </div>
      )}
    </div>
  );
};

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'file', label: 'File Upload' },
  { value: 'signature', label: 'Signature' },
  { value: 'lookup_project', label: 'Project Lookup' },
  { value: 'lookup_warehouse', label: 'Warehouse Lookup' },
  { value: 'lookup_supplier', label: 'Supplier Lookup' },
  { value: 'lookup_employee', label: 'Employee Lookup' },
  { value: 'lookup_item', label: 'Item Lookup' },
];

const TABS = ['General', 'Fields', 'Status Flow', 'Permissions', 'Preview'];

export const DynamicTypeBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [activeTab, setActiveTab] = useState('General');

  const { data: typeData } = useDynamicType(isNew ? undefined : id);
  const docType = (typeData as { data?: DynamicDocumentType })?.data;

  const createMut = useCreateDynamicType();
  const updateMut = useUpdateDynamicType();
  const addFieldMut = useAddField();
  const updateFieldMut = useUpdateField();
  const deleteFieldMut = useDeleteField();
  const reorderMut = useReorderFields();

  // ── Form State ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    code: '',
    name: '',
    nameAr: '',
    description: '',
    icon: '',
    category: 'custom',
    isActive: true,
    visibleToRoles: ['admin'] as string[],
    statusFlow: {
      initialStatus: 'draft',
      statuses: [
        { key: 'draft', label: 'Draft', color: 'gray' },
        { key: 'submitted', label: 'Submitted', color: 'blue' },
        { key: 'approved', label: 'Approved', color: 'green' },
        { key: 'rejected', label: 'Rejected', color: 'red' },
      ],
      transitions: {
        draft: ['submitted'],
        submitted: ['approved', 'rejected'],
        rejected: ['draft'],
      } as Record<string, string[]>,
    } as StatusFlowConfig,
  });

  // Load existing data
  useEffect(() => {
    if (docType) {
      setForm({
        code: docType.code,
        name: docType.name,
        nameAr: docType.nameAr ?? '',
        description: docType.description ?? '',
        icon: docType.icon ?? '',
        category: docType.category,
        isActive: docType.isActive,
        visibleToRoles: docType.visibleToRoles,
        statusFlow: docType.statusFlow,
      });
    }
  }, [docType]);

  // ── Handlers ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isNew) {
      await createMut.mutateAsync(form);
      navigate('/admin/dynamic-types');
    } else {
      await updateMut.mutateAsync({ id: id!, ...form });
    }
  };

  const handleAddField = async () => {
    if (!id || isNew) return;
    await addFieldMut.mutateAsync({
      typeId: id,
      fieldKey: `field_${Date.now()}`,
      label: 'New Field',
      fieldType: 'text',
    });
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!id) return;
    await deleteFieldMut.mutateAsync({ typeId: id, fieldId });
  };

  const handleMoveField = (idx: number, direction: 'up' | 'down') => {
    const fields = docType?.fields;
    if (!fields || !id) return;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= fields.length) return;
    const swapped = [...fields];
    [swapped[idx], swapped[target]] = [swapped[target], swapped[idx]];
    reorderMut.mutate({ typeId: id, fieldIds: swapped.map(f => f.id) });
  };

  const existingSections = Array.from(
    new Set((docType?.fields ?? []).map(f => f.sectionName).filter(Boolean) as string[]),
  );

  const inputBase =
    'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/dynamic-types')}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-white">{isNew ? 'New Document Type' : `Edit: ${form.name}`}</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={createMut.isPending || updateMut.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} />
          {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'General' && (
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Code (unique slug)</label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                className={inputBase}
                disabled={!isNew}
                placeholder="safety_inspection"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Name (English)</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputBase}
                placeholder="Safety Inspection"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Name (Arabic)</label>
              <input
                value={form.nameAr}
                onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                className={inputBase}
                dir="rtl"
                placeholder="فحص السلامة"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className={`${inputBase} appearance-none`}
              >
                <option value="custom">Custom</option>
                <option value="safety">Safety</option>
                <option value="quality">Quality</option>
                <option value="hr">HR</option>
                <option value="operations">Operations</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={`${inputBase} min-h-[80px]`}
                placeholder="Describe the purpose of this document type..."
              />
            </div>
          </div>
          <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-500 text-nesma-secondary focus:ring-nesma-secondary bg-transparent"
            />
            <span className="text-sm text-gray-300">Active (visible in sidebar)</span>
          </label>
        </div>
      )}

      {activeTab === 'Fields' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">{docType?.fields?.length ?? 0} field(s) defined</p>
            <button
              onClick={handleAddField}
              disabled={isNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nesma-secondary/20 text-nesma-secondary hover:bg-nesma-secondary/30 transition-colors disabled:opacity-50"
            >
              <Plus size={16} /> Add Field
            </button>
          </div>

          {isNew && (
            <div className="glass-card rounded-2xl p-6 text-center text-gray-400">
              Save the document type first, then add fields.
            </div>
          )}

          {docType?.fields?.map((field, idx) => (
            <div key={field.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-start gap-4">
                {/* Task 5: Reorder buttons */}
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    onClick={() => handleMoveField(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-white/10 text-gray-500 disabled:opacity-30 transition-colors"
                    aria-label="Move field up"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMoveField(idx, 'down')}
                    disabled={idx === (docType?.fields?.length ?? 0) - 1}
                    className="p-1 rounded hover:bg-white/10 text-gray-500 disabled:opacity-30 transition-colors"
                    aria-label="Move field down"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Key</label>
                      <input
                        defaultValue={field.fieldKey}
                        onBlur={e =>
                          updateFieldMut.mutate({ typeId: id!, fieldId: field.id, fieldKey: e.target.value })
                        }
                        className={`${inputBase} text-sm`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Label</label>
                      <input
                        defaultValue={field.label}
                        onBlur={e => updateFieldMut.mutate({ typeId: id!, fieldId: field.id, label: e.target.value })}
                        className={`${inputBase} text-sm`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Type</label>
                      <select
                        defaultValue={field.fieldType}
                        onChange={e =>
                          updateFieldMut.mutate({ typeId: id!, fieldId: field.id, fieldType: e.target.value })
                        }
                        className={`${inputBase} text-sm appearance-none`}
                      >
                        {FIELD_TYPES.map(ft => (
                          <option key={ft.value} value={ft.value}>
                            {ft.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                          type="checkbox"
                          defaultChecked={field.isRequired}
                          onChange={e =>
                            updateFieldMut.mutate({ typeId: id!, fieldId: field.id, isRequired: e.target.checked })
                          }
                          className="w-4 h-4 rounded border-gray-500 text-nesma-secondary bg-transparent"
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                          type="checkbox"
                          defaultChecked={field.showInGrid}
                          onChange={e =>
                            updateFieldMut.mutate({ typeId: id!, fieldId: field.id, showInGrid: e.target.checked })
                          }
                          className="w-4 h-4 rounded border-gray-500 text-nesma-secondary bg-transparent"
                        />
                        Grid
                      </label>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors ml-auto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Task 2: Options Editor (select/multiselect only) */}
                  {(field.fieldType === 'select' || field.fieldType === 'multiselect') && (
                    <FieldOptionsEditor
                      options={field.options ?? []}
                      onSave={options => updateFieldMut.mutate({ typeId: id!, fieldId: field.id, options })}
                    />
                  )}

                  {/* Task 3: Validation Rules */}
                  <ValidationRulesPanel
                    fieldType={field.fieldType}
                    rules={(field.validationRules ?? {}) as Record<string, unknown>}
                    onSave={validationRules =>
                      updateFieldMut.mutate({ typeId: id!, fieldId: field.id, validationRules })
                    }
                  />

                  {/* Task 4: Field Configuration */}
                  <FieldConfigPanel
                    field={field}
                    siblingFields={docType?.fields ?? []}
                    existingSections={existingSections}
                    onSave={updates => updateFieldMut.mutate({ typeId: id!, fieldId: field.id, ...updates })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Status Flow' && (
        <div className="glass-card rounded-2xl p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Initial Status</label>
            <input
              value={form.statusFlow.initialStatus}
              onChange={e => setForm(f => ({ ...f, statusFlow: { ...f.statusFlow, initialStatus: e.target.value } }))}
              className={inputBase}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-gray-300">Statuses</label>
              <button
                onClick={() => {
                  const key = `status_${Date.now()}`;
                  setForm(f => ({
                    ...f,
                    statusFlow: {
                      ...f.statusFlow,
                      statuses: [...f.statusFlow.statuses, { key, label: 'New Status', color: 'gray' }],
                    },
                  }));
                }}
                className="text-sm text-nesma-secondary hover:underline"
              >
                + Add Status
              </button>
            </div>
            <div className="space-y-2">
              {form.statusFlow.statuses.map((status, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <input
                    value={status.key}
                    onChange={e => {
                      const statuses = [...form.statusFlow.statuses];
                      statuses[idx] = { ...statuses[idx], key: e.target.value };
                      setForm(f => ({ ...f, statusFlow: { ...f.statusFlow, statuses } }));
                    }}
                    className={`${inputBase} w-32`}
                    placeholder="key"
                  />
                  <input
                    value={status.label}
                    onChange={e => {
                      const statuses = [...form.statusFlow.statuses];
                      statuses[idx] = { ...statuses[idx], label: e.target.value };
                      setForm(f => ({ ...f, statusFlow: { ...f.statusFlow, statuses } }));
                    }}
                    className={`${inputBase} flex-1`}
                    placeholder="Label"
                  />
                  <select
                    value={status.color}
                    onChange={e => {
                      const statuses = [...form.statusFlow.statuses];
                      statuses[idx] = { ...statuses[idx], color: e.target.value };
                      setForm(f => ({ ...f, statusFlow: { ...f.statusFlow, statuses } }));
                    }}
                    className={`${inputBase} w-28 appearance-none`}
                  >
                    {['gray', 'blue', 'green', 'red', 'amber', 'purple'].map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const statuses = form.statusFlow.statuses.filter((_, i) => i !== idx);
                      setForm(f => ({ ...f, statusFlow: { ...f.statusFlow, statuses } }));
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">Transitions</label>
            <p className="text-xs text-gray-500 mb-3">Define which statuses can transition to which</p>
            <div className="space-y-2">
              {form.statusFlow.statuses.map(status => (
                <div key={status.key} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-gray-300 font-medium">{status.label}</span>
                  <span className="text-gray-500">→</span>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {form.statusFlow.statuses
                      .filter(s => s.key !== status.key)
                      .map(target => {
                        const isAllowed = (form.statusFlow.transitions[status.key] ?? []).includes(target.key);
                        return (
                          <button
                            key={target.key}
                            onClick={() => {
                              const transitions = { ...form.statusFlow.transitions };
                              const current = transitions[status.key] ?? [];
                              transitions[status.key] = isAllowed
                                ? current.filter(k => k !== target.key)
                                : [...current, target.key];
                              setForm(f => ({ ...f, statusFlow: { ...f.statusFlow, transitions } }));
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              isAllowed
                                ? 'bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30'
                                : 'bg-white/5 text-gray-500 border border-white/10 hover:border-white/20'
                            }`}
                          >
                            {target.label}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Permissions' && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Role Visibility</h3>
          <p className="text-sm text-gray-400 mb-4">Select which roles can see this document type in their sidebar</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              'admin',
              'manager',
              'warehouse_supervisor',
              'warehouse_staff',
              'logistics_coordinator',
              'site_engineer',
              'qc_officer',
              'freight_forwarder',
              'transport_supervisor',
              'scrap_committee_member',
            ].map(role => (
              <label
                key={role}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={form.visibleToRoles.includes(role)}
                  onChange={e => {
                    setForm(f => ({
                      ...f,
                      visibleToRoles: e.target.checked
                        ? [...f.visibleToRoles, role]
                        : f.visibleToRoles.filter(r => r !== role),
                    }));
                  }}
                  className="w-4 h-4 rounded border-gray-500 text-nesma-secondary focus:ring-nesma-secondary bg-transparent"
                />
                <span className="text-sm text-gray-300">{role.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Preview' && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Eye size={20} className="text-nesma-secondary" />
            Form Preview
          </h3>
          {docType?.fields && docType.fields.length > 0 ? (
            <div className="border border-white/10 rounded-xl p-6 bg-white/[0.02]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {docType.fields
                  .filter(f => f.showInForm && !f.isLineItem)
                  .map(field => (
                    <div key={field.id} className={COL_SPAN_MAP[field.colSpan] ?? 'md:col-span-1'}>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">
                        {field.label}
                        {field.isRequired && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      <div className="h-10 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Add fields in the Fields tab to see a preview</p>
          )}
        </div>
      )}
    </div>
  );
};
