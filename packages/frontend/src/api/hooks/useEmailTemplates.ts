import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Email Templates ─────────────────────────────────────────────────────

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/email-templates');
      return data;
    },
  });
}

export function useEmailTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['email-templates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/email-templates/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/email-templates', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/email-templates/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/email-templates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

export function usePreviewEmailTemplate() {
  return useMutation({
    mutationFn: async ({ id, variables }: { id: string; variables: Record<string, unknown> }) => {
      const { data } = await apiClient.post<ApiResponse<{ subject: string; html: string }>>(
        `/email-templates/${id}/preview`,
        { variables },
      );
      return data;
    },
  });
}

// ── Email Logs ──────────────────────────────────────────────────────────

export function useEmailLogs(params?: { page?: number; pageSize?: number; status?: string; templateId?: string }) {
  return useQuery({
    queryKey: ['email-logs', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/email-logs', { params });
      return data;
    },
  });
}

export function useEmailLogStats() {
  return useQuery({
    queryKey: ['email-logs', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/email-logs/stats');
      return data;
    },
  });
}
