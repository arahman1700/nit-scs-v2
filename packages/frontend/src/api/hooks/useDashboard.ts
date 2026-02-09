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
