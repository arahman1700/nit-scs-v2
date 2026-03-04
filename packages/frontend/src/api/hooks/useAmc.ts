import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Amc {
  id: string;
  contractNumber: string;
  supplierId: string;
  equipmentTypeId: string;
  startDate: string;
  endDate: string;
  contractValue: number;
  status: 'draft' | 'active' | 'expired' | 'terminated';
  coverageType: 'comprehensive' | 'parts_only' | 'labor_only';
  responseTimeSlaHours: number;
  preventiveMaintenanceFrequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  includesSpares: boolean;
  maxCallouts: number | null;
  notes: string | null;
  terminationReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: string; supplierName: string; supplierCode: string };
  equipmentType?: { id: string; typeName: string };
  createdBy?: { id: string; fullName: string };
}

// ── List ────────────────────────────────────────────────────────────────────

export function useAmcList(
  params?: ListParams & {
    supplierId?: string;
    equipmentTypeId?: string;
  },
) {
  return useQuery({
    queryKey: ['amc', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Amc[]>>('/amc', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function useAmc(id: string | undefined) {
  return useQuery({
    queryKey: ['amc', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Amc>>(`/amc/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<Amc>>('/amc', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────

export function useUpdateAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<Amc>>(`/amc/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc'] }),
  });
}

// ── Activate ────────────────────────────────────────────────────────────────

export function useActivateAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<Amc>>(`/amc/${id}/activate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc'] }),
  });
}

// ── Terminate ───────────────────────────────────────────────────────────────

export function useTerminateAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<Amc>>(`/amc/${id}/terminate`, { reason });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc'] }),
  });
}
