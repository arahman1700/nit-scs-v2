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
} from '@/domains/system/hooks/useDynamicDocumentTypes';
import type {
  DynamicDocumentType,
  StatusFlowConfig,
} from '@/domains/system/hooks/useDynamicDocumentTypes';
import { ArrowLeft, Save, Eye } from 'lucide-react';

// Sub-components
import { FieldsTab } from './dynamic-type/FieldsTab';
import { StatusFlowTab } from './dynamic-type/StatusFlowTab';

const COL_SPAN_MAP: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
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
            aria-label="Go back"
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

      {/* Tab: General */}
      {activeTab === 'General' && (
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="doctype-code-field" className="block text-sm font-medium text-gray-300 mb-1.5">
                Code (unique slug)
              </label>
              <input
                id="doctype-code-field"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                className={inputBase}
                disabled={!isNew}
                placeholder="safety_inspection"
              />
            </div>
            <div>
              <label htmlFor="doctype-name-field" className="block text-sm font-medium text-gray-300 mb-1.5">
                Name (English)
              </label>
              <input
                id="doctype-name-field"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputBase}
                placeholder="Safety Inspection"
              />
            </div>
            <div>
              <label htmlFor="doctype-category-field" className="block text-sm font-medium text-gray-300 mb-1.5">
                Category
              </label>
              <select
                id="doctype-category-field"
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
              <label htmlFor="doctype-description-field" className="block text-sm font-medium text-gray-300 mb-1.5">
                Description
              </label>
              <textarea
                id="doctype-description-field"
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

      {/* Tab: Fields */}
      {activeTab === 'Fields' && (
        <FieldsTab
          isNew={isNew}
          typeId={id}
          fields={docType?.fields}
          fieldTypes={FIELD_TYPES}
          existingSections={existingSections}
          onAddField={handleAddField}
          onDeleteField={handleDeleteField}
          onMoveField={handleMoveField}
          onUpdateField={params => updateFieldMut.mutate(params)}
        />
      )}

      {/* Tab: Status Flow */}
      {activeTab === 'Status Flow' && (
        <StatusFlowTab
          statusFlow={form.statusFlow}
          onStatusFlowChange={updater =>
            setForm(f => ({ ...f, statusFlow: updater(f.statusFlow) }))
          }
        />
      )}

      {/* Tab: Permissions */}
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

      {/* Tab: Preview */}
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
