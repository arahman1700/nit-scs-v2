import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useDrList(params?: ListParams) {
  return useQuery({
    queryKey: ['dr', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/dr', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useDr(id: string | undefined) {
  return useQuery({
    queryKey: ['dr', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/dr/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateDr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/dr', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dr'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateDr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/dr/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dr'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSendClaimDr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/dr/${id}/send-claim`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dr'] }),
  });
}

export function useResolveDr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/dr/${id}/resolve`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dr'] }),
  });
}
