// ============================================================================
// Dashboard React Query Hooks
// Fetches dashboard stats, activity, inventory summary, etc.
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DashboardStats {
  pendingRequests: number;
  activeJobs: number;
  incomingShipments: number;
  lowStockItems: number;
}

export interface RecentActivity {
  id: string;
  time: string;
  action: string;
  user: string;
  details: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

export interface InventorySummary {
  totalItems: number;
  totalQty: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  byCategory: { name: string; value: number }[];
}

export interface DocumentCounts {
  mrrv: { total: number; pending: number };
  mirv: { total: number; pending: number };
  jo: { total: number; inProgress: number };
  shipments: { total: number; inTransit: number };
}

export interface SLACompliance {
  onTrack: number;
  atRisk: number;
  overdue: number;
  compliancePct: number;
}

export interface TopProject {
  id: string;
  name: string;
  client: string;
  activeJobs: number;
  pendingMirv: number;
}

export interface CrossDepartmentData {
  inventory: {
    totalInventoryValue: number;
    lowStockAlerts: number;
    blockedLots: number;
    warehouses: {
      warehouseId: string;
      warehouseName: string;
      warehouseCode: string;
      itemCount: number;
      totalQty: number;
      totalValue: number;
    }[];
  };
  documentPipeline: Record<string, { total: number; byStatus: Record<string, number> }>;
  recentActivity: {
    id: string;
    tableName: string;
    action: string;
    performedAt: string;
    performedBy: { fullName: string } | null;
  }[];
}

import type { ApiResponse } from '../types';

// ── Hooks ──────────────────────────────────────────────────────────────────

/** GET /api/dashboard/stats */
export function useDashboardStats(params?: { project?: string; timeRange?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'stats', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DashboardStats>>('/dashboard/stats', { params });
      return data;
    },
    staleTime: 30_000,
  });
}

/** GET /api/dashboard/recent-activity */
export function useRecentActivity(params?: { project?: string; limit?: number }) {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RecentActivity[]>>('/dashboard/recent-activity', { params });
      return data;
    },
    staleTime: 15_000,
  });
}

/** GET /api/dashboard/inventory-summary */
export function useInventorySummary(params?: { project?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'inventory-summary', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<InventorySummary>>('/dashboard/inventory-summary', { params });
      return data;
    },
    staleTime: 60_000,
  });
}

/** GET /api/dashboard/document-counts */
export function useDocumentCounts(params?: { project?: string; timeRange?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'document-counts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DocumentCounts>>('/dashboard/document-counts', { params });
      return data;
    },
    staleTime: 30_000,
  });
}

/** GET /api/dashboard/sla-compliance */
export function useSLACompliance(params?: { project?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'sla-compliance', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SLACompliance>>('/dashboard/sla-compliance', { params });
      return data;
    },
    staleTime: 30_000,
  });
}

/** GET /api/dashboard/top-projects */
export function useTopProjects(params?: { limit?: number }) {
  return useQuery({
    queryKey: ['dashboard', 'top-projects', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TopProject[]>>('/dashboard/top-projects', { params });
      return data;
    },
    staleTime: 60_000,
  });
}

/** GET /api/dashboard/cross-department */
export function useCrossDepartment() {
  return useQuery({
    queryKey: ['dashboard', 'cross-department'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CrossDepartmentData>>('/dashboard/cross-department');
      return data;
    },
    staleTime: 30_000,
  });
}

// ── Exception Dashboard Types & Hook ────────────────────────────────────

export interface ExceptionData {
  overdueApprovals: { count: number; items: { type: string; id: string; status: string; created_at: string }[] };
  slaBreaches: { count: number; items: { id: string; documentNumber: string; slaDueDate: string; status: string }[] };
  lowStock: {
    count: number;
    items: {
      item_id: string;
      item_code: string;
      item_name: string;
      qty_on_hand: number;
      min_level: number;
      warehouse_name: string;
    }[];
  };
  stalledDocuments: { count: number; items: { type: string; id: string; status: string; updated_at: string }[] };
  expiringInventory: {
    count: number;
    items: { id: string; expiryDate: string; item: { itemCode: string; itemName: string } }[];
  };
  totalExceptions: number;
}

/** GET /api/dashboard/exceptions */
export function useExceptions() {
  return useQuery({
    queryKey: ['dashboard', 'exceptions'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ExceptionData>>('/dashboard/exceptions');
      return data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
