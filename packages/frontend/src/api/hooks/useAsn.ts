import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────
export function useAsnList(params?: ListParams & { status?: string; supplierId?: string; warehouseId?: string }) {
  return useQuery({
    queryKey: ['asn', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/asn', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────
export function useAsn(id: string | undefined) {
  return useQuery({
    queryKey: ['asn', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/asn/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────
export function useCreateAsn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/asn', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asn'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────
export function useUpdateAsn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/asn/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asn'] }),
  });
}

// ── Mark In Transit ─────────────────────────────────────────────────────
export function useMarkInTransit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/asn/${id}/in-transit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asn'] }),
  });
}

// ── Mark Arrived ────────────────────────────────────────────────────────
export function useMarkArrived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/asn/${id}/arrived`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asn'] }),
  });
}

// ── Receive ASN ─────────────────────────────────────────────────────────
export function useReceiveAsn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/asn/${id}/receive`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asn'] });
      qc.invalidateQueries({ queryKey: ['grn'] });
    },
  });
}

// ── Cancel ASN ──────────────────────────────────────────────────────────
export function useCancelAsn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<unknown>>(`/asn/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asn'] }),
  });
}

// ── Variance Report ─────────────────────────────────────────────────────
export function useAsnVariance(id: string | undefined) {
  return useQuery({
    queryKey: ['asn', id, 'variance'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/asn/${id}/variance`);
      return data;
    },
    enabled: !!id,
  });
}
