import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { TransportOrder } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useTransportOrderList(params?: ListParams) {
  return useQuery({
    queryKey: ['transport-orders', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TransportOrder[]>>('/transport-orders', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useTransportOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['transport-orders', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TransportOrder>>(`/transport-orders/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateTransportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<TransportOrder>>('/transport-orders', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-orders'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateTransportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<TransportOrder>>(`/transport-orders/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-orders'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useScheduleTransportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<TransportOrder>>(`/transport-orders/${id}/schedule`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-orders'] }),
  });
}

export function useDispatchTransportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<TransportOrder>>(`/transport-orders/${id}/dispatch`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-orders'] }),
  });
}

export function useDeliverTransportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<TransportOrder>>(`/transport-orders/${id}/deliver`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-orders'] }),
  });
}

export function useCancelTransportOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<TransportOrder>>(`/transport-orders/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport-orders'] }),
  });
}
