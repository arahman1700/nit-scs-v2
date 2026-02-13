import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ColumnState } from 'ag-grid-community';
import { SmartGrid } from '@/components/smart-grid';
import { ViewSelector } from '@/components/ViewSelector';
import { SaveViewDialog } from '@/components/SaveViewDialog';
import { BulkActionBar } from '@/components/BulkActionBar';
import { useUserViews } from '@/api/hooks/useUserViews';
import type { UserView, UserViewConfig } from '@/api/hooks/useUserViews';
import type { ColumnDef } from '@/config/resourceColumns';

interface DocumentListPanelProps {
  title: string;
  icon: LucideIcon;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  loading: boolean;
  createLabel?: string;
  createUrl?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  entityType?: string;
}

export const DocumentListPanel: React.FC<DocumentListPanelProps> = ({
  title,
  icon: Icon,
  columns,
  rows,
  loading,
  createLabel,
  createUrl,
  onRowClick,
  entityType,
}) => {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<UserViewConfig>({});

  // Track sort and column state for building the config to save
  const columnStateRef = useRef<ColumnState[] | undefined>(undefined);
  const sortRef = useRef<{ sortKey?: string; sortDir?: string }>({});

  const { data: viewsData } = useUserViews(entityType);
  const views: UserView[] = (viewsData as unknown as { data?: UserView[] })?.data ?? [];

  // Find active view object (for passing to SaveViewDialog as existingView)
  const activeView = activeViewId ? (views.find(v => v.id === activeViewId) ?? null) : null;

  // Load default view on mount
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (defaultApplied.current || !entityType || views.length === 0) return;
    const defaultView = views.find(v => v.isDefault);
    if (defaultView) {
      setActiveViewId(defaultView.id);
      setCurrentConfig(defaultView.config);
    }
    defaultApplied.current = true;
  }, [entityType, views]);

  const handleViewChange = useCallback((view: UserView | null) => {
    if (view) {
      setActiveViewId(view.id);
      setCurrentConfig(view.config);
      // Reset tracked state from the selected view
      columnStateRef.current = view.config.columnState as ColumnState[] | undefined;
      sortRef.current = { sortKey: view.config.sortKey, sortDir: view.config.sortDir };
    } else {
      setActiveViewId(null);
      setCurrentConfig({});
      columnStateRef.current = undefined;
      sortRef.current = {};
    }
  }, []);

  const handleSortChanged = useCallback((sortKey: string, sortDir: 'asc' | 'desc') => {
    sortRef.current = { sortKey, sortDir };
  }, []);

  const handleColumnStateChanged = useCallback((state: ColumnState[]) => {
    columnStateRef.current = state;
  }, []);

  const buildCurrentConfig = useCallback(
    (): UserViewConfig => ({
      columnState: columnStateRef.current,
      sortKey: sortRef.current.sortKey,
      sortDir: sortRef.current.sortDir,
    }),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-nesma-secondary" />
          <h3 className="text-white font-semibold">{title}</h3>
          <span className="text-xs text-gray-500">({rows.length} records)</span>
        </div>
        <div className="flex items-center gap-3">
          {entityType && (
            <ViewSelector
              entityType={entityType}
              activeViewId={activeViewId}
              onViewChange={handleViewChange}
              onSaveRequest={() => setShowSaveDialog(true)}
            />
          )}
          {createLabel && createUrl && (
            <button
              onClick={() => navigate(createUrl)}
              className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {createLabel}
            </button>
          )}
        </div>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-nesma-secondary animate-spin" />
            <span className="ml-3 text-gray-400">Loading {title.toLowerCase()}...</span>
          </div>
        ) : (
          <SmartGrid
            columns={columns}
            rowData={rows}
            loading={loading}
            onRowClicked={onRowClick}
            isDocument
            onSortChanged={handleSortChanged}
            onColumnStateChanged={handleColumnStateChanged}
            initialColumnState={currentConfig.columnState as ColumnState[] | undefined}
            {...(entityType ? { selectedIds, onSelectionChanged: setSelectedIds } : {})}
          />
        )}
      </div>

      {entityType && (
        <SaveViewDialog
          open={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          entityType={entityType}
          config={buildCurrentConfig()}
          existingView={activeView}
        />
      )}

      {entityType && selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          entityType={entityType}
          rows={rows}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
};
