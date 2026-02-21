import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { StockTransfer } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useWtList(params?: ListParams) {
  return useQuery({
    queryKey: ['wt', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StockTransfer[]>>('/wt', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useWt(id: string | undefined) {
  return useQuery({
    queryKey: ['wt', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StockTransfer>>(`/wt/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<StockTransfer>) => {
      const { data } = await apiClient.post<ApiResponse<StockTransfer>>('/wt', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<StockTransfer> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<StockTransfer>>(`/wt/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StockTransfer>>(`/wt/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}

export function useApproveWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StockTransfer>>(`/wt/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}

export function useShipWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StockTransfer>>(`/wt/${id}/ship`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wt'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useReceiveWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StockTransfer>>(`/wt/${id}/receive`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wt'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCompleteWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StockTransfer>>(`/wt/${id}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wt'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCancelWt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StockTransfer>>(`/wt/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wt'] }),
  });
}
