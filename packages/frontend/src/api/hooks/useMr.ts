import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useMrList(params?: ListParams) {
  return useQuery({
    queryKey: ['mr', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/mr', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useMr(id: string | undefined) {
  return useQuery({
    queryKey: ['mr', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/mr/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/mr', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/mr/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mr/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useReviewMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mr/${id}/review`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useApproveMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mr/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useCheckStockMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mr/${id}/check-stock`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useConvertMiMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mr/${id}/convert-mi`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mr'] });
      qc.invalidateQueries({ queryKey: ['mi'] });
    },
  });
}

export function useFulfillMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mr/${id}/fulfill`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useRejectMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mr/${id}/reject`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useCancelMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/mr/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}
