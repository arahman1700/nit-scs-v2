import React, { useState, useCallback } from 'react';
import {
  useCustomFieldDefinitions,
  useCreateCustomFieldDefinition,
  useUpdateCustomFieldDefinition,
  useDeleteCustomFieldDefinition,
} from '@/api/hooks/useCustomFields';
import type { CustomFieldDefinition, CreateFieldDefinitionInput } from '@/api/hooks/useCustomFields';
import { Settings2, Plus, Trash2, Edit2, X, Save } from 'lucide-react';

const ENTITY_TYPES = [
  { value: 'mrrv', label: 'GRN' },
  { value: 'mirv', label: 'MI' },
  { value: 'mrv', label: 'MRN' },
  { value: 'rfim', label: 'QCI' },
  { value: 'osd_report', label: 'DR' },
  { value: 'material_requisition', label: 'MR' },
  { value: 'job_order', label: 'JO' },
  { value: 'shipment', label: 'Shipment' },
  { value: 'gate_pass', label: 'Gate Pass' },
  { value: 'stock_transfer', label: 'WT' },
  { value: 'imsf', label: 'IMSF' },
  { value: 'scrap_item', label: 'Scrap' },
  { value: 'rental_contract', label: 'Rental Contract' },
  { value: 'tool_issue', label: 'Tool Issue' },
];

const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'textarea',
  'checkbox',
  'email',
  'url',
  'phone',
  'currency',
] as const;

const EMPTY_FIELD: CreateFieldDefinitionInput = {
  entityType: '',
  fieldKey: '',
  label: '',
  labelAr: '',
  fieldType: 'text',
  isRequired: false,
  showInGrid: false,
  sortOrder: 0,
};

export function CustomFieldsPage() {
  const [selectedEntityType, setSelectedEntityType] = useState('');
  const { data: listData, isLoading } = useCustomFieldDefinitions(selectedEntityType || undefined);
  const createMutation = useCreateCustomFieldDefinition();
  const updateMutation = useUpdateCustomFieldDefinition();
  const deleteMutation = useDeleteCustomFieldDefinition();

  const [editing, setEditing] = useState<CreateFieldDefinitionInput & { id?: string }>(EMPTY_FIELD);
  const [showForm, setShowForm] = useState(false);

  const fields = (listData as unknown as { data?: CustomFieldDefinition[] })?.data ?? [];

  const handleNew = useCallback(() => {
    setEditing({ ...EMPTY_FIELD, entityType: selectedEntityType });
    setShowForm(true);
  }, [selectedEntityType]);

  const handleEdit = useCallback((f: CustomFieldDefinition) => {
    setEditing({
      id: f.id,
      entityType: f.entityType,
      fieldKey: f.fieldKey,
      label: f.label,
      labelAr: f.labelAr,
      fieldType: f.fieldType,
      options: f.options,
      isRequired: f.isRequired,
      showInGrid: f.showInGrid,
      sortOrder: f.sortOrder,
    });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    const { id, ...body } = editing;
    if (id) {
      await updateMutation.mutateAsync({ id, ...body });
    } else {
      await createMutation.mutateAsync(body);
    }
    setShowForm(false);
  }, [editing, updateMutation, createMutation]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Settings2 size={24} className="text-nesma-secondary" />
          <h1 className="text-2xl font-bold text-white">Custom Fields</h1>
        </div>
        <button
          onClick={handleNew}
          disabled={!selectedEntityType}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Plus size={16} />
          Add Field
        </button>
      </div>

      {/* Entity Type Filter */}
      <div className="glass-card rounded-2xl p-4">
        <label className="text-sm text-gray-300 block mb-2">Document Type</label>
        <div className="flex flex-wrap gap-2">
          {ENTITY_TYPES.map(et => (
            <button
              key={et.value}
              onClick={() => setSelectedEntityType(et.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-300 ${
                selectedEntityType === et.value
                  ? 'bg-nesma-primary text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {et.label}
            </button>
          ))}
        </div>
      </div>

      {/* Field List */}
      <div className="glass-card rounded-2xl p-6">
        {!selectedEntityType ? (
          <p className="text-gray-400 text-center py-10">Select a document type above to manage its custom fields.</p>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-white/10 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : fields.length === 0 ? (
          <p className="text-gray-400 text-center py-10">No custom fields for this document type.</p>
        ) : (
          <div className="space-y-3">
            {fields.map(f => (
              <div
                key={f.id}
                className="flex items-center justify-between glass-card rounded-xl p-4 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-white font-medium">{f.label}</p>
                    <p className="text-sm text-gray-400">
                      {f.fieldKey} &middot; {f.fieldType}
                      {f.isRequired && <span className="text-red-400 ml-2">Required</span>}
                      {f.showInGrid && <span className="text-nesma-secondary ml-2">Grid</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(f)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                    aria-label="Edit"
                  >
                    <Edit2 size={16} className="text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">
                {editing.id ? 'Edit Custom Field' : 'New Custom Field'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Field Key</label>
                  <input
                    className="input-field w-full"
                    value={editing.fieldKey}
                    onChange={e => setEditing(p => ({ ...p, fieldKey: e.target.value }))}
                    placeholder="e.g. custom_ref"
                    disabled={!!editing.id}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Field Type</label>
                  <select
                    className="input-field w-full"
                    value={editing.fieldType}
                    onChange={e => setEditing(p => ({ ...p, fieldType: e.target.value as typeof p.fieldType }))}
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft} value={ft}>
                        {ft}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Label (EN)</label>
                  <input
                    className="input-field w-full"
                    value={editing.label}
                    onChange={e => setEditing(p => ({ ...p, label: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Label (AR)</label>
                  <input
                    className="input-field w-full"
                    value={editing.labelAr ?? ''}
                    onChange={e => setEditing(p => ({ ...p, labelAr: e.target.value }))}
                    dir="rtl"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-1">Sort Order</label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={editing.sortOrder}
                  onChange={e => setEditing(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editing.isRequired}
                    onChange={e => setEditing(p => ({ ...p, isRequired: e.target.checked }))}
                    className="rounded"
                  />
                  Required
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editing.showInGrid}
                    onChange={e => setEditing(p => ({ ...p, showInGrid: e.target.checked }))}
                    className="rounded"
                  />
                  Show in Grid
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                <Save size={16} />
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
