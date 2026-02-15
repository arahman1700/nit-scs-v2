import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  source: string;
  template: {
    workflow: { name: string; entityType: string };
    rules: Array<{
      name: string;
      triggerEvent: string;
      conditions: unknown;
      actions: unknown[];
    }>;
  };
  installCount: number;
  createdAt: string;
}

// ── List ────────────────────────────────────────────────────────────────

export function useWorkflowTemplateList(category?: string) {
  return useQuery({
    queryKey: ['workflow-templates', 'list', category],
    queryFn: async () => {
      const params = category ? { category } : undefined;
      const { data } = await apiClient.get<ApiResponse<WorkflowTemplate[]>>('/workflow-templates', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────

export function useWorkflowTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['workflow-templates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<WorkflowTemplate>>(`/workflow-templates/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Install (creates workflow + rules from template) ────────────────────

export function useInstallWorkflowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await apiClient.post<ApiResponse<{ workflowId: string }>>(
        `/workflow-templates/${templateId}/install`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow-templates'] });
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
