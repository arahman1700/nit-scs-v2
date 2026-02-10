import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useToolList(params?: ListParams) {
  return useQuery({
    queryKey: ['tools', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/tools', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useTool(id: string | undefined) {
  return useQuery({
    queryKey: ['tools', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/tools/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/tools', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/tools/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tools/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }),
  });
}

// ── Workflow: Decommission ───────────────────────────────────────────────
export function useDecommissionTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/tools/${id}/decommission`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }),
  });
}
