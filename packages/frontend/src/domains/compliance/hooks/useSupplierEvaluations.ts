import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SupplierEvaluationMetric {
  id: string;
  evaluationId: string;
  metricName: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  notes: string | null;
}

export interface SupplierEvaluation {
  id: string;
  evaluationNumber: string;
  supplierId: string;
  evaluatorId: string;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'completed';
  overallScore: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: string; supplierCode: string; supplierName: string; rating?: number; status?: string };
  evaluator?: { id: string; fullName: string; email?: string };
  metrics?: SupplierEvaluationMetric[];
  _count?: { metrics: number };
}

// ── List ────────────────────────────────────────────────────────────────────

export function useSupplierEvaluationList(params?: ListParams) {
  return useQuery({
    queryKey: ['supplier-evaluations', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SupplierEvaluation[]>>('/supplier-evaluations', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function useSupplierEvaluation(id: string | undefined) {
  return useQuery({
    queryKey: ['supplier-evaluations', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SupplierEvaluation>>(`/supplier-evaluations/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateSupplierEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<SupplierEvaluation>>('/supplier-evaluations', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-evaluations'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────

export function useUpdateSupplierEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<SupplierEvaluation>>(`/supplier-evaluations/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-evaluations'] }),
  });
}

// ── Complete (finalize) ─────────────────────────────────────────────────────

export function useCompleteSupplierEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<SupplierEvaluation>>(`/supplier-evaluations/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-evaluations'] }),
  });
}
