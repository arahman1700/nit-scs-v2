import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { GatePass } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useGatePassList(params?: ListParams) {
  return useQuery({
    queryKey: ['gate-passes', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<GatePass[]>>('/gate-passes', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useGatePass(id: string | undefined) {
  return useQuery({
    queryKey: ['gate-passes', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<GatePass>>(`/gate-passes/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateGatePass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<GatePass>>('/gate-passes', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate-passes'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateGatePass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<GatePass>>(`/gate-passes/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate-passes'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitGatePass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<GatePass>>(`/gate-passes/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate-passes'] }),
  });
}

export function useApproveGatePass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<GatePass>>(`/gate-passes/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate-passes'] }),
  });
}

export function useReleaseGatePass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<GatePass>>(`/gate-passes/${id}/release`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate-passes'] }),
  });
}

export function useReturnGatePass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<GatePass>>(`/gate-passes/${id}/return`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate-passes'] }),
  });
}

export function useCancelGatePass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<GatePass>>(`/gate-passes/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gate-passes'] }),
  });
}
