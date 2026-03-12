import React, { Suspense, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit3, Trash2, Upload } from 'lucide-react';
import { ResourceToolbar } from '../components/ResourceToolbar';
import { BulkActionBar } from '../components/BulkActionBar';
import { ResourceCardView } from '../components/ResourceCardView';
import { ResourceListView } from '../components/ResourceListView';
import { DetailModal } from '@/components/DetailModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExportButton } from '@/components/ExportButton';
import { FilterPanel } from '@/components/FilterPanel';
import { ApprovalWorkflow } from '@/components/ApprovalWorkflow';
import { StatusTimeline } from '@/components/StatusTimeline';
import { Pagination } from '@/components/Pagination';
import { DocumentActions } from '@/components/DocumentActions';
import { DocumentComments } from '@/components/DocumentComments';
import { ImportDialog } from '@/components/ImportDialog';
import { SmartGrid } from '@/components/smart-grid';
import type { ViewMode, ColumnState } from '@/components/smart-grid';
import { useUserViews, useSaveView, useUpdateView } from '@/domains/system/hooks/useUserViews';
import type { UserViewConfig } from '@/domains/system/hooks/useUserViews';
const BarcodeScanner = React.lazy(() => import('@/components/BarcodeScanner'));
import { toast } from '@/components/Toaster';

import { getResourceConfig } from '@/config/resourceColumns';
import type { StatusHistoryEntry } from '@nit-scs-v2/shared/types';
import type { ListParams } from '@/api/types';
import {
  useGrnList,
  useMiList,
  useMrnList,
  useShipments,
  useInventory,
  useJobOrders,
  useQciList,
  useDrList,
  useProjects,
  useEmployees,
  useSuppliers,
  useFleet,
  useGatePasses,
  useStockTransfers,
  useCustomsClearances,
  useWarehouses,
  useGenerators,
} from '@/api/hooks';
import {
  useDeleteProject,
  useDeleteEmployee,
  useDeleteSupplier,
  useDeleteWarehouse,
  useDeleteFleetItem,
  useDeleteGenerator,
  useDeleteInventoryItem,
  useBulkActions,
  useExecuteBulkAction,
} from '@/api/hooks';

// ── Loading Skeleton ───────────────────────────────────────────────────────

const TableSkeleton: React.FC<{ cols: number }> = ({ cols }) => (
  <div className="glass-card rounded-2xl overflow-hidden animate-pulse">
    <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between">
      <div className="h-9 w-64 bg-white/10 rounded-lg"></div>
      <div className="h-9 w-24 bg-white/10 rounded-lg"></div>
    </div>
    <div className="divide-y divide-white/5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 flex-1 bg-white/5 rounded"></div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

// ── Hook selector based on resource param ──────────────────────────────────

interface AnyQueryResult {
  data: { data?: unknown[]; meta?: { total: number; totalPages: number } } | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

function useResourceData(resource: string | undefined, params: ListParams): AnyQueryResult {
  const mrrv = useGrnList(resource === 'mrrv' ? params : undefined);
  const mirv = useMiList(resource === 'mirv' ? params : undefined);
  const mrv = useMrnList(resource === 'mrv' ? params : undefined);
  const shipments = useShipments(resource === 'shipments' || resource === 'reports' ? params : undefined);
  const inventory = useInventory(resource === 'inventory' ? params : undefined);
  const jobOrders = useJobOrders(resource === 'job-orders' ? params : undefined);
  const rfim = useQciList(resource === 'rfim' ? params : undefined);
  const osd = useDrList(resource === 'osd' ? params : undefined);
  const projects = useProjects(resource === 'projects' ? params : undefined);
  const employees = useEmployees(resource === 'employees' ? params : undefined);
  const suppliers = useSuppliers(resource === 'suppliers' ? params : undefined);
  const fleet = useFleet(resource === 'fleet' ? params : undefined);
  const gatePasses = useGatePasses(resource === 'gate-pass' ? params : undefined);
  const stockTransfers = useStockTransfers(resource === 'stock-transfer' ? params : undefined);
  const customs = useCustomsClearances(resource === 'customs' ? params : undefined);
  const warehouses = useWarehouses(resource === 'warehouses' ? params : undefined);
  const generators = useGenerators(resource === 'generators' ? params : undefined);

  const hookMap: Record<string, AnyQueryResult> = {
    mrrv,
    mirv,
    mrv,
    shipments,
    inventory,
    'job-orders': jobOrders,
    rfim,
    osd,
    projects,
    employees,
    suppliers,
    fleet,
    'gate-pass': gatePasses,
    'stock-transfer': stockTransfers,
    customs,
    warehouses,
    generators,
    reports: shipments,
  };

  return hookMap[resource || ''] || { data: undefined, isLoading: false, isError: false, error: null };
}

// ── Resource classification ──────────────────────────────────────────────

const MASTER_DATA_RESOURCES = new Set([
  'projects',
  'employees',
  'suppliers',
  'warehouses',
  'fleet',
  'generators',
  'inventory',
]);

const IMPORTABLE_RESOURCES = new Set([
  'projects',
  'employees',
  'suppliers',
  'warehouses',
  'inventory',
  'regions',
  'cities',
  'uoms',
]);

const SCANNABLE_RESOURCES = new Set(['inventory', 'items']);

const DOCUMENT_RESOURCES = new Set([
  'mrrv',
  'mirv',
  'mrv',
  'job-orders',
  'rfim',
  'osd',
  'gate-pass',
  'stock-transfer',
  'shipments',
]);

// ── Form link mapping ────────────────────────────────────────────────────

const FORM_LINKS: Record<string, string> = {
  mrrv: '/admin/forms/mrrv',
  mirv: '/admin/forms/mirv',
  mrv: '/admin/forms/mrv',
  'job-orders': '/admin/forms/jo',
  rfim: '/admin/forms/rfim',
  osd: '/admin/forms/osd',
  'gate-pass': '/admin/forms/gatepass',
  'stock-transfer': '/admin/forms/stock-transfer',
  shipments: '/admin/forms/shipment',
  customs: '/admin/forms/customs',
};

// ── Filter configs ───────────────────────────────────────────────────────

function getFilterConfigs(resource: string | undefined) {
  const statusOptions = ['Draft', 'Pending', 'Approved', 'Completed', 'Rejected', 'In Progress', 'Active', 'Issued'];
  switch (resource) {
    case 'mrrv':
      return [
        {
          key: 'status',
          label: 'Status',
          type: 'select' as const,
          options: ['Draft', 'Approved', 'Inspected', 'Pending QC'],
        },
        { key: 'supplier', label: 'Supplier', type: 'text' as const },
        {
          key: 'warehouse',
          label: 'Warehouse',
          type: 'select' as const,
          options: [
            'Dammam Warehouse',
            'Riyadh Warehouse',
            'Tabuk Warehouse',
            'Jeddah Warehouse',
            'Madinah Warehouse',
            'Makkah Warehouse',
          ],
        },
        { key: 'date', label: 'Date', type: 'dateRange' as const },
      ];
    case 'mirv':
      return [
        {
          key: 'status',
          label: 'Status',
          type: 'select' as const,
          options: ['Draft', 'Pending Approval', 'Approved', 'Issued'],
        },
        { key: 'project', label: 'Project', type: 'text' as const },
        {
          key: 'warehouse',
          label: 'Warehouse',
          type: 'select' as const,
          options: ['Dammam Warehouse', 'Riyadh Warehouse', 'Tabuk Warehouse', 'Jeddah Warehouse', 'Madinah Warehouse'],
        },
      ];
    case 'job-orders':
      return [
        {
          key: 'status',
          label: 'Status',
          type: 'select' as const,
          options: ['New', 'Assigning', 'In Progress', 'Completed'],
        },
        {
          key: 'type',
          label: 'Type',
          type: 'select' as const,
          options: [
            'Transport',
            'Equipment',
            'Generator_Rental',
            'Generator_Maintenance',
            'Rental_Daily',
            'Rental_Monthly',
            'Scrap',
          ],
        },
        { key: 'project', label: 'Project', type: 'text' as const },
        { key: 'slaStatus', label: 'SLA', type: 'select' as const, options: ['On Track', 'At Risk', 'Overdue'] },
      ];
    case 'inventory':
      return [
        {
          key: 'stockStatus',
          label: 'Stock Status',
          type: 'select' as const,
          options: ['In Stock', 'Low Stock', 'Out of Stock'],
        },
        { key: 'warehouse', label: 'Warehouse', type: 'text' as const },
        { key: 'category', label: 'Category', type: 'text' as const },
      ];
    case 'shipments':
      return [
        {
          key: 'status',
          label: 'Status',
          type: 'select' as const,
          options: ['New', 'In Transit', 'Customs Clearance', 'Delivered'],
        },
        { key: 'port', label: 'Port', type: 'text' as const },
      ];
    case 'gate-pass':
      return [
        { key: 'type', label: 'Type', type: 'select' as const, options: ['Inbound', 'Outbound'] },
        { key: 'status', label: 'Status', type: 'select' as const, options: ['Active', 'Completed'] },
      ];
    case 'fleet':
      return [
        { key: 'status', label: 'Status', type: 'select' as const, options: ['Active', 'Available', 'Maintenance'] },
        { key: 'category', label: 'Category', type: 'select' as const, options: ['Heavy Equipment', 'Vehicle'] },
      ];
    default:
      return [{ key: 'status', label: 'Status', type: 'select' as const, options: statusOptions }];
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export const AdminResourceList: React.FC = () => {
  const { resource } = useParams<{ section: string; resource: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [columnState, setColumnState] = useState<ColumnState[] | undefined>(undefined);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [importOpen, setImportOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const pageSize = 20;

  // ── User View Persistence ─────────────────────────────────────────────────
  const viewsQuery = useUserViews(resource);
  const saveViewMutation = useSaveView();
  const updateViewMutation = useUpdateView();

  // Load default view on mount
  React.useEffect(() => {
    const views = (
      viewsQuery.data as { data?: Array<{ id: string; isDefault: boolean; viewType: string; config: UserViewConfig }> }
    )?.data;
    if (!views || views.length === 0) return;
    const defaultView = views.find(v => v.isDefault) ?? views[0];
    if (defaultView && !activeViewId) {
      setActiveViewId(defaultView.id);
      if (defaultView.config?.viewMode) setViewMode(defaultView.config.viewMode as ViewMode);
      if (defaultView.config?.columnState) setColumnState(defaultView.config.columnState as ColumnState[]);
    }
  }, [viewsQuery.data, activeViewId]);

  const handleSaveView = useCallback(() => {
    if (!resource) return;
    const config: UserViewConfig = { viewMode, columnState: columnState as unknown[] | undefined };

    if (activeViewId) {
      updateViewMutation.mutate({ id: activeViewId, entityType: resource, config });
    } else {
      saveViewMutation.mutate(
        { entityType: resource, name: 'Default', config, isDefault: true },
        {
          onSuccess: resp => {
            setActiveViewId((resp as { data?: { id: string } }).data?.id ?? null);
          },
        },
      );
    }
  }, [resource, viewMode, columnState, activeViewId, updateViewMutation, saveViewMutation]);

  const handleColumnStateChanged = useCallback((state: ColumnState[]) => {
    setColumnState(state);
  }, []);

  const isMasterData = MASTER_DATA_RESOURCES.has(resource || '');
  const isDocument = DOCUMENT_RESOURCES.has(resource || '');
  const formLink = FORM_LINKS[resource || ''] || '#';
  const config = getResourceConfig(resource);
  const filterConfigs = useMemo(() => getFilterConfigs(resource), [resource]);

  // Delete hooks
  const deleteProject = useDeleteProject();
  const deleteEmployee = useDeleteEmployee();
  const deleteSupplier = useDeleteSupplier();
  const deleteWarehouse = useDeleteWarehouse();
  const deleteFleetItem = useDeleteFleetItem();
  const deleteGenerator = useDeleteGenerator();
  const deleteInventoryItem = useDeleteInventoryItem();

  const deleteMutation = useMemo(() => {
    const map: Record<string, typeof deleteProject> = {
      projects: deleteProject,
      employees: deleteEmployee,
      suppliers: deleteSupplier,
      warehouses: deleteWarehouse,
      fleet: deleteFleetItem,
      generators: deleteGenerator,
      inventory: deleteInventoryItem,
    };
    return map[resource || ''] || null;
  }, [
    resource,
    deleteProject,
    deleteEmployee,
    deleteSupplier,
    deleteWarehouse,
    deleteFleetItem,
    deleteGenerator,
    deleteInventoryItem,
  ]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget || !deleteMutation) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Item deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err: unknown) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err as Error)?.message ||
          'Unknown error';
        if (
          message.toLowerCase().includes('foreign') ||
          message.toLowerCase().includes('reference') ||
          message.toLowerCase().includes('constraint')
        ) {
          toast.error('Cannot delete', 'This item is referenced by other records.');
        } else {
          toast.error('Failed to delete item', message);
        }
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteMutation]);

  const apiParams: ListParams = useMemo(
    () => ({
      page: currentPage,
      pageSize,
      search: searchTerm || undefined,
      sortBy: sortKey || undefined,
      sortDir: sortKey ? sortDir : undefined,
      ...Object.fromEntries(Object.entries(filterValues).filter(([, v]) => v !== undefined && v !== '')),
    }),
    [currentPage, searchTerm, sortKey, sortDir, filterValues],
  );

  const query = useResourceData(resource, apiParams);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Extract data
  const apiData = (query.data?.data ?? []) as Record<string, unknown>[];
  const apiMeta = query.data?.meta;
  const totalFromApi = apiMeta?.total ?? apiData.length;
  const totalPages = apiMeta?.totalPages ?? Math.max(1, Math.ceil(totalFromApi / pageSize));

  // Bulk actions
  const COMMENT_TYPE_MAP: Record<string, string> = { 'job-orders': 'job-order', shipments: 'shipment' };
  const bulkDocType = isDocument && resource ? (COMMENT_TYPE_MAP[resource] ?? resource) : undefined;
  const bulkActionsQuery = useBulkActions(bulkDocType);
  const executeBulk = useExecuteBulkAction();
  const availableBulkActions = (bulkActionsQuery.data as { data?: { actions: string[] } })?.data?.actions ?? [];

  const allPageIds = useMemo(() => apiData.map(r => r.id as string).filter(Boolean), [apiData]);
  const allSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allPageIds));
    }
  }, [allSelected, allPageIds]);

  const handleBulkExecute = useCallback(async () => {
    if (!bulkDocType || !bulkAction || selectedIds.size === 0) return;
    try {
      const result = await executeBulk.mutateAsync({
        documentType: bulkDocType,
        ids: Array.from(selectedIds),
        action: bulkAction,
      });
      const data = (result as { data?: { succeeded: number; failed: number } })?.data;
      if (data) {
        if (data.failed === 0) {
          toast.success(`Bulk ${bulkAction}`, `${data.succeeded} documents processed successfully`);
        } else {
          toast.warning(`Bulk ${bulkAction}`, `${data.succeeded} succeeded, ${data.failed} failed`);
        }
      }
      setSelectedIds(new Set());
      setBulkAction('');
    } catch (err) {
      toast.error('Bulk action failed', (err as Error)?.message || 'Unknown error');
    }
  }, [bulkDocType, bulkAction, selectedIds, executeBulk]);

  // Clear selection when page/resource changes
  React.useEffect(() => {
    setSelectedIds(new Set());
    setBulkAction('');
  }, [currentPage, resource]);

  // Detail modal data
  const selectedRowDetails = useMemo(() => {
    if (!selectedRow) return null;
    const row = selectedRow;

    let approvalChain = null;
    if ((resource === 'mirv' || resource === 'job-orders') && row.value) {
      const amount = (row.value as number) || (row.materialPriceSar as number) || 0;
      const isApproved = row.status === 'Approved' || row.status === 'Issued' || row.status === 'Completed';
      const isPending =
        row.status === 'Pending Approval' ||
        row.status === 'Draft' ||
        row.status === 'New' ||
        row.status === 'Assigning';
      const levels =
        amount < 10000
          ? [{ label: 'Storekeeper', level: 1 }]
          : amount < 50000
            ? [
                { label: 'Storekeeper', level: 1 },
                { label: 'Logistics Mgr', level: 2 },
              ]
            : [
                { label: 'Storekeeper', level: 1 },
                { label: 'Logistics Mgr', level: 2 },
                { label: 'Dept. Head', level: 3 },
              ];
      approvalChain = {
        documentId: row.id as string,
        documentType: resource?.toUpperCase() || '',
        currentLevel: isApproved ? levels.length : isPending ? 1 : 0,
        totalLevels: levels.length,
        totalAmount: amount,
        status: (isApproved ? 'approved' : 'pending') as 'pending' | 'approved' | 'rejected',
        createdAt: (row.date as string) || new Date().toISOString(),
        steps: levels.map((l, i) => ({
          id: `step-${i}`,
          level: l.level,
          label: l.label,
          status: (isApproved || (isPending && i < levels.length - 1)
            ? 'approved'
            : isPending && i === levels.length - 1
              ? 'current'
              : 'pending') as 'approved' | 'current' | 'pending',
          approverName: isApproved ? 'Auto' : undefined,
          timestamp: isApproved ? (row.date as string) : undefined,
        })),
      };
    }

    const statusHistory: StatusHistoryEntry[] = [
      {
        id: 'sh-1',
        status: 'Draft',
        timestamp: row.date
          ? new Date(new Date(row.date as string).getTime() - 86400000).toISOString()
          : new Date().toISOString(),
        userId: 'system',
        userName: 'System',
        action: 'Document created',
      },
      ...(row.status && row.status !== 'Draft'
        ? [
            {
              id: 'sh-2',
              status: row.status as string,
              timestamp: (row.date as string) || new Date().toISOString(),
              userId: '1',
              userName: 'Abdulrahman',
              action:
                row.status === 'Approved'
                  ? 'Approved by manager'
                  : row.status === 'Completed'
                    ? 'Marked as complete'
                    : `Status changed to ${row.status}`,
            },
          ]
        : []),
    ];
    return { approvalChain, statusHistory };
  }, [selectedRow, resource]);

  // ── Render helpers ─────────────────────────────────────────────────────

  const renderCellValue = (col: (typeof config.columns)[number], row: Record<string, unknown>) => {
    if (col.component) return col.component(row[col.key]);
    if (col.format) return col.format(row[col.key]);
    return (row[col.key] as string) || '-';
  };

  const renderActions = (row: Record<string, unknown>, size: number, inCard = false) => (
    <div
      className={`flex items-center ${inCard ? 'gap-2' : 'justify-end gap-2 opacity-0 group-hover:opacity-100'} transition-opacity`}
    >
      <button
        onClick={e => {
          e.stopPropagation();
          setSelectedRow(row);
        }}
        className={`p-1.5 rounded-lg hover:bg-white/10 text-nesma-secondary ${inCard ? '' : 'hover:text-white'} transition-colors`}
        title="View"
        aria-label={`View ${(row.name as string) || (row.id as string) || 'record'}`}
      >
        <Eye size={size} />
      </button>

      {formLink !== '#' && !!row.id && (
        <button
          onClick={e => {
            e.stopPropagation();
            navigate(`${formLink}/${row.id as string}`);
          }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="Edit"
          aria-label={`Edit ${(row.name as string) || (row.id as string) || 'record'}`}
        >
          <Edit3 size={size} />
        </button>
      )}
      {isMasterData && !!row.id && (
        <button
          onClick={e => {
            e.stopPropagation();
            setDeleteTarget({
              id: row.id as string,
              label:
                (row.name as string) ||
                (row.assetId as string) ||
                (row.plateNumber as string) ||
                (row.code as string) ||
                (row.id as string),
            });
          }}
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
          title="Delete"
          aria-label={`Delete ${(row.name as string) || (row.id as string) || 'record'}`}
        >
          <Trash2 size={size} />
        </button>
      )}
      {isDocument && resource && <DocumentActions resource={resource} row={row} />}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">{config.title}</h1>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
            <span className="bg-nesma-primary/20 text-nesma-secondary px-2 py-0.5 rounded text-xs border border-nesma-primary/30">
              {config.code}
            </span>
            Manage and track all {config.title.toLowerCase()}
          </p>
        </div>
        <div className="flex gap-3">
          <ExportButton data={apiData} columns={config.columns} filename={config.code} />
          {IMPORTABLE_RESOURCES.has(resource || '') && (
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-white/20 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-all"
            >
              <Upload size={16} />
              <span>Import</span>
            </button>
          )}
          {formLink !== '#' && (
            <button
              onClick={() => navigate(formLink)}
              className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-lg hover:bg-nesma-accent text-sm shadow-lg shadow-nesma-primary/20 transition-all transform hover:-translate-y-0.5"
            >
              <Plus size={16} />
              <span>Add New</span>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {query.isError && (
        <div className="glass-card p-6 rounded-xl border border-red-500/20 bg-red-500/5">
          <p className="text-sm text-red-400">Failed to load data. Please try again.</p>
          <p className="text-xs text-gray-400 mt-1">{(query.error as Error)?.message}</p>
        </div>
      )}

      {query.isLoading ? (
        <TableSkeleton cols={config.columns.length} />
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <ResourceToolbar
            searchTerm={searchTerm}
            onSearchChange={v => {
              setSearchTerm(v);
              setCurrentPage(1);
            }}
            title={config.title}
            filterValues={filterValues}
            onFilterClick={() => setFilterOpen(true)}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onSaveView={handleSaveView}
            isSaveLoading={saveViewMutation.isPending || updateViewMutation.isPending}
            canScan={SCANNABLE_RESOURCES.has(resource || '')}
            onScan={() => setScannerOpen(true)}
          />

          {isDocument && someSelected && (
            <BulkActionBar
              selectedCount={selectedIds.size}
              onClear={() => {
                setSelectedIds(new Set());
                setBulkAction('');
              }}
              availableActions={availableBulkActions}
              bulkAction={bulkAction}
              onBulkActionChange={setBulkAction}
              onExecute={handleBulkExecute}
              isExecuting={executeBulk.isPending}
            />
          )}

          {viewMode === 'card' ? (
            <ResourceCardView
              data={apiData}
              columns={config.columns}
              onRowClick={setSelectedRow}
              renderCellValue={renderCellValue}
              renderActions={renderActions}
            />
          ) : viewMode === 'grid' ? (
            /* AG Grid View */
            <div className="px-2">
              <SmartGrid
                columns={config.columns}
                rowData={apiData}
                loading={query.isLoading}
                isDocument={isDocument}
                selectedIds={selectedIds}
                initialColumnState={columnState}
                onColumnStateChanged={handleColumnStateChanged}
                onSortChanged={(key, dir) => {
                  setSortKey(key);
                  setSortDir(dir);
                }}
                onRowClicked={setSelectedRow}
              />
            </div>
          ) : (
            <ResourceListView
              data={apiData}
              columns={config.columns}
              isDocument={isDocument}
              selectedIds={selectedIds}
              allSelected={allSelected}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              renderCellValue={renderCellValue}
              renderActions={renderActions}
            />
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalFromApi}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <FilterPanel
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filterConfigs}
        values={filterValues}
        onChange={(key, value) => setFilterValues(prev => ({ ...prev, [key]: value }))}
        onApply={() => setCurrentPage(1)}
        onClear={() => {
          setFilterValues({});
          setCurrentPage(1);
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Record"
        message={`Are you sure you want to delete "${deleteTarget?.label}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation?.isPending ?? false}
      />

      {IMPORTABLE_RESOURCES.has(resource || '') && (
        <ImportDialog
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          entity={resource || ''}
          entityLabel={config.title}
        />
      )}

      {SCANNABLE_RESOURCES.has(resource || '') && (
        <Suspense fallback={null}>
          <BarcodeScanner
            isOpen={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onItemFound={item => {
              setScannerOpen(false);
              const code = String(item.itemCode || item.code || '');
              if (code) {
                setSearchTerm(code);
                setCurrentPage(1);
              }
            }}
          />
        </Suspense>
      )}

      <DetailModal
        isOpen={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title={(selectedRow?.id as string) || (selectedRow?.name as string) || 'Details'}
        subtitle={`${config.code} Record`}
        actions={[
          { label: 'Close', onClick: () => setSelectedRow(null), variant: 'secondary' },

          ...(formLink !== '#' && !!selectedRow?.id
            ? [
                {
                  label: 'Edit',
                  onClick: () => {
                    const id = selectedRow.id as string;
                    setSelectedRow(null);
                    navigate(`${formLink}/${id}`);
                  },
                  variant: 'primary' as const,
                },
              ]
            : []),
        ]}
      >
        {selectedRow && (
          <div className="space-y-6">
            <div className="space-y-1">
              {config.columns.map((col, idx) => (
                <div key={idx} className="flex justify-between items-start py-3 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-400 font-medium">{col.label}</span>
                  <span className="text-sm text-white text-right max-w-[60%]">
                    {col.component
                      ? col.component(selectedRow[col.key])
                      : col.format
                        ? col.format(selectedRow[col.key])
                        : (selectedRow[col.key] as string) || '\u2014'}
                  </span>
                </div>
              ))}
            </div>
            {selectedRowDetails?.approvalChain && <ApprovalWorkflow chain={selectedRowDetails.approvalChain} />}
            {selectedRowDetails?.statusHistory && selectedRowDetails.statusHistory.length > 0 && (
              <StatusTimeline history={selectedRowDetails.statusHistory} />
            )}
            {/* Document comments panel */}
            {isDocument && typeof selectedRow?.id === 'string' && resource ? (
              <DocumentComments
                documentType={
                  resource === 'job-orders' ? 'job-order' : resource === 'shipments' ? 'shipment' : resource
                }
                documentId={selectedRow.id}
                defaultCollapsed
              />
            ) : null}
          </div>
        )}
      </DetailModal>
    </div>
  );
};
