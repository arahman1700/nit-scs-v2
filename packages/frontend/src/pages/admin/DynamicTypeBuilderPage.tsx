import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useDynamicType,
  useCreateDynamicType,
  useUpdateDynamicType,
  useAddField,
  useUpdateField,
  useDeleteField,
} from '@/api/hooks/useDynamicDocumentTypes';
import type { DynamicDocumentType, FieldDefinition, StatusFlowConfig } from '@/api/hooks/useDynamicDocumentTypes';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Eye } from 'lucide-react';

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

          {docType?.fields?.map(field => (
            <div key={field.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-start gap-4">
                <div className="pt-2 text-gray-500 cursor-grab">
                  <GripVertical size={20} />
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Key</label>
                    <input
                      defaultValue={field.fieldKey}
                      onBlur={e => updateFieldMut.mutate({ typeId: id!, fieldId: field.id, fieldKey: e.target.value })}
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
                    <div key={field.id} className={`col-span-1 md:col-span-${field.colSpan}`}>
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
