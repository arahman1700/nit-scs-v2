import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface LicensePlate {
  id: string;
  lpnNumber: string;
  warehouseId: string;
  zoneId: string | null;
  binLocation: string | null;
  status: 'open' | 'closed' | 'in_transit' | 'damaged' | 'destroyed';
  lpnType: 'pallet' | 'case' | 'tote' | 'container';
  parentLpnId: string | null;
  weight: number | null;
  volume: number | null;
  createdById: string | null;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  zone?: { id: string; zoneName: string; zoneCode: string };
  contents?: LpnContent[];
}

export interface LpnContent {
  id: string;
  lpnId: string;
  itemId: string;
  quantity: number;
  lotNumber: string | null;
  serialNumber: string | null;
  expiryDate: string | null;
  item?: { id: string; itemCode: string; itemDescription: string; category: string };
}

// ── List ────────────────────────────────────────────────────────────────────
export function useLpnList(params?: ListParams) {
  return useQuery({
    queryKey: ['lpns', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<LicensePlate[]>>('/warehouse-ops/lpns', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useLpn(id: string | undefined) {
  return useQuery({
    queryKey: ['lpns', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<LicensePlate>>(`/warehouse-ops/lpns/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateLpn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<LicensePlate>>('/warehouse-ops/lpns', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lpns'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateLpn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<LicensePlate>>(`/warehouse-ops/lpns/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lpns'] }),
  });
}

// ── Close LPN ───────────────────────────────────────────────────────────────
export function useCloseLpn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<LicensePlate>>(`/warehouse-ops/lpns/${id}/close`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lpns'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteLpn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/warehouse-ops/lpns/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lpns'] }),
  });
}
