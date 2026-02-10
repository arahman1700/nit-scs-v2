import React, { useState } from 'react';
import {
  usePutAwayRules,
  useCreatePutAwayRule,
  useUpdatePutAwayRule,
  useDeletePutAwayRule,
  usePutAwaySuggestion,
} from '@/api/hooks/usePutAwayRules';
import { useWarehouseZoneList } from '@/api/hooks/useWarehouseZones';
import { useWarehouses, useItems } from '@/api/hooks/useMasterData';
import type { PutAwayRule } from '@/api/hooks/usePutAwayRules';

// ── Item categories matching the Prisma CHECK constraint ─────────────────
const ITEM_CATEGORIES = ['construction', 'electrical', 'mechanical', 'safety', 'tools', 'consumables', 'spare_parts'];

// ── Empty form state ─────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '',
  priority: 100,
  warehouseId: '',
  targetZoneId: '',
  itemCategory: '',
  isHazardous: false,
  maxWeight: '',
  isActive: true,
};

export function PutAwayRulesPage() {
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PutAwayRule | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Test rule state
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testItemId, setTestItemId] = useState('');
  const [testWarehouseId, setTestWarehouseId] = useState('');

  // Data queries
  const { data: rulesRes, isLoading } = usePutAwayRules(selectedWarehouse || undefined);
  const { data: warehousesRes } = useWarehouses();
  const { data: zonesRes } = useWarehouseZoneList(form.warehouseId ? { warehouseId: form.warehouseId } : undefined);
  const { data: itemsRes } = useItems();
  const { data: suggestionsRes, isFetching: suggestionsLoading } = usePutAwaySuggestion(
    testItemId || undefined,
    testWarehouseId || undefined,
  );

  // Mutations
  const createMutation = useCreatePutAwayRule();
  const updateMutation = useUpdatePutAwayRule();
  const deleteMutation = useDeletePutAwayRule();

  const rules = (rulesRes as unknown as { data?: PutAwayRule[] })?.data ?? [];
  const warehouses =
    (warehousesRes as unknown as { data?: Array<{ id: string; warehouseName: string; warehouseCode: string }> })
      ?.data ?? [];
  const zones =
    (zonesRes as unknown as { data?: Array<{ id: string; zoneName: string; zoneCode: string }> })?.data ?? [];
  const items =
    (itemsRes as unknown as { data?: Array<{ id: string; code: string; name: string; category: string }> })?.data ?? [];
  const suggestions =
    (
      suggestionsRes as unknown as {
        data?: Array<{ zoneId: string; zoneName: string; zoneCode: string; reason: string; confidence: string }>;
      }
    )?.data ?? [];

  function openCreate() {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(rule: PutAwayRule) {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      priority: rule.priority,
      warehouseId: rule.warehouseId,
      targetZoneId: rule.targetZoneId ?? '',
      itemCategory: rule.itemCategory ?? '',
      isHazardous: rule.isHazardous,
      maxWeight: rule.maxWeight != null ? String(rule.maxWeight) : '',
      isActive: rule.isActive,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name: form.name,
      priority: form.priority,
      warehouseId: form.warehouseId,
      targetZoneId: form.targetZoneId || undefined,
      itemCategory: form.itemCategory || undefined,
      isHazardous: form.isHazardous,
      maxWeight: form.maxWeight ? Number(form.maxWeight) : undefined,
      isActive: form.isActive,
    };

    if (editingRule) {
      await updateMutation.mutateAsync({ id: editingRule.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowModal(false);
  }

  async function handleDelete() {
    if (!deleteConfirmId) return;
    await deleteMutation.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  }

  const confidenceBadge = (conf: string) => {
    const colors: Record<string, string> = {
      high: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[conf] ?? colors.low}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Put-Away Rules</h1>
          <p className="text-sm text-gray-400 mt-1">Configure zone placement rules for incoming materials</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            className="px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all text-sm"
          >
            {showTestPanel ? 'Hide' : 'Test Rule'}
          </button>
          <button onClick={openCreate} className="btn-primary">
            + New Rule
          </button>
        </div>
      </div>

      {/* Filter by warehouse */}
      <div className="glass-card rounded-2xl p-4">
        <label className="block text-sm text-gray-400 mb-1">Filter by Warehouse</label>
        <select
          value={selectedWarehouse}
          onChange={e => setSelectedWarehouse(e.target.value)}
          className="input-field w-full max-w-xs"
        >
          <option value="">All Warehouses</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>
              {w.warehouseCode} - {w.warehouseName}
            </option>
          ))}
        </select>
      </div>

      {/* Test Rule Panel */}
      {showTestPanel && (
        <div className="glass-card rounded-2xl p-6 border border-nesma-primary/30">
          <h2 className="text-lg font-semibold text-white mb-4">Test Put-Away Suggestion</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Warehouse</label>
              <select
                value={testWarehouseId}
                onChange={e => setTestWarehouseId(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Select warehouse...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.warehouseCode} - {w.warehouseName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Item</label>
              <select value={testItemId} onChange={e => setTestItemId(e.target.value)} className="input-field w-full">
                <option value="">Select item...</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {suggestionsLoading && <p className="text-gray-400 text-sm">Loading suggestions...</p>}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-300">Suggested Zones (ranked):</h3>
              {suggestions.map((s, i) => (
                <div
                  key={s.zoneId}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-500 w-6">{i + 1}.</span>
                    <div>
                      <span className="text-white font-medium">{s.zoneCode}</span>
                      <span className="text-gray-400 ml-2 text-sm">{s.zoneName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{s.reason}</span>
                    <span className={confidenceBadge(s.confidence)}>{s.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {testItemId && testWarehouseId && !suggestionsLoading && suggestions.length === 0 && (
            <p className="text-gray-500 text-sm">No zones available for this combination.</p>
          )}
        </div>
      )}

      {/* Rules Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            No put-away rules configured yet. Create one to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Warehouse</th>
                <th className="px-4 py-3 font-medium">Target Zone</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Hazardous</th>
                <th className="px-4 py-3 font-medium">Max Weight</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-gray-300 font-mono">{rule.priority}</td>
                  <td className="px-4 py-3 text-white font-medium">{rule.name}</td>
                  <td className="px-4 py-3 text-gray-300">{rule.warehouse?.warehouseCode ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {rule.targetZone ? `${rule.targetZone.zoneCode} - ${rule.targetZone.zoneName}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{rule.itemCategory ?? '-'}</td>
                  <td className="px-4 py-3">
                    {rule.isHazardous ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{rule.maxWeight != null ? `${rule.maxWeight} kg` : '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        rule.isActive
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(rule)}
                      className="text-nesma-primary hover:text-nesma-accent mr-3 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(rule.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingRule ? 'Edit Rule' : 'Create Put-Away Rule'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rule Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority (lower = higher)</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                    className="input-field w-full"
                    min={1}
                    max={9999}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Warehouse *</label>
                  <select
                    value={form.warehouseId}
                    onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value, targetZoneId: '' }))}
                    className="input-field w-full"
                    required
                    disabled={!!editingRule}
                  >
                    <option value="">Select...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.warehouseCode} - {w.warehouseName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Zone</label>
                <select
                  value={form.targetZoneId}
                  onChange={e => setForm(f => ({ ...f, targetZoneId: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">None (no zone target)</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>
                      {z.zoneCode} - {z.zoneName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Item Category Filter</label>
                  <select
                    value={form.itemCategory}
                    onChange={e => setForm(f => ({ ...f, itemCategory: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="">Any category</option>
                    {ITEM_CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Weight (kg)</label>
                  <input
                    type="number"
                    value={form.maxWeight}
                    onChange={e => setForm(f => ({ ...f, maxWeight: e.target.value }))}
                    className="input-field w-full"
                    step="0.1"
                    min={0}
                    placeholder="No limit"
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isHazardous}
                    onChange={e => setForm(f => ({ ...f, isHazardous: e.target.checked }))}
                    className="rounded border-white/20 bg-white/5"
                  />
                  Hazardous materials only
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-white/20 bg-white/5"
                  />
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingRule
                      ? 'Update Rule'
                      : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-2">Delete Rule</h2>
            <p className="text-sm text-gray-400 mb-4">
              Are you sure you want to delete this put-away rule? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-all text-sm"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
