import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/api/types';
import type { EmailTemplate, EmailLog, EMPTY_TEMPLATE } from './notificationHelpers';

export function useEmailTemplates(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['email-templates', page, pageSize],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<EmailTemplate[]>>('/email-templates', {
        params: { page, pageSize },
      });
      return data;
    },
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: typeof EMPTY_TEMPLATE) => {
      const { data } = await apiClient.post<ApiResponse<EmailTemplate>>('/email-templates', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<EmailTemplate> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<EmailTemplate>>(`/email-templates/${id}`, body);
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

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: async ({ id, variables }: { id: string; variables: Record<string, string> }) => {
      const { data } = await apiClient.post<ApiResponse<{ subject: string; bodyHtml: string }>>(
        `/email-templates/${id}/preview`,
        { variables },
      );
      return data;
    },
  });
}

export function useEmailLogs(params: { page: number; pageSize: number; status?: string; toEmail?: string }) {
  return useQuery({
    queryKey: ['email-logs', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<EmailLog[]>>('/email-logs', {
        params,
      });
      return data;
    },
  });
}
