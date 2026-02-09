import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useMrnList(params?: ListParams) {
  return useQuery({
    queryKey: ['mrn', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/mrn', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useMrn(id: string | undefined) {
  return useQuery({
    queryKey: ['mrn', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/mrn/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/mrn', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrn'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/mrn/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrn'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrn/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrn'] }),
  });
}

export function useReceiveMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrn/${id}/receive`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrn'] }),
  });
}

export function useCompleteMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrn/${id}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mrn'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
