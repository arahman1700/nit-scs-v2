import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CarrierService {
  id: string;
  carrierName: string;
  carrierCode: string;
  serviceType: 'road' | 'sea' | 'air' | 'rail' | 'courier' | 'multimodal';
  status: 'active' | 'inactive' | 'suspended' | 'pending_review';
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  country: string | null;
  licenseNumber: string | null;
  insuranceExpiry: string | null;
  rating: number | null;
  onTimeDeliveryPct: number | null;
  damageRatePct: number | null;
  avgTransitDays: number | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  rates?: CarrierRate[];
}

export interface CarrierRate {
  id: string;
  carrierId: string;
  originRegion: string;
  destinationRegion: string;
  serviceLevel: 'standard' | 'express' | 'economy';
  ratePerKg: number | null;
  ratePerCbm: number | null;
  flatRate: number | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  minWeight: number | null;
  maxWeight: number | null;
}

export interface CarrierFilters extends ListParams {
  serviceType?: string;
  status?: string;
  country?: string;
}

// ── List ────────────────────────────────────────────────────────────────────
export function useCarrierList(params?: CarrierFilters) {
  return useQuery({
    queryKey: ['carriers', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CarrierService[]>>('/logistics/carriers', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useCarrier(id: string | undefined) {
  return useQuery({
    queryKey: ['carriers', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CarrierService>>(`/logistics/carriers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<CarrierService>>('/logistics/carriers', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<CarrierService>>(`/logistics/carriers/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

// ── Suspend ─────────────────────────────────────────────────────────────────
export function useSuspendCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<CarrierService>>(`/logistics/carriers/${id}/suspend`, {
        reason,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

// ── Activate ────────────────────────────────────────────────────────────────
export function useActivateCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<CarrierService>>(`/logistics/carriers/${id}/activate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteCarrier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/logistics/carriers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

// ── Carrier Rates ───────────────────────────────────────────────────────────
export function useCarrierRates(carrierId: string | undefined) {
  return useQuery({
    queryKey: ['carriers', 'rates', carrierId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CarrierRate[]>>(`/logistics/carriers/${carrierId}/rates`);
      return data;
    },
    enabled: !!carrierId,
  });
}

export function useCreateCarrierRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ carrierId, ...body }: Record<string, unknown> & { carrierId: string }) => {
      const { data } = await apiClient.post<ApiResponse<CarrierRate>>(`/logistics/carriers/${carrierId}/rates`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

export function useUpdateCarrierRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      carrierId,
      rateId,
      ...body
    }: Record<string, unknown> & { carrierId: string; rateId: string }) => {
      const { data } = await apiClient.put<ApiResponse<CarrierRate>>(
        `/logistics/carriers/${carrierId}/rates/${rateId}`,
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  });
}

export function useDeleteCarrierRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ carrierId, rateId }: { carrierId: string; rateId: string }) => {
      await apiClient.delete(`/logistics/carriers/${carrierId}/rates/${rateId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  });
}
