import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ParallelApprovalResponse {
  id: string;
  approverId: string;
  decision: 'approved' | 'rejected';
  comments: string | null;
  decidedAt: string;
  approver: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

export interface ParallelApprovalGroup {
  id: string;
  documentType: string;
  documentId: string;
  approvalLevel: number;
  mode: 'all' | 'any';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  completedAt: string | null;
  responses: ParallelApprovalResponse[];
}

// ── Queries ────────────────────────────────────────────────────────────────

/** GET /parallel-approvals?documentType=X&documentId=Y — Groups for a document */
export function useDocumentApprovalGroups(documentType: string | undefined, documentId: string | undefined) {
  return useQuery({
    queryKey: ['parallel-approvals', documentType, documentId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ParallelApprovalGroup[]>>('/parallel-approvals', {
        params: { documentType, documentId },
      });
      return data;
    },
    enabled: !!documentType && !!documentId,
  });
}

/** GET /parallel-approvals/pending — Pending for current user */
export function usePendingApprovals() {
  return useQuery({
    queryKey: ['parallel-approvals', 'pending'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ParallelApprovalGroup[]>>('/parallel-approvals/pending');
      return data;
    },
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** POST /parallel-approvals — Create parallel approval group */
export function useCreateParallelApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      documentType: string;
      documentId: string;
      level: number;
      mode: 'all' | 'any';
      approverIds: string[];
    }) => {
      const { data } = await apiClient.post<ApiResponse<ParallelApprovalGroup>>('/parallel-approvals', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parallel-approvals'] });
    },
  });
}

/** POST /parallel-approvals/:groupId/respond — Submit decision */
export function useRespondToApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      decision,
      comments,
    }: {
      groupId: string;
      decision: 'approved' | 'rejected';
      comments?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<ParallelApprovalGroup>>(
        `/parallel-approvals/${groupId}/respond`,
        { decision, comments },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parallel-approvals'] });
    },
  });
}
