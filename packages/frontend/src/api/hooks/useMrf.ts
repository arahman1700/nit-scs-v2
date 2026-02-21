import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { MaterialRequisition } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useMrfList(params?: ListParams) {
  return useQuery({
    queryKey: ['mrf', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MaterialRequisition[]>>('/mrf', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useMrf(id: string | undefined) {
  return useQuery({
    queryKey: ['mrf', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MaterialRequisition>>(`/mrf/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<MaterialRequisition>) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>('/mrf', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<MaterialRequisition> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<MaterialRequisition>>(`/mrf/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mrf/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useReviewMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<MaterialRequisition> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mrf/${id}/review`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useApproveMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mrf/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useCheckStockMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mrf/${id}/check-stock`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useConvertMirvMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mrf/${id}/convert-mirv`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mrf'] });
      qc.invalidateQueries({ queryKey: ['mirv'] });
    },
  });
}

export function useFulfillMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mrf/${id}/fulfill`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useRejectMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mrf/${id}/reject`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}

export function useCancelMrf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mrf/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mrf'] }),
  });
}
