import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useSurplusList(params?: ListParams) {
  return useQuery({
    queryKey: ['surplus', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/surplus', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useSurplus(id: string | undefined) {
  return useQuery({
    queryKey: ['surplus', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/surplus/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateSurplus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/surplus', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surplus'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateSurplus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/surplus/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surplus'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useEvaluateSurplus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/surplus/${id}/evaluate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surplus'] }),
  });
}

export function useApproveSurplus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/surplus/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surplus'] }),
  });
}

export function useActionSurplus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/surplus/${id}/action`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surplus'] }),
  });
}

export function useCloseSurplus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/surplus/${id}/close`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surplus'] }),
  });
}
