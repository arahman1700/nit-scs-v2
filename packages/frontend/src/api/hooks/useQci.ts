import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { RFIM } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useQciList(params?: ListParams) {
  return useQuery({
    queryKey: ['qci', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RFIM[]>>('/qci', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useQci(id: string | undefined) {
  return useQuery({
    queryKey: ['qci', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RFIM>>(`/qci/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateQci() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<RFIM> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<RFIM>>(`/qci/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qci'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useStartQci() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<RFIM>>(`/qci/${id}/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qci'] }),
  });
}

export function useCompleteQci() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<RFIM> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<RFIM>>(`/qci/${id}/complete`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qci'] });
      qc.invalidateQueries({ queryKey: ['grn'] });
    },
  });
}
