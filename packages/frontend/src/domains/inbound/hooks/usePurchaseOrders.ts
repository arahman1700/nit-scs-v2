import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

export interface PoReconciliationLine {
  poNumber: string;
  supplierCode: string;
  supplierName: string;
  itemCode: string;
  description: string | null;
  lineNumber: number;
  orderedQty: number;
  receivedQty: number;
  variance: number;
  status: 'fully_received' | 'partially_received' | 'not_received' | 'over_received';
  uom: string;
  unitPrice: number | null;
}

export interface PoMirror {
  id: string;
  poNumber: string;
  supplierCode: string;
  supplierName: string;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  totalAmount: number | null;
  currency: string;
  syncedAt: string;
  _count: { lines: number };
}

// ── List PO mirrors ──────────────────────────────────────────────────────

export function usePoMirrorList(params?: ListParams & { supplierCode?: string; status?: string }) {
  return useQuery({
    queryKey: ['purchase-orders', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PoMirror[]>>('/purchase-orders', { params });
      return data;
    },
  });
}

// ── PO detail ────────────────────────────────────────────────────────────

export function usePo(poNumber: string | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', poNumber],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/purchase-orders/${poNumber}`);
      return data;
    },
    enabled: !!poNumber,
  });
}

// ── PO reconciliation (all POs) ──────────────────────────────────────────

export function usePoReconciliation(
  params?: ListParams & { supplierCode?: string; status?: string; fromDate?: string; toDate?: string },
) {
  return useQuery({
    queryKey: ['purchase-orders', 'reconciliation', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PoReconciliationLine[]>>('/purchase-orders/reconciliation', {
        params,
      });
      return data;
    },
  });
}

// ── Single PO reconciliation ─────────────────────────────────────────────

export function usePoSingleReconciliation(poNumber: string | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', poNumber, 'reconciliation'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/purchase-orders/${poNumber}/reconciliation`);
      return data;
    },
    enabled: !!poNumber,
  });
}

// ── Manual sync ──────────────────────────────────────────────────────────

export function useTriggerPoSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/purchase-orders/sync');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}
