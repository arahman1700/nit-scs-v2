import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useAssetList(params?: ListParams) {
  return useQuery({
    queryKey: ['assets', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/assets', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useAsset(id: string | undefined) {
  return useQuery({
    queryKey: ['assets', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/assets/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Summary (dashboard stats) ───────────────────────────────────────────────
export function useAssetSummary() {
  return useQuery({
    queryKey: ['assets', 'summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>('/assets/summary');
      return data;
    },
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/assets', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/assets/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

// ── Transfer ────────────────────────────────────────────────────────────────
export function useTransferAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      toWarehouseId?: string;
      toEmployeeId?: string;
      reason?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/assets/${id}/transfer`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

// ── Retire ──────────────────────────────────────────────────────────────────
export function useRetireAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/assets/${id}/retire`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

// ── Dispose ─────────────────────────────────────────────────────────────────
export function useDisposeAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, disposalValue }: { id: string; disposalValue?: number }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/assets/${id}/dispose`, {
        disposalValue,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}
