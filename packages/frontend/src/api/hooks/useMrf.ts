import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useMrfList(params?: ListParams) {
  return useQuery({
    queryKey: ['mrf', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/mrf', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useMrf(id: string | undefined) {
  return useQuery({
    queryKey: ['mrf', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/mrf/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/mrf', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/mrf/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrf/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useReviewMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrf/${id}/review`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useApproveMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrf/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useCheckStockMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrf/${id}/check-stock`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useConvertMirvMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrf/${id}/convert-mirv`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mrf'] });
      qc.invalidateQueries({ queryKey: ['mirv'] });
    },
  });
}

export function useFulfillMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrf/${id}/fulfill`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useRejectMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrf/${id}/reject`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useCancelMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mrf/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}
