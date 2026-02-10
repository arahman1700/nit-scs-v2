import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useBinCardList(params?: ListParams) {
  return useQuery({
    queryKey: ['bin-cards', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/bin-cards', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useBinCard(id: string | undefined) {
  return useQuery({
    queryKey: ['bin-cards', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/bin-cards/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateBinCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/bin-cards', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bin-cards'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateBinCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/bin-cards/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bin-cards'] }),
  });
}

// ── Transactions ────────────────────────────────────────────────────────────
export function useBinCardTransactionList(params?: ListParams) {
  return useQuery({
    queryKey: ['bin-card-transactions', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/bin-cards/transactions', { params });
      return data;
    },
  });
}

export function useCreateBinCardTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/bin-cards/transactions', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bin-cards'] });
      qc.invalidateQueries({ queryKey: ['bin-card-transactions'] });
    },
  });
}
