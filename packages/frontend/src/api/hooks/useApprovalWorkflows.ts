import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

export interface ApprovalWorkflow {
  id: string;
  documentType: string;
  minAmount: number;
  maxAmount: number | null;
  approverRole: string;
  slaHours: number;
}

/** GET /api/v1/approvals/workflows */
export function useApprovalWorkflows() {
  return useQuery({
    queryKey: ['approval-workflows'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ApprovalWorkflow[]>>('/v1/approvals/workflows');
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** GET /api/v1/approvals/workflows/:documentType */
export function useApprovalWorkflowsByType(documentType: string) {
  return useQuery({
    queryKey: ['approval-workflows', documentType],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ApprovalWorkflow[]>>(`/v1/approvals/workflows/${documentType}`);
      return data;
    },
    enabled: !!documentType,
    staleTime: 5 * 60_000,
  });
}

/** POST /api/v1/approvals/workflows */
export function useCreateApprovalWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Omit<ApprovalWorkflow, 'id'>) => {
      const { data } = await apiClient.post<ApiResponse<ApprovalWorkflow>>('/v1/approvals/workflows', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-workflows'] }),
  });
}

/** PUT /api/v1/approvals/workflows/:id */
export function useUpdateApprovalWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<ApprovalWorkflow> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<ApprovalWorkflow>>(`/v1/approvals/workflows/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-workflows'] }),
  });
}

/** DELETE /api/v1/approvals/workflows/:id */
export function useDeleteApprovalWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<unknown>>(`/v1/approvals/workflows/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-workflows'] }),
  });
}

/** GET /api/v1/approvals/chain/:documentType/:amount — preview the chain for a given amount */
export function useApprovalChainPreview(documentType: string, amount: number) {
  return useQuery({
    queryKey: ['approval-chain', documentType, amount],
    queryFn: async () => {
      const { data } = await apiClient.get<
        ApiResponse<{ steps: Array<{ level: number; approverRole: string; slaHours: number }> }>
      >(`/v1/approvals/chain/${documentType}/${amount}`);
      return data;
    },
    enabled: !!documentType && amount > 0,
    staleTime: 60_000,
  });
}
