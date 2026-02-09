import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useWtList(params?: ListParams) {
  return useQuery({
    queryKey: ['wt', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/wt', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useWt(id: string | undefined) {
  return useQuery({
    queryKey: ['wt', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/wt/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/wt', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/wt/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/wt/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}

export function useApproveWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/wt/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}

export function useShipWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/wt/${id}/ship`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wt'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useReceiveWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/wt/${id}/receive`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wt'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCompleteWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/wt/${id}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wt'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCancelWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/wt/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}
