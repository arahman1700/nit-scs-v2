import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TariffRate {
  id: string;
  hsCode: string;
  description: string;
  dutyRate: number;
  vatRate: number;
  exemptionCode: string | null;
  exemptionDescription: string | null;
  country: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LineBreakdown {
  shipmentLineId: string;
  description: string;
  hsCode: string | null;
  lineValue: number;
  dutyRate: number;
  vatRate: number;
  dutyAmount: number;
  vatAmount: number;
  totalAmount: number;
  exemptionCode: string | null;
  tariffRateId: string | null;
}

export interface DutyCalculationResult {
  shipmentId: string;
  shipmentNumber: string;
  lineBreakdown: LineBreakdown[];
  totalDuties: number;
  totalVat: number;
  grandTotal: number;
}

// ── List ────────────────────────────────────────────────────────────────────

export function useTariffRateList(params?: ListParams) {
  return useQuery({
    queryKey: ['tariff-rates', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TariffRate[]>>('/tariffs/tariff-rates', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function useTariffRate(id: string | undefined) {
  return useQuery({
    queryKey: ['tariff-rates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TariffRate>>(`/tariffs/tariff-rates/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateTariffRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<TariffRate>>('/tariffs/tariff-rates', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tariff-rates'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────

export function useUpdateTariffRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<TariffRate>>(`/tariffs/tariff-rates/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tariff-rates'] }),
  });
}

// ── Calculate Duties (preview, no persist) ──────────────────────────────────

export function useCalculateDuties(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['tariff-rates', 'calculate', shipmentId],
    queryFn: async () => {
      const { data } = await apiClient.post<ApiResponse<DutyCalculationResult>>(
        `/tariffs/tariff-rates/calculate/${shipmentId}`,
      );
      return data;
    },
    enabled: false, // manual trigger only
  });
}

// ── Apply Duties (persist to shipment) ──────────────────────────────────────

export function useApplyDuties() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const { data } = await apiClient.post<ApiResponse<DutyCalculationResult>>(
        `/tariffs/tariff-rates/apply/${shipmentId}`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tariff-rates'] });
      qc.invalidateQueries({ queryKey: ['shipments'] });
    },
  });
}
