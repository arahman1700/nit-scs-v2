import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

const BASE = '/vehicle-maintenance';
const KEY = 'vehicle-maintenance';

// ── List ────────────────────────────────────────────────────────────────────
export function useVehicleMaintenanceList(params?: ListParams) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>(BASE, { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useVehicleMaintenance(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`${BASE}/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateVehicleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(BASE, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateVehicleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`${BASE}/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ── Complete ────────────────────────────────────────────────────────────────
export function useCompleteVehicleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; workPerformed: string; partsUsed?: string; cost?: number }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`${BASE}/${id}/complete`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────
export function useCancelVehicleMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`${BASE}/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
