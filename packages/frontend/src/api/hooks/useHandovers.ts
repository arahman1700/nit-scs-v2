import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { StorekeeperHandover } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useHandoverList(params?: ListParams) {
  return useQuery({
    queryKey: ['handovers', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StorekeeperHandover[]>>('/handovers', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useHandover(id: string | undefined) {
  return useQuery({
    queryKey: ['handovers', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StorekeeperHandover>>(`/handovers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<StorekeeperHandover>>('/handovers', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handovers'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<StorekeeperHandover>>(`/handovers/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handovers'] }),
  });
}

// ── Workflow: Start Verification ──────────────────────────────────────────
export function useStartHandoverVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StorekeeperHandover>>(`/handovers/${id}/start-verification`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handovers'] }),
  });
}

// ── Workflow: Complete Handover ──────────────────────────────────────────
export function useCompleteHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StorekeeperHandover>>(`/handovers/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handovers'] }),
  });
}
