import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ThreePlContract {
  id: string;
  contractNumber: string;
  providerName: string;
  providerCode: string;
  serviceScope: 'warehousing' | 'transportation' | 'fulfillment' | 'customs' | 'full_service';
  status: 'draft' | 'active' | 'suspended' | 'expired' | 'terminated';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  renewalTermMonths: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  warehouseIds: string[];
  slaResponseHours: number | null;
  slaDamageThresholdPct: number | null;
  slaOnTimePct: number | null;
  penaltyPerIncident: number | null;
  currency: string;
  totalContractValue: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  charges?: ThreePlCharge[];
}

export interface ThreePlCharge {
  id: string;
  contractId: string;
  chargeType: 'storage' | 'handling' | 'pick_pack' | 'receiving' | 'shipping' | 'vas' | 'management_fee' | 'other';
  description: string;
  rateType: 'per_unit' | 'per_pallet' | 'per_sqm' | 'per_order' | 'per_hour' | 'flat_monthly' | 'percentage';
  rate: number;
  currency: string;
  minCharge: number | null;
  maxCharge: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contract?: { id: string; contractNumber: string; providerName: string };
}

export interface ThreePlContractFilters extends ListParams {
  status?: string;
  serviceScope?: string;
  providerName?: string;
}

export interface ThreePlChargeFilters extends ListParams {
  contractId?: string;
  chargeType?: string;
}

// ############################################################################
// 3PL CONTRACTS
// ############################################################################

// ── List ────────────────────────────────────────────────────────────────────
export function useThreePlContractList(params?: ThreePlContractFilters) {
  return useQuery({
    queryKey: ['3pl-contracts', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ThreePlContract[]>>('/logistics/3pl/contracts', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useThreePlContract(id: string | undefined) {
  return useQuery({
    queryKey: ['3pl-contracts', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ThreePlContract>>(`/logistics/3pl/contracts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateThreePlContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<ThreePlContract>>('/logistics/3pl/contracts', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['3pl-contracts'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateThreePlContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<ThreePlContract>>(`/logistics/3pl/contracts/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['3pl-contracts'] }),
  });
}

// ── Activate ────────────────────────────────────────────────────────────────
export function useActivateThreePlContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<ThreePlContract>>(`/logistics/3pl/contracts/${id}/activate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['3pl-contracts'] }),
  });
}

// ── Suspend ─────────────────────────────────────────────────────────────────
export function useSuspendThreePlContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<ThreePlContract>>(`/logistics/3pl/contracts/${id}/suspend`, {
        reason,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['3pl-contracts'] }),
  });
}

// ── Terminate ───────────────────────────────────────────────────────────────
export function useTerminateThreePlContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<ThreePlContract>>(`/logistics/3pl/contracts/${id}/terminate`, {
        reason,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['3pl-contracts'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteThreePlContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/logistics/3pl/contracts/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['3pl-contracts'] }),
  });
}

// ############################################################################
// 3PL CHARGES
// ############################################################################

// ── List ────────────────────────────────────────────────────────────────────
export function useThreePlChargeList(params?: ThreePlChargeFilters) {
  return useQuery({
    queryKey: ['3pl-charges', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ThreePlCharge[]>>('/logistics/3pl/charges', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useThreePlCharge(id: string | undefined) {
  return useQuery({
    queryKey: ['3pl-charges', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ThreePlCharge>>(`/logistics/3pl/charges/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateThreePlCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<ThreePlCharge>>('/logistics/3pl/charges', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['3pl-charges'] });
      qc.invalidateQueries({ queryKey: ['3pl-contracts'] });
    },
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateThreePlCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<ThreePlCharge>>(`/logistics/3pl/charges/${id}`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['3pl-charges'] });
      qc.invalidateQueries({ queryKey: ['3pl-contracts'] });
    },
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteThreePlCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/logistics/3pl/charges/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['3pl-charges'] });
      qc.invalidateQueries({ queryKey: ['3pl-contracts'] });
    },
  });
}
