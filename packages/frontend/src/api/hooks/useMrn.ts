import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { MRV } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useMrnList(params?: ListParams) {
  return useQuery({
    queryKey: ['mrn', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MRV[]>>('/mrn', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useMrn(id: string | undefined) {
  return useQuery({
    queryKey: ['mrn', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MRV>>(`/mrn/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<MRV>) => {
      const { data } = await apiClient.post<ApiResponse<MRV>>('/mrn', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrn'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<MRV> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<MRV>>(`/mrn/${id}`, body);
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
      const { data } = await apiClient.post<ApiResponse<MRV>>(`/mrn/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrn'] }),
  });
}

export function useReceiveMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MRV>>(`/mrn/${id}/receive`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrn'] }),
  });
}

export function useCompleteMrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MRV>>(`/mrn/${id}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mrn'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
