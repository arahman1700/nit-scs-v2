import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { MaterialRequisition } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useMrList(params?: ListParams) {
  return useQuery({
    queryKey: ['mr', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MaterialRequisition[]>>('/mr', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useMr(id: string | undefined) {
  return useQuery({
    queryKey: ['mr', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MaterialRequisition>>(`/mr/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<MaterialRequisition>) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>('/mr', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<MaterialRequisition> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<MaterialRequisition>>(`/mr/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useReviewMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<MaterialRequisition> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/review`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useApproveMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useCheckStockMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/check-stock`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useConvertMiMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/convert-mi`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mr'] });
      qc.invalidateQueries({ queryKey: ['mi'] });
    },
  });
}

export function useConvertMrToImsf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, receiverProjectId }: { id: string; receiverProjectId: string }) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/convert-to-imsf`, {
        receiverProjectId,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mr'] });
      qc.invalidateQueries({ queryKey: ['imsf'] });
    },
  });
}

export function useFulfillMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/fulfill`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useRejectMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/reject`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}

export function useCancelMr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<MaterialRequisition>>(`/mr/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mr'] }),
  });
}
