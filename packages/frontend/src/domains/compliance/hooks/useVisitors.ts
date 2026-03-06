import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';
import type { VisitorPass } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useVisitorList(
  params?: ListParams & {
    hostEmployeeId?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) {
  return useQuery({
    queryKey: ['visitors', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<VisitorPass[]>>('/visitors', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useVisitor(id: string | undefined) {
  return useQuery({
    queryKey: ['visitors', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<VisitorPass>>(`/visitors/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Register (Create) ──────────────────────────────────────────────────────
export function useRegisterVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<VisitorPass>>('/visitors', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<VisitorPass>>(`/visitors/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

// ── Check In ────────────────────────────────────────────────────────────────
export function useCheckInVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; badgeNumber?: string }) => {
      const { data } = await apiClient.post<ApiResponse<VisitorPass>>(`/visitors/${id}/check-in`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

// ── Check Out ───────────────────────────────────────────────────────────────
export function useCheckOutVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<VisitorPass>>(`/visitors/${id}/check-out`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────
export function useCancelVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<VisitorPass>>(`/visitors/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
}
