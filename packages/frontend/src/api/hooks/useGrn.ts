import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { MRRV } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useGrnList(params?: ListParams) {
  return useQuery({
    queryKey: ['grn', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MRRV[]>>('/grn', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useGrn(id: string | undefined) {
  return useQuery({
    queryKey: ['grn', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MRRV>>(`/grn/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<MRRV>) => {
      const { data } = await apiClient.post<ApiResponse<MRRV>>('/grn', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<MRRV> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<MRRV>>(`/grn/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MRRV>>(`/grn/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

export function useApproveQcGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MRRV>>(`/grn/${id}/approve-qc`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

export function useReceiveGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MRRV>>(`/grn/${id}/receive`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

export function useStoreGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MRRV>>(`/grn/${id}/store`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
