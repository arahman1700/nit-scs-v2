import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useScrapList(params?: ListParams) {
  return useQuery({
    queryKey: ['scrap', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/scrap', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useScrap(id: string | undefined) {
  return useQuery({
    queryKey: ['scrap', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/scrap/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/scrap', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/scrap/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useReportScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/report`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

export function useApproveScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

export function useSendToSscScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/send-to-ssc`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

export function useMarkSoldScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/mark-sold`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

export function useDisposeScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/dispose`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

export function useCloseScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/close`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

// ── Role-based Approvals ────────────────────────────────────────────────────
export function useApproveBySiteManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/approve-site-manager`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

export function useApproveByQc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/approve-qc`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}

export function useApproveByStorekeeper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/scrap/${id}/approve-storekeeper`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrap'] }),
  });
}
