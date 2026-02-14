import React, { useState, useCallback } from 'react';
import {
  useCustomDataSourceList,
  useCreateCustomDataSource,
  useUpdateCustomDataSource,
  useDeleteCustomDataSource,
  usePreviewCustomDataSource,
} from '@/api/hooks/useCustomDataSources';
import type { CustomDataSource, CreateDataSourceInput } from '@/api/hooks/useCustomDataSources';
import { Database, Plus, Trash2, Play, Edit2, X, Save, Filter } from 'lucide-react';

const ENTITY_TYPES = [
  'mrrv',
  'mirv',
  'mrv',
  'rfim',
  'osd_report',
  'material_requisition',
  'job_order',
  'shipment',
  'gate_pass',
  'stock_transfer',
  'imsf',
  'scrap_item',
  'surplus',
  'rental_contract',
  'tool_issue',
  'generator_fuel',
  'generator_maintenance',
  'handover',
  'project',
  'item',
  'warehouse',
  'supplier',
  'employee',
];

const AGGREGATIONS = ['count', 'sum', 'avg', 'group_by', 'timeseries'] as const;
const OUTPUT_TYPES = ['number', 'grouped', 'timeseries', 'table'] as const;

const ENTITY_FIELDS: Record<string, string[]> = {
  mrrv: ['status', 'receiveDate', 'supplierId', 'projectId', 'warehouseId', 'totalAmount'],
  mirv: ['status', 'issueDate', 'projectId', 'warehouseId', 'requestedById'],
  mrv: ['status', 'returnDate', 'projectId', 'warehouseId'],
  rfim: ['status', 'inspectionDate', 'result', 'inspectedById'],
  osd_report: ['status', 'reportDate', 'type', 'projectId'],
  material_requisition: ['status', 'requestDate', 'projectId', 'priority'],
  job_order: ['status', 'orderDate', 'projectId'],
  shipment: ['status', 'shipDate', 'supplierId', 'carrier'],
  gate_pass: ['status', 'issueDate', 'type', 'projectId'],
  stock_transfer: ['status', 'transferDate', 'fromWarehouseId', 'toWarehouseId'],
  imsf: ['status', 'requestDate', 'senderProjectId', 'receiverProjectId'],
  scrap_item: ['status', 'disposalDate', 'projectId', 'approvalStatus'],
  project: ['status', 'startDate', 'endDate', 'client'],
  item: ['category', 'unitOfMeasure', 'isActive'],
  warehouse: ['type', 'projectId', 'isActive'],
  supplier: ['category', 'rating', 'isActive'],
  employee: ['department', 'position', 'projectId'],
};

const FILTER_OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'in', label: 'in' },
  { value: 'contains', label: 'contains' },
];

const DATE_RANGE_PRESETS = ['7d', '30d', '90d', 'this_month', 'this_year'] as const;

interface FilterRow {
  field: string;
  op: string;
  value: string;
}

type EditingState = CreateDataSourceInput & { id?: string };

const DataSourceFilterBuilder: React.FC<{
  editing: EditingState;
  setEditing: React.Dispatch<React.SetStateAction<EditingState>>;
}> = ({ editing, setEditing }) => {
  const entityFields = ENTITY_FIELDS[editing.entityType] ?? [];
  const filters: FilterRow[] = (editing.queryTemplate?.filters ?? []).map(f => ({
    field: f.field,
    op: f.op,
    value: String(f.value ?? ''),
  }));

  const updateFilters = (newFilters: FilterRow[]) => {
    setEditing(p => ({
      ...p,
      queryTemplate: { ...p.queryTemplate, filters: newFilters },
    }));
  };

  const addFilter = () => {
    updateFilters([...filters, { field: '', op: 'eq', value: '' }]);
  };

  const updateFilter = (index: number, updated: FilterRow) => {
    const next = [...filters];
    next[index] = updated;
    updateFilters(next);
  };

  const removeFilter = (index: number) => {
    updateFilters(filters.filter((_, i) => i !== index));
  };

  const updateQueryField = (key: string, value: string) => {
    setEditing(p => ({
      ...p,
      queryTemplate: { ...p.queryTemplate, [key]: value },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-nesma-secondary" />
        <span className="text-sm font-semibold text-white">Query Filters</span>
      </div>

      {/* Filter rows */}
      <div className="space-y-2">
        {filters.map((filter, i) => (
          <div key={i} className="flex items-center gap-2 bg-black/20 rounded-lg p-2 border border-white/5">
            <input
              type="text"
              value={filter.field}
              onChange={e => updateFilter(i, { ...filter, field: e.target.value })}
              placeholder="field"
              list={`ds-fields-${i}`}
              className="flex-1 bg-black/40 text-white text-sm rounded px-2 py-1.5 border border-white/10 focus:border-nesma-secondary outline-none min-w-[120px]"
            />
            <datalist id={`ds-fields-${i}`}>
              {entityFields.map(f => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <select
              value={filter.op}
              onChange={e => updateFilter(i, { ...filter, op: e.target.value })}
              className="bg-black/40 text-white text-sm rounded px-2 py-1.5 border border-white/10 focus:border-nesma-secondary outline-none"
            >
              {FILTER_OPERATORS.map(op => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={filter.value}
              onChange={e => updateFilter(i, { ...filter, value: e.target.value })}
              placeholder="value"
              className="flex-1 bg-black/40 text-white text-sm rounded px-2 py-1.5 border border-white/10 focus:border-nesma-secondary outline-none min-w-[80px]"
            />
            <button
              onClick={() => removeFilter(i)}
              className="text-red-400 hover:text-red-300 p-1"
              aria-label="Remove filter"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addFilter}
        className="flex items-center gap-1 text-xs text-nesma-secondary hover:text-white transition-colors"
      >
        <Plus size={12} /> Add Filter
      </button>

      {/* groupBy — only for group_by aggregation */}
      {editing.aggregation === 'group_by' && (
        <div>
          <label className="text-sm text-gray-300 block mb-1">Group By Field</label>
          <input
            type="text"
            value={editing.queryTemplate?.groupBy ?? ''}
            onChange={e => updateQueryField('groupBy', e.target.value)}
            placeholder="e.g. status"
            list="ds-groupby-fields"
            className="input-field w-full"
          />
          <datalist id="ds-groupby-fields">
            {entityFields.map(f => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      )}

      {/* dateField + dateRange — only for timeseries */}
      {editing.aggregation === 'timeseries' && (
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-300 block mb-1">Date Field</label>
            <input
              type="text"
              value={editing.queryTemplate?.dateField ?? ''}
              onChange={e => updateQueryField('dateField', e.target.value)}
              placeholder="e.g. createdAt"
              list="ds-date-fields"
              className="input-field w-full"
            />
            <datalist id="ds-date-fields">
              {[
                'createdAt',
                'updatedAt',
                ...entityFields.filter(f => f.toLowerCase().includes('date') || f.toLowerCase().includes('at')),
              ].map(f => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Date Range</label>
            <div className="flex flex-wrap gap-2">
              {DATE_RANGE_PRESETS.map(preset => (
                <button
                  key={preset}
                  onClick={() => updateQueryField('dateRange', preset)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    editing.queryTemplate?.dateRange === preset
                      ? 'bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* sumField — only for sum / avg */}
      {(editing.aggregation === 'sum' || editing.aggregation === 'avg') && (
        <div>
          <label className="text-sm text-gray-300 block mb-1">Aggregate Field</label>
          <input
            type="text"
            value={editing.queryTemplate?.sumField ?? ''}
            onChange={e => updateQueryField('sumField', e.target.value)}
            placeholder="e.g. totalAmount"
            list="ds-numeric-fields"
            className="input-field w-full"
          />
          <datalist id="ds-numeric-fields">
            {entityFields
              .filter(
                f =>
                  f.toLowerCase().includes('amount') ||
                  f.toLowerCase().includes('total') ||
                  f.toLowerCase().includes('qty') ||
                  f.toLowerCase().includes('rating') ||
                  f.toLowerCase().includes('count'),
              )
              .map(f => (
                <option key={f} value={f} />
              ))}
          </datalist>
        </div>
      )}
    </div>
  );
};

const EMPTY_FORM: CreateDataSourceInput = {
  name: '',
  sourceKey: '',
  entityType: '',
  aggregation: 'count',
  queryTemplate: { entityType: '', filters: [] },
  outputType: 'number',
  isPublic: true,
};

export function CustomDataSourcePage() {
  const { data: listData, isLoading } = useCustomDataSourceList();
  const createMutation = useCreateCustomDataSource();
  const updateMutation = useUpdateCustomDataSource();
  const deleteMutation = useDeleteCustomDataSource();
  const previewMutation = usePreviewCustomDataSource();

  const [editing, setEditing] = useState<CreateDataSourceInput & { id?: string }>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [previewResult, setPreviewResult] = useState<unknown>(null);

  const sources = (listData as unknown as { data?: CustomDataSource[] })?.data ?? [];

  const handleNew = useCallback(() => {
    setEditing(EMPTY_FORM);
    setShowForm(true);
    setPreviewResult(null);
  }, []);

  const handleEdit = useCallback((src: CustomDataSource) => {
    setEditing({
      id: src.id,
      name: src.name,
      sourceKey: src.sourceKey,
      entityType: src.entityType,
      aggregation: src.aggregation,
      queryTemplate: src.queryTemplate,
      outputType: src.outputType,
      isPublic: src.isPublic,
    });
    setShowForm(true);
    setPreviewResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    const { id, ...body } = editing;
    const payload: CreateDataSourceInput = {
      ...body,
      queryTemplate: { ...body.queryTemplate, entityType: body.entityType },
    };
    if (id) {
      await updateMutation.mutateAsync({ id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowForm(false);
  }, [editing, updateMutation, createMutation]);

  const handlePreview = useCallback(async () => {
    const result = await previewMutation.mutateAsync({
      entityType: editing.entityType,
      aggregation: editing.aggregation,
      queryTemplate: { ...editing.queryTemplate, entityType: editing.entityType },
      outputType: editing.outputType,
      name: editing.name || 'Preview',
    });
    setPreviewResult((result as unknown as { data?: unknown })?.data ?? result);
  }, [editing, previewMutation]);

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
          <Database size={24} className="text-nesma-secondary" />
          <h1 className="text-2xl font-bold text-white">Custom Data Sources</h1>
        </div>
        <button onClick={handleNew} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add Data Source
        </button>
      </div>

      {/* List */}
      <div className="glass-card rounded-2xl p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/10 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <p className="text-gray-400 text-center py-10">
            No custom data sources yet. Create one to build custom KPIs.
          </p>
        ) : (
          <div className="space-y-3">
            {sources.map(src => (
              <div
                key={src.id}
                className="flex items-center justify-between glass-card rounded-xl p-4 hover:bg-white/10 transition-all duration-300"
              >
                <div>
                  <p className="text-white font-medium">{src.name}</p>
                  <p className="text-sm text-gray-400">
                    {src.entityType} &middot; {src.aggregation} &middot; {src.outputType}
                    <span className="text-gray-500 ml-2">({src.sourceKey})</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(src)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                    aria-label="Edit"
                  >
                    <Edit2 size={16} className="text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(src.id)}
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
            className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">
                {editing.id ? 'Edit Data Source' : 'New Data Source'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm text-gray-300 block mb-1">Name</label>
                <input
                  className="input-field w-full"
                  value={editing.name}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-1">Source Key</label>
                <input
                  className="input-field w-full"
                  value={editing.sourceKey}
                  onChange={e => setEditing(p => ({ ...p, sourceKey: e.target.value }))}
                  placeholder="e.g. custom/my_metric"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-1">Entity Type</label>
                <select
                  className="input-field w-full"
                  value={editing.entityType}
                  onChange={e => setEditing(p => ({ ...p, entityType: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {ENTITY_TYPES.map(et => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-1">Aggregation</label>
                <select
                  className="input-field w-full"
                  value={editing.aggregation}
                  onChange={e => setEditing(p => ({ ...p, aggregation: e.target.value as typeof p.aggregation }))}
                >
                  {AGGREGATIONS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-1">Output Type</label>
                <select
                  className="input-field w-full"
                  value={editing.outputType}
                  onChange={e => setEditing(p => ({ ...p, outputType: e.target.value as typeof p.outputType }))}
                >
                  {OUTPUT_TYPES.map(ot => (
                    <option key={ot} value={ot}>
                      {ot}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={editing.isPublic}
                  onChange={e => setEditing(p => ({ ...p, isPublic: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="isPublic" className="text-sm text-gray-300">
                  Public (visible to all users)
                </label>
              </div>
            </div>

            {/* Visual Filter Builder */}
            {editing.entityType && <DataSourceFilterBuilder editing={editing} setEditing={setEditing} />}

            {/* Preview */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <button
                onClick={handlePreview}
                disabled={!editing.entityType || previewMutation.isPending}
                className="flex items-center gap-2 text-nesma-secondary hover:text-white transition-all text-sm"
              >
                <Play size={16} />
                {previewMutation.isPending ? 'Running...' : 'Preview Result'}
              </button>
              {previewResult !== null && (
                <pre className="bg-black/30 rounded-xl p-4 text-xs text-gray-300 max-h-48 overflow-auto">
                  {JSON.stringify(previewResult, null, 2)}
                </pre>
              )}
            </div>

            {/* Actions */}
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
