import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { MIRV } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useMirvList(params?: ListParams) {
  return useQuery({
    queryKey: ['mirv', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MIRV[]>>('/mirv', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useMirv(id: string | undefined) {
  return useQuery({
    queryKey: ['mirv', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MIRV>>(`/mirv/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateMirv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<MIRV>) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>('/mirv', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mirv'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateMirv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<MIRV> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<MIRV>>(`/mirv/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mirv'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitMirv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>(`/mirv/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mirv'] }),
  });
}

export function useApproveMirv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>(`/mirv/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mirv'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useIssueMirv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>(`/mirv/${id}/issue`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mirv'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['gate-passes'] });
    },
  });
}

export function useCancelMirv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MIRV>>(`/mirv/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mirv'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
