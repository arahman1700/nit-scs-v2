import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useImsfList(params?: ListParams) {
  return useQuery({
    queryKey: ['imsf', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/imsf', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useImsf(id: string | undefined) {
  return useQuery({
    queryKey: ['imsf', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/imsf/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateImsf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/imsf', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imsf'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateImsf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/imsf/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imsf'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSendImsf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/imsf/${id}/send`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imsf'] }),
  });
}

export function useConfirmImsf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/imsf/${id}/confirm`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imsf'] }),
  });
}

export function useShipImsf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/imsf/${id}/ship`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imsf'] }),
  });
}

export function useDeliverImsf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/imsf/${id}/deliver`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imsf'] }),
  });
}

export function useCompleteImsf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/imsf/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imsf'] }),
  });
}
