import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Workflows ───────────────────────────────────────────────────────────

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/workflows');
      return data;
    },
  });
}

export function useWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/workflows/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/workflows', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/workflows/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workflows/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useActivateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/workflows/${id}/activate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useDeactivateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/workflows/${id}/deactivate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

// ── Rules ───────────────────────────────────────────────────────────────

export function useWorkflowRules(workflowId: string | undefined) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'rules'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>(`/workflows/${workflowId}/rules`);
      return data;
    },
    enabled: !!workflowId,
  });
}

export function useWorkflowRule(workflowId: string | undefined, ruleId: string | undefined) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'rules', ruleId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/workflows/${workflowId}/rules/${ruleId}`);
      return data;
    },
    enabled: !!workflowId && !!ruleId,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowId, ...body }: Record<string, unknown> & { workflowId: string }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/workflows/${workflowId}/rules`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowId, id, ...body }: Record<string, unknown> & { workflowId: string; id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/workflows/${workflowId}/rules/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowId, id }: { workflowId: string; id: string }) => {
      await apiClient.delete(`/workflows/${workflowId}/rules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useTestRule() {
  return useMutation({
    mutationFn: async ({
      workflowId,
      id,
      event,
    }: {
      workflowId: string;
      id: string;
      event: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/workflows/${workflowId}/rules/${id}/test`, {
        event,
      });
      return data;
    },
  });
}

export function useRuleLogs(
  workflowId: string | undefined,
  ruleId: string | undefined,
  params?: { page?: number; pageSize?: number },
) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'rules', ruleId, 'logs', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>(`/workflows/${workflowId}/rules/${ruleId}/logs`, {
        params,
      });
      return data;
    },
    enabled: !!workflowId && !!ruleId,
  });
}
