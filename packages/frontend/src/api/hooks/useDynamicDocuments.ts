import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────

export interface DynamicDocument {
  id: string;
  documentTypeId: string;
  documentNumber: string;
  status: string;
  data: Record<string, unknown>;
  projectId?: string;
  warehouseId?: string;
  createdById?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  documentType?: { code: string; name: string; fields: unknown[] };
  project?: { projectCode: string; projectName: string };
  warehouse?: { warehouseCode: string; warehouseName: string };
  createdBy?: { fullName: string };
  updatedBy?: { fullName: string };
  lines?: Array<{ id: string; lineNumber: number; data: Record<string, unknown> }>;
  history?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    performedAt: string;
    comment?: string;
    performedBy?: { fullName: string };
  }>;
}

// ── List ────────────────────────────────────────────────────────────────

export function useDynamicDocumentList(typeCode: string, params?: ListParams) {
  return useQuery({
    queryKey: ['dynamic-docs', typeCode, 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DynamicDocument[]>>(`/dynamic/${typeCode}`, { params });
      return data;
    },
    enabled: !!typeCode,
  });
}

// ── Detail ──────────────────────────────────────────────────────────────

export function useDynamicDocument(typeCode: string, id: string | undefined) {
  return useQuery({
    queryKey: ['dynamic-docs', typeCode, id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DynamicDocument>>(`/dynamic/${typeCode}/${id}`);
      return data;
    },
    enabled: !!typeCode && !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────

export function useCreateDynamicDocument(typeCode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      data: Record<string, unknown>;
      lines?: Array<Record<string, unknown>>;
      projectId?: string;
      warehouseId?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<DynamicDocument>>(`/dynamic/${typeCode}`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-docs', typeCode] });
    },
  });
}

// ── Update ──────────────────────────────────────────────────────────────

export function useUpdateDynamicDocument(typeCode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      data?: Record<string, unknown>;
      lines?: Array<Record<string, unknown>>;
      projectId?: string;
      warehouseId?: string;
    }) => {
      const { data } = await apiClient.put<ApiResponse<DynamicDocument>>(`/dynamic/${typeCode}/${id}`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-docs', typeCode] });
    },
  });
}

// ── Transition ──────────────────────────────────────────────────────────

export function useTransitionDynamicDocument(typeCode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, targetStatus, comment }: { id: string; targetStatus: string; comment?: string }) => {
      const { data } = await apiClient.post<ApiResponse<DynamicDocument>>(`/dynamic/${typeCode}/${id}/transition`, {
        targetStatus,
        comment,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-docs', typeCode] });
    },
  });
}

// ── History ─────────────────────────────────────────────────────────────

export function useDynamicDocumentHistory(typeCode: string, id: string | undefined) {
  return useQuery({
    queryKey: ['dynamic-docs', typeCode, id, 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DynamicDocument['history']>>(
        `/dynamic/${typeCode}/${id}/history`,
      );
      return data;
    },
    enabled: !!typeCode && !!id,
  });
}
