import React, { useState, useCallback } from 'react';
import { LayoutDashboard, Save, Eye, EyeOff, Plus, Trash2, ChevronDown } from 'lucide-react';
import {
  useDashboards,
  useDashboard,
  useCreateDashboard,
  useDeleteDashboard,
  useAddWidget,
  useUpdateWidget,
  useDeleteWidget,
  useUpdateLayout,
} from '@/api/hooks/useDashboards';
import type { DashboardWidget } from '@/api/hooks/useDashboards';
import { DashboardGrid } from '@/components/dashboard-builder/DashboardGrid';
import { WidgetPalette } from '@/components/dashboard-builder/WidgetPalette';
import type { WidgetTypeDefinition } from '@/components/dashboard-builder/WidgetPalette';

export const DashboardBuilderPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editMode, setEditMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: dashboards, isLoading: loadingList } = useDashboards();
  const { data: dashboard, isLoading: loadingDashboard } = useDashboard(selectedId);
  const createDashboard = useCreateDashboard();
  const deleteDashboard = useDeleteDashboard();
  const addWidgetMut = useAddWidget();
  const updateWidgetMut = useUpdateWidget();
  const deleteWidgetMut = useDeleteWidget();
  const updateLayoutMut = useUpdateLayout();

  const list = dashboards?.data ?? [];
  const currentDashboard = dashboard?.data;
  const widgets = currentDashboard?.widgets ?? [];

  // Auto-select first dashboard
  React.useEffect(() => {
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].id);
    }
  }, [selectedId, list]);

  const handleCreateDashboard = useCallback(async () => {
    if (!newName.trim()) return;
    const result = await createDashboard.mutateAsync({ name: newName.trim() });
    setSelectedId(result.data?.id);
    setNewName('');
    setShowCreate(false);
    setEditMode(true);
  }, [newName, createDashboard]);

  const handleAddWidget = useCallback(
    async (wt: WidgetTypeDefinition) => {
      if (!selectedId) return;
      await addWidgetMut.mutateAsync({
        dashboardId: selectedId,
        widgetType: wt.type,
        title: wt.label,
        dataSource: '',
        width: wt.defaultWidth,
        height: wt.defaultHeight,
        position: widgets.length,
      });
    },
    [selectedId, addWidgetMut, widgets.length],
  );

  const handleUpdateWidget = useCallback(
    async (widgetId: string, updates: Partial<DashboardWidget>) => {
      if (!selectedId) return;
      await updateWidgetMut.mutateAsync({
        dashboardId: selectedId,
        widgetId,
        title: updates.title,
        dataSource: updates.dataSource,
        displayConfig: updates.displayConfig,
        width: updates.width,
      });
    },
    [selectedId, updateWidgetMut],
  );

  const handleDeleteWidget = useCallback(
    async (widgetId: string) => {
      if (!selectedId) return;
      await deleteWidgetMut.mutateAsync({ dashboardId: selectedId, widgetId });
    },
    [selectedId, deleteWidgetMut],
  );

  const handleReorder = useCallback(
    async (newOrder: DashboardWidget[]) => {
      if (!selectedId) return;
      await updateLayoutMut.mutateAsync({
        dashboardId: selectedId,
        layout: newOrder.map(w => ({
          widgetId: w.id,
          position: w.position,
          width: w.width,
          height: w.height,
        })),
      });
    },
    [selectedId, updateLayoutMut],
  );

  const handleDeleteDashboard = useCallback(async () => {
    if (!selectedId) return;
    await deleteDashboard.mutateAsync(selectedId);
    setSelectedId(undefined);
    setEditMode(false);
  }, [selectedId, deleteDashboard]);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-[#2E3A8C]/30 text-[#80D1E9]">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Dashboard Builder</h1>
            <p className="text-xs text-gray-500">Create custom dashboards with drag-and-drop widgets</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Dashboard selector */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg
                text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors"
            >
              {currentDashboard?.name || 'Select Dashboard'}
              <ChevronDown size={14} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-64 bg-[#0d2137] border border-white/10 rounded-xl shadow-2xl z-50 py-1">
                {list.map(d => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedId(d.id);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors
                      ${d.id === selectedId ? 'text-[#80D1E9]' : 'text-gray-300'}`}
                  >
                    {d.name}
                    {d.isDefault && <span className="ml-2 text-xs text-gray-500">(default)</span>}
                  </button>
                ))}
                <div className="border-t border-white/10 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowCreate(true);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#80D1E9] hover:bg-white/5"
                  >
                    <Plus size={14} /> New Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Edit / Preview toggle */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border
              ${
                editMode
                  ? 'bg-[#2E3A8C]/40 border-[#80D1E9]/40 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
          >
            {editMode ? <EyeOff size={14} /> : <Eye size={14} />}
            {editMode ? 'Preview' : 'Edit'}
          </button>

          {/* Save layout (only in edit mode with a dashboard selected) */}
          {editMode && selectedId && (
            <button
              onClick={() => handleReorder(widgets)}
              disabled={updateLayoutMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-[#2E3A8C] hover:bg-[#2E3A8C]/80
                text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {updateLayoutMut.isPending ? 'Saving...' : 'Save Layout'}
            </button>
          )}

          {/* Delete dashboard */}
          {editMode && selectedId && (
            <button
              onClick={handleDeleteDashboard}
              disabled={deleteDashboard.isPending}
              className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              title="Delete dashboard"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d2137] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">New Dashboard</h2>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Dashboard name..."
              autoFocus
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white
                placeholder:text-gray-600 focus:border-[#80D1E9]/50 focus:outline-none mb-4"
              onKeyDown={e => e.key === 'Enter' && handleCreateDashboard()}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleCreateDashboard}
                disabled={!newName.trim() || createDashboard.isPending}
                className="px-5 py-2 text-sm bg-[#2E3A8C] hover:bg-[#2E3A8C]/80 text-white
                  rounded-lg disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex">
        {/* Sidebar (edit mode only) */}
        {editMode && (
          <div className="w-64 flex-shrink-0 border-r border-white/10 p-4">
            <WidgetPalette onAddWidget={handleAddWidget} />
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 p-6">
          {loadingList || loadingDashboard ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : !selectedId ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <LayoutDashboard size={48} className="mb-4 opacity-30" />
              <p className="text-lg mb-2">No dashboard selected</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-[#2E3A8C] hover:bg-[#2E3A8C]/80
                  text-white text-sm rounded-lg transition-colors"
              >
                <Plus size={14} /> Create Dashboard
              </button>
            </div>
          ) : (
            <DashboardGrid
              widgets={widgets}
              onReorder={handleReorder}
              onUpdateWidget={handleUpdateWidget}
              onDeleteWidget={handleDeleteWidget}
              editMode={editMode}
            />
          )}
        </div>
      </div>
    </div>
  );
};
