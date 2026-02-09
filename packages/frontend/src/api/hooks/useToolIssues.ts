import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useToolIssueList(params?: ListParams) {
  return useQuery({
    queryKey: ['tool-issues', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/tool-issues', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useToolIssue(id: string | undefined) {
  return useQuery({
    queryKey: ['tool-issues', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/tool-issues/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateToolIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/tool-issues', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tool-issues'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateToolIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/tool-issues/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tool-issues'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useReturnToolIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/tool-issues/${id}/return`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tool-issues'] }),
  });
}
