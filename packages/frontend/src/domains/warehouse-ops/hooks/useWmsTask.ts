import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WmsTask {
  id: string;
  taskNumber: string;
  warehouseId: string;
  taskType: 'putaway' | 'pick' | 'replenish' | 'move' | 'count' | 'pack' | 'load' | 'unload';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  assignedToId: string | null;
  sourceDocType: string | null;
  sourceDocId: string | null;
  fromZoneId: string | null;
  fromBin: string | null;
  toZoneId: string | null;
  toBin: string | null;
  itemId: string | null;
  lpnId: string | null;
  quantity: number | null;
  completedQuantity: number | null;
  startedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  assignedTo?: { id: string; name: string; employeeCode: string };
  item?: { id: string; itemCode: string; itemDescription: string; category: string };
}

export interface WmsTaskFilters extends ListParams {
  warehouseId?: string;
  taskType?: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
}

// ── List ────────────────────────────────────────────────────────────────────
export function useWmsTaskList(params?: WmsTaskFilters) {
  return useQuery({
    queryKey: ['wms-tasks', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<WmsTask[]>>('/warehouse-ops/wms-tasks', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useWmsTask(id: string | undefined) {
  return useQuery({
    queryKey: ['wms-tasks', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<WmsTask>>(`/warehouse-ops/wms-tasks/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateWmsTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<WmsTask>>('/warehouse-ops/wms-tasks', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-tasks'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateWmsTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<WmsTask>>(`/warehouse-ops/wms-tasks/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-tasks'] }),
  });
}

// ── Assign ──────────────────────────────────────────────────────────────────
export function useAssignWmsTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignedToId }: { id: string; assignedToId: string }) => {
      const { data } = await apiClient.post<ApiResponse<WmsTask>>(`/warehouse-ops/wms-tasks/${id}/assign`, {
        assignedToId,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-tasks'] }),
  });
}

// ── Start ───────────────────────────────────────────────────────────────────
export function useStartWmsTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<WmsTask>>(`/warehouse-ops/wms-tasks/${id}/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-tasks'] }),
  });
}

// ── Complete ────────────────────────────────────────────────────────────────
export function useCompleteWmsTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completedQuantity }: { id: string; completedQuantity?: number }) => {
      const { data } = await apiClient.post<ApiResponse<WmsTask>>(`/warehouse-ops/wms-tasks/${id}/complete`, {
        completedQuantity,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-tasks'] }),
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────
export function useCancelWmsTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<WmsTask>>(`/warehouse-ops/wms-tasks/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-tasks'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteWmsTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/warehouse-ops/wms-tasks/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-tasks'] }),
  });
}
