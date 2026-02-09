import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useRentalContractList(params?: ListParams) {
  return useQuery({
    queryKey: ['rental-contracts', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/rental-contracts', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useRentalContract(id: string | undefined) {
  return useQuery({
    queryKey: ['rental-contracts', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/rental-contracts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateRentalContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/rental-contracts', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rental-contracts'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateRentalContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/rental-contracts/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rental-contracts'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitRentalContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/rental-contracts/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rental-contracts'] }),
  });
}

export function useApproveRentalContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/rental-contracts/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rental-contracts'] }),
  });
}

export function useActivateRentalContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/rental-contracts/${id}/activate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rental-contracts'] }),
  });
}

export function useExtendRentalContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/rental-contracts/${id}/extend`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rental-contracts'] }),
  });
}

export function useTerminateRentalContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/rental-contracts/${id}/terminate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rental-contracts'] }),
  });
}
