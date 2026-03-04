import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ────────────────────────────────────────────────────────────────

interface CustomsDocument {
  id: string;
  shipmentId: string;
  documentType: string;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
  filePath: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  shipment?: { id: string; shipmentNumber: string; status: string };
  verifiedBy?: { id: string; fullName: string; email?: string } | null;
}

interface DocumentCompleteness {
  shipmentId: string;
  total: number;
  verified: number;
  pending: number;
  received: number;
  rejected: number;
  isComplete: boolean;
  requiredDocuments: {
    type: string;
    label: string;
    present: boolean;
    status: string | null;
  }[];
}

interface CustomsDocListParams {
  shipmentId: string;
  page?: number;
  pageSize?: number;
  status?: string;
  documentType?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ── List by shipment ────────────────────────────────────────────────────

export function useCustomsDocumentList(params: CustomsDocListParams) {
  return useQuery({
    queryKey: ['customs-documents', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CustomsDocument[]>>('/customs-documents', { params });
      return data;
    },
    enabled: !!params.shipmentId,
  });
}

// ── Detail ──────────────────────────────────────────────────────────────

export function useCustomsDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['customs-documents', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CustomsDocument>>(`/customs-documents/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────

export function useCreateCustomsDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<CustomsDocument>>('/customs-documents', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customs-documents'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────

export function useUpdateCustomsDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<CustomsDocument>>(`/customs-documents/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customs-documents'] }),
  });
}

// ── Verify ──────────────────────────────────────────────────────────────

export function useVerifyCustomsDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<CustomsDocument>>(`/customs-documents/${id}/verify`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customs-documents'] }),
  });
}

// ── Reject ──────────────────────────────────────────────────────────────

export function useRejectCustomsDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<CustomsDocument>>(`/customs-documents/${id}/reject`, {
        reason,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customs-documents'] }),
  });
}

// ── Document Completeness ───────────────────────────────────────────────

export function useDocumentCompleteness(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['customs-documents', 'completeness', shipmentId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DocumentCompleteness>>(
        `/customs-documents/completeness/${shipmentId}`,
      );
      return data;
    },
    enabled: !!shipmentId,
  });
}
