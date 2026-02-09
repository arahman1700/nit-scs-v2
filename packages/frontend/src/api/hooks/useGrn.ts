import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useGrnList(params?: ListParams) {
  return useQuery({
    queryKey: ['grn', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/grn', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useGrn(id: string | undefined) {
  return useQuery({
    queryKey: ['grn', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/grn/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/grn', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/grn/${id}`, body);
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
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/grn/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

export function useApproveQcGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/grn/${id}/approve-qc`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

export function useReceiveGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/grn/${id}/receive`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn'] }),
  });
}

export function useStoreGrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/grn/${id}/store`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
