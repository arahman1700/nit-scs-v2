import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { JobOrder } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useJobOrderList(params?: ListParams) {
  return useQuery({
    queryKey: ['job-orders', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<JobOrder[]>>('/job-orders', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useJobOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['job-orders', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<JobOrder>>(`/job-orders/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<JobOrder>) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>('/job-orders', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<JobOrder> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<JobOrder>>(`/job-orders/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useSubmitJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/submit`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useApproveJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useRejectJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/reject`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useAssignJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; assigneeId?: string; vehicle?: string; driver?: string }) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/assign`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useStartJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useHoldJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/hold`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useResumeJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/resume`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useCompleteJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useInvoiceJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; invoiceAmount?: number; invoiceRef?: string }) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/invoice`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}

export function useCancelJobOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<JobOrder>>(`/job-orders/${id}/cancel`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-orders'] }),
  });
}
