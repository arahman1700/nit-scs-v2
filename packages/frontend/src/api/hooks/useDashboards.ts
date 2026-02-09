// ============================================================================
// Dashboard Builder React Query Hooks
// CRUD for custom dashboards + widget management
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  widgetType: string;
  title: string;
  dataSource: string;
  displayConfig: Record<string, unknown>;
  position: number;
  width: number;
  height: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardInput {
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateDashboardInput {
  id: string;
  name?: string;
  description?: string;
  isDefault?: boolean;
}

export interface AddWidgetInput {
  dashboardId: string;
  widgetType: string;
  title: string;
  dataSource: string;
  displayConfig?: Record<string, unknown>;
  position?: number;
  width?: number;
  height?: number;
}

export interface UpdateWidgetInput {
  dashboardId: string;
  widgetId: string;
  title?: string;
  dataSource?: string;
  displayConfig?: Record<string, unknown>;
  width?: number;
  height?: number;
}

export interface LayoutUpdate {
  dashboardId: string;
  layout: { widgetId: string; position: number; width: number; height: number }[];
}

// ── List ────────────────────────────────────────────────────────────────────
export function useDashboards() {
  return useQuery({
    queryKey: ['dashboards'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Dashboard[]>>('/dashboards');
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useDashboard(id: string | undefined) {
  return useQuery({
    queryKey: ['dashboards', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Dashboard>>(`/dashboards/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateDashboardInput) => {
      const { data } = await apiClient.post<ApiResponse<Dashboard>>('/dashboards', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateDashboardInput) => {
      const { data } = await apiClient.put<ApiResponse<Dashboard>>(`/dashboards/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<void>>(`/dashboards/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
  });
}

// ── Add Widget ──────────────────────────────────────────────────────────────
export function useAddWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dashboardId, ...body }: AddWidgetInput) => {
      const { data } = await apiClient.post<ApiResponse<DashboardWidget>>(`/dashboards/${dashboardId}/widgets`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
  });
}

// ── Update Widget ───────────────────────────────────────────────────────────
export function useUpdateWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dashboardId, widgetId, ...body }: UpdateWidgetInput) => {
      const { data } = await apiClient.put<ApiResponse<DashboardWidget>>(
        `/dashboards/${dashboardId}/widgets/${widgetId}`,
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
  });
}

// ── Delete Widget ───────────────────────────────────────────────────────────
export function useDeleteWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dashboardId, widgetId }: { dashboardId: string; widgetId: string }) => {
      const { data } = await apiClient.delete<ApiResponse<void>>(`/dashboards/${dashboardId}/widgets/${widgetId}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
  });
}

// ── Update Layout (batch widget positions) ──────────────────────────────────
export function useUpdateLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dashboardId, layout }: LayoutUpdate) => {
      const { data } = await apiClient.put<ApiResponse<void>>(`/dashboards/${dashboardId}/layout`, { layout });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
  });
}
