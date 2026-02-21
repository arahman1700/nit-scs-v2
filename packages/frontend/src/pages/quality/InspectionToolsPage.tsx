import React, { useState } from 'react';
import {
  Calculator,
  ClipboardList,
  Plus,
  Trash2,
  Edit3,
  GripVertical,
  ChevronDown,
  ChevronUp,
  X,
  ToggleLeft,
  ToggleRight,
  Search,
  Table2,
  AlertCircle,
} from 'lucide-react';
import {
  useAqlCalculation,
  useAqlTable,
  useChecklistList,
  useChecklist,
  useCreateChecklist,
  useUpdateChecklist,
  useDeleteChecklist,
  useAddChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useReorderChecklistItems,
} from '@/api/hooks';
import type { InspectionLevel, Checklist } from '@/api/hooks';

// ── Tab definitions ────────────────────────────────────────────────────────

const TABS = [
  { key: 'aql', label: 'AQL Calculator', icon: Calculator },
  { key: 'checklists', label: 'Checklists', icon: ClipboardList },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const STANDARD_AQL_VALUES = [0.1, 0.25, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5];
const INSPECTION_LEVELS: InspectionLevel[] = ['I', 'II', 'III'];
const LEVEL_LABELS: Record<InspectionLevel, string> = {
  I: 'Level I (Reduced)',
  II: 'Level II (Normal)',
  III: 'Level III (Tightened)',
};

const CATEGORIES = ['civil', 'mechanical', 'electrical', 'general'];
const INSPECTION_TYPES = ['visual', 'measurement', 'functional', 'documentation'];

// ── AQL Calculator Tab ─────────────────────────────────────────────────────

const AqlCalculatorTab: React.FC = () => {
  const [lotSize, setLotSize] = useState<string>('');
  const [level, setLevel] = useState<InspectionLevel>('II');
  const [aqlPercent, setAqlPercent] = useState<string>('2.5');
  const [showTable, setShowTable] = useState(false);

  const lotSizeNum = parseInt(lotSize, 10);
  const aqlNum = parseFloat(aqlPercent);

  const { data: aqlResult, isLoading: calcLoading } = useAqlCalculation(
    isNaN(lotSizeNum) || lotSizeNum < 1 ? undefined : lotSizeNum,
    level,
    isNaN(aqlNum) || aqlNum <= 0 ? undefined : aqlNum,
  );
  const { data: tableData, isLoading: tableLoading } = useAqlTable();

  const result = aqlResult?.data;
  const table = tableData?.data;

  return (
    <div className="space-y-6">
      {/* Input Controls */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">AQL Sampling Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lot Size */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Lot Size (quantity)</label>
            <input
              type="number"
              min="1"
              value={lotSize}
              onChange={e => setLotSize(e.target.value)}
              placeholder="Enter lot size..."
              className="input-field w-full"
            />
          </div>

          {/* Inspection Level */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Inspection Level</label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value as InspectionLevel)}
              className="input-field w-full"
            >
              {INSPECTION_LEVELS.map(l => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>

          {/* AQL % */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              AQL % (Acceptable Quality Level)
            </label>
            <select value={aqlPercent} onChange={e => setAqlPercent(e.target.value)} className="input-field w-full">
              {STANDARD_AQL_VALUES.map(v => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Result Card */}
      {result && !calcLoading && (
        <div className="glass-card rounded-2xl p-6 border border-nesma-primary/30">
          <h3 className="text-lg font-semibold text-white mb-4">Sampling Result</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="text-3xl font-bold text-nesma-secondary">{result.sampleSize}</div>
              <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Sample Size</div>
              <div className="text-xs text-gray-500 mt-0.5">units to inspect</div>
            </div>
            <div className="text-center p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <div className="text-3xl font-bold text-emerald-400">{result.acceptNumber}</div>
              <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Accept Number</div>
              <div className="text-xs text-gray-500 mt-0.5">max defects to accept lot</div>
            </div>
            <div className="text-center p-4 bg-red-500/5 rounded-xl border border-red-500/20">
              <div className="text-3xl font-bold text-red-400">{result.rejectNumber}</div>
              <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Reject Number</div>
              <div className="text-xs text-gray-500 mt-0.5">defects that reject lot</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10 flex items-start gap-2">
            <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-300">
              Based on ANSI/ASQ Z1.4 standard. Inspect <strong>{result.sampleSize}</strong> units from a lot of{' '}
              <strong>{result.lotSize}</strong>. If {result.acceptNumber} or fewer defects are found, accept the lot. If{' '}
              {result.rejectNumber} or more defects are found, reject the lot.
            </p>
          </div>
        </div>
      )}

      {/* Toggle Reference Table */}
      <button
        onClick={() => setShowTable(!showTable)}
        className="flex items-center gap-2 text-sm text-nesma-secondary hover:text-white transition-colors"
      >
        <Table2 size={16} />
        {showTable ? 'Hide' : 'Show'} AQL Reference Table
        {showTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Reference Table */}
      {showTable && table && !tableLoading && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5">
            <h3 className="text-sm font-semibold text-white">AQL Sample Size Reference Table</h3>
            <p className="text-xs text-gray-400 mt-1">Based on ANSI/ASQ Z1.4 sampling plans</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-nesma-secondary text-xs uppercase tracking-wider">
                <tr className="bg-white/5">
                  <th className="px-4 py-3 whitespace-nowrap">Lot Size Range</th>
                  <th className="px-4 py-3 whitespace-nowrap text-center">Level I (Reduced)</th>
                  <th className="px-4 py-3 whitespace-nowrap text-center">Level II (Normal)</th>
                  <th className="px-4 py-3 whitespace-nowrap text-center">Level III (Tightened)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                {table.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-white">{row.lotSizeLabel}</td>
                    <td className="px-4 py-2.5 text-center">{row.sampleSizeLevelI}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-nesma-secondary">
                      {row.sampleSizeLevelII}
                    </td>
                    <td className="px-4 py-2.5 text-center">{row.sampleSizeLevelIII}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Checklist Form Modal ───────────────────────────────────────────────────

interface ChecklistFormProps {
  checklist?: Checklist;
  onClose: () => void;
}

const ChecklistFormModal: React.FC<ChecklistFormProps> = ({ checklist, onClose }) => {
  const [name, setName] = useState(checklist?.name ?? '');
  const [description, setDescription] = useState(checklist?.description ?? '');
  const [category, setCategory] = useState(checklist?.category ?? 'general');
  const [items, setItems] = useState<
    Array<{ id?: string; description: string; inspectionType: string; isMandatory: boolean; itemOrder: number }>
  >(
    checklist?.items?.map(i => ({
      id: i.id,
      description: i.description,
      inspectionType: i.inspectionType,
      isMandatory: i.isMandatory,
      itemOrder: i.itemOrder,
    })) ?? [],
  );

  const createMutation = useCreateChecklist();
  const updateMutation = useUpdateChecklist();
  const addItemMutation = useAddChecklistItem();
  const updateItemMutation = useUpdateChecklistItem();
  const deleteItemMutation = useDeleteChecklistItem();
  const reorderMutation = useReorderChecklistItems();

  const isEdit = !!checklist;
  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    addItemMutation.isPending ||
    updateItemMutation.isPending ||
    deleteItemMutation.isPending ||
    reorderMutation.isPending;

  const addNewItem = () => {
    setItems(prev => [
      ...prev,
      {
        description: '',
        inspectionType: 'visual',
        isMandatory: true,
        itemOrder: prev.length + 1,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, itemOrder: i + 1 })));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setItems(prev => {
      const newItems = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= newItems.length) return prev;
      [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
      return newItems.map((item, i) => ({ ...item, itemOrder: i + 1 }));
    });
  };

  const updateItemField = (index: number, field: string, value: unknown) => {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    if (isEdit && checklist) {
      // Update metadata
      await updateMutation.mutateAsync({ id: checklist.id, name, description: description || undefined, category });

      // Handle item changes:
      const existingIds = checklist.items?.map(i => i.id) ?? [];
      const currentIds = items.filter(i => i.id).map(i => i.id!);

      // Delete removed items
      for (const existingId of existingIds) {
        if (!currentIds.includes(existingId)) {
          await deleteItemMutation.mutateAsync({ checklistId: checklist.id, itemId: existingId });
        }
      }

      // Add new items and update existing
      for (const item of items) {
        if (item.id) {
          await updateItemMutation.mutateAsync({
            checklistId: checklist.id,
            itemId: item.id,
            description: item.description,
            inspectionType: item.inspectionType,
            isMandatory: item.isMandatory,
            itemOrder: item.itemOrder,
          });
        } else {
          await addItemMutation.mutateAsync({
            checklistId: checklist.id,
            description: item.description,
            inspectionType: item.inspectionType,
            isMandatory: item.isMandatory,
            itemOrder: item.itemOrder,
          });
        }
      }

      // Reorder if we have IDs
      const allItemIds = items.filter(i => i.id).map(i => i.id!);
      if (allItemIds.length > 0) {
        await reorderMutation.mutateAsync({ checklistId: checklist.id, itemIds: allItemIds });
      }
    } else {
      // Create new
      await createMutation.mutateAsync({
        name,
        description: description || undefined,
        category,
        items: items.map(i => ({
          description: i.description,
          inspectionType: i.inspectionType,
          isMandatory: i.isMandatory,
          itemOrder: i.itemOrder,
        })),
      });
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-nesma-dark flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 flex-shrink-0">
          <h3 className="text-xl font-bold text-white">{isEdit ? 'Edit Checklist' : 'Create Checklist'}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Checklist name..."
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input-field w-full">
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="input-field w-full resize-none"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Checklist Items</label>
              <button
                onClick={addNewItem}
                className="flex items-center gap-1.5 text-xs text-nesma-secondary hover:text-white transition-colors"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                  {/* Drag handle / reorder */}
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button
                      onClick={() => moveItem(idx, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <GripVertical size={14} className="text-gray-600" />
                    <button
                      onClick={() => moveItem(idx, 'down')}
                      disabled={idx === items.length - 1}
                      className="p-0.5 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateItemField(idx, 'description', e.target.value)}
                      placeholder="Inspection step description..."
                      className="input-field w-full text-sm"
                    />
                    <div className="flex items-center gap-4">
                      <select
                        value={item.inspectionType}
                        onChange={e => updateItemField(idx, 'inspectionType', e.target.value)}
                        className="input-field text-xs flex-1"
                      >
                        {INSPECTION_TYPES.map(t => (
                          <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateItemField(idx, 'isMandatory', !item.isMandatory)}
                        className={`flex items-center gap-1.5 text-xs ${
                          item.isMandatory ? 'text-amber-400' : 'text-gray-500'
                        }`}
                      >
                        {item.isMandatory ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        Mandatory
                      </button>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-8">
                  No items yet. Click &quot;Add Item&quot; to add inspection steps.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-transparent hover:bg-white/5 text-gray-300 rounded-xl text-sm font-medium transition-colors border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="px-5 py-2.5 btn-primary text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : isEdit ? 'Update Checklist' : 'Create Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Checklists Tab ─────────────────────────────────────────────────────────

const ChecklistsTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: listData, isLoading } = useChecklistList({
    ...(filterCategory && { category: filterCategory }),
    ...(search && { search }),
  });
  const { data: detailData } = useChecklist(expandedId ?? undefined);
  const deleteMutation = useDeleteChecklist();
  const toggleMutation = useUpdateChecklist();

  const checklists = (listData?.data ?? []) as Checklist[];
  const expandedChecklist = detailData?.data as Checklist | undefined;

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this checklist?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleToggleActive = async (cl: Checklist) => {
    await toggleMutation.mutateAsync({ id: cl.id, isActive: !cl.isActive });
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Search */}
          <div className="relative flex-1 w-full md:max-w-sm">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search checklists..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 focus:ring-1 focus:ring-nesma-secondary/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50 cursor-pointer hover:bg-white/5"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-lg hover:bg-nesma-accent text-sm shadow-lg shadow-nesma-primary/20 transition-all transform hover:-translate-y-0.5"
            >
              <Plus size={16} />
              <span>New Checklist</span>
            </button>
          </div>
        </div>
      </div>

      {/* Checklist List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl h-20 w-full" />
          ))}
        </div>
      ) : checklists.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={28} className="text-gray-600" />
          </div>
          <p className="text-gray-400">No checklists found</p>
          <p className="text-xs text-gray-500 mt-1">Create your first inspection checklist to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {checklists.map(cl => (
            <div
              key={cl.id}
              className="glass-card rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === cl.id ? null : cl.id)}
                >
                  <div className="flex items-center gap-3">
                    <h4 className="text-white font-medium">{cl.name}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                        cl.category === 'civil'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : cl.category === 'mechanical'
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                            : cl.category === 'electrical'
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}
                    >
                      {cl.category ?? 'general'}
                    </span>
                    <span className="text-xs text-gray-500">{cl._count?.items ?? 0} items</span>
                  </div>
                  {cl.description && <p className="text-xs text-gray-500 mt-1">{cl.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(cl)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      cl.isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:bg-white/5'
                    }`}
                    title={cl.isActive ? 'Active (click to deactivate)' : 'Inactive (click to activate)'}
                  >
                    {cl.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <button
                    onClick={() => setEditingChecklist(cl)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-nesma-secondary hover:bg-white/5 transition-colors"
                    title="Edit"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(cl.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === cl.id ? null : cl.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {expandedId === cl.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded Items */}
              {expandedId === cl.id && expandedChecklist && (
                <div className="border-t border-white/10 p-4 bg-white/[0.02]">
                  {expandedChecklist.items && expandedChecklist.items.length > 0 ? (
                    <div className="space-y-2">
                      {expandedChecklist.items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-lg">
                          <span className="text-xs text-gray-500 font-mono w-6 text-right">{idx + 1}.</span>
                          <span className="flex-1 text-sm text-gray-300">{item.description}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              item.inspectionType === 'visual'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                : item.inspectionType === 'measurement'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : item.inspectionType === 'functional'
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}
                          >
                            {item.inspectionType}
                          </span>
                          {item.isMandatory && <span className="text-[10px] text-amber-400 font-medium">Required</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No items in this checklist</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || editingChecklist) && (
        <ChecklistFormModal
          checklist={editingChecklist ?? undefined}
          onClose={() => {
            setShowCreate(false);
            setEditingChecklist(null);
          }}
        />
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

export const InspectionToolsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('aql');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white glow-text">Inspection Tools</h1>
        <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
          <span className="bg-nesma-primary/20 text-nesma-secondary px-2 py-0.5 rounded text-xs border border-nesma-primary/30">
            QC-TOOLS
          </span>
          AQL sampling calculator and inspection checklists
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'aql' && <AqlCalculatorTab />}
      {activeTab === 'checklists' && <ChecklistsTab />}
    </div>
  );
};
