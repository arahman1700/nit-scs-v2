import React, { useState, useCallback } from 'react';
import {
  useCustomDataSourceList,
  useCreateCustomDataSource,
  useUpdateCustomDataSource,
  useDeleteCustomDataSource,
  usePreviewCustomDataSource,
} from '@/api/hooks/useCustomDataSources';
import type { CustomDataSource, CreateDataSourceInput } from '@/api/hooks/useCustomDataSources';
import { Database, Plus, Trash2, Play, Edit2, X, Save } from 'lucide-react';

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
