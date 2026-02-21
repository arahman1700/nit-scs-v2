import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { MIRV } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useMiList(params?: ListParams) {
  return useQuery({
    queryKey: ['mi', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MIRV[]>>('/mi', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useMi(id: string | undefined) {
  return useQuery({
    queryKey: ['mi', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MIRV>>(`/mi/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateMi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<MIRV>) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>('/mi', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mi'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateMi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<MIRV> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<MIRV>>(`/mi/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mi'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitMi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>(`/mi/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mi'] }),
  });
}

export function useApproveMi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>(`/mi/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mi'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useIssueMi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>(`/mi/${id}/issue`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mi'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['gate-passes'] });
    },
  });
}

export function useCancelMi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>(`/mi/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mi'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
