import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useShipmentList(params?: ListParams) {
  return useQuery({
    queryKey: ['shipments', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/shipments', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: ['shipments', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/shipments/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/shipments', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/shipments/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// ── Update Status ───────────────────────────────────────────────────────────
export function useUpdateShipmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/shipments/${id}/status`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// ── Customs Stage ───────────────────────────────────────────────────────────
export function useAddCustomsStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/shipments/${id}/customs`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

export function useUpdateCustomsStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, customsId, ...body }: Record<string, unknown> & { id: string; customsId: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/shipments/${id}/customs/${customsId}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// ── Deliver ─────────────────────────────────────────────────────────────────
export function useDeliverShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/shipments/${id}/deliver`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] });
      qc.invalidateQueries({ queryKey: ['mrrv'] });
    },
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────
export function useCancelShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/shipments/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}
