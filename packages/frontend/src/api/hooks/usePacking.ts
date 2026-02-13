import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ────────────────────────────────────────────────────────────────
export interface PackingSession {
  id: string;
  sessionNumber: string;
  mirvId: string;
  warehouseId: string;
  packedById: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  totalWeight: number | null;
  totalVolume: number | null;
  cartonCount: number;
  palletCount: number;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  mirv: {
    id: string;
    mirvNumber: string;
    project: { id: string; projectName: string; projectCode: string };
  };
  warehouse: { id: string; warehouseName: string; warehouseCode: string };
  packedBy: { id: string; firstName: string; lastName: string };
  lines: PackingLine[];
}

export interface PackingLine {
  id: string;
  packingSessionId: string;
  itemId: string;
  qtyPacked: number;
  containerType: string;
  containerLabel: string | null;
  weight: number | null;
  volume: number | null;
  scannedBarcode: string | null;
  createdAt: string;
  item: { id: string; itemCode: string; itemDescription: string };
}

export interface PackingQueueItem {
  id: string;
  mirvNumber: string;
  status: string;
  project: { id: string; projectName: string; projectCode: string };
  mirvLines: Array<{
    id: string;
    item: { id: string; itemCode: string; itemDescription: string };
  }>;
}

// ── Packing Queue ────────────────────────────────────────────────────────
export function usePackingQueue(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['packing', 'queue', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PackingQueueItem[]>>('/packing', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}

// ── Session Detail ───────────────────────────────────────────────────────
export function usePackingSession(id: string | undefined) {
  return useQuery({
    queryKey: ['packing', 'session', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PackingSession>>(`/packing/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create Session ───────────────────────────────────────────────────────
export function useCreatePackingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { mirvId: string; packedById: string; warehouseId: string }) => {
      const { data } = await apiClient.post<ApiResponse<PackingSession>>('/packing', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packing'] });
    },
  });
}

// ── Add Packing Line ─────────────────────────────────────────────────────
export function useAddPackingLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      ...body
    }: {
      sessionId: string;
      itemId: string;
      qtyPacked: number;
      containerType: string;
      containerLabel?: string;
      weight?: number;
      volume?: number;
      scannedBarcode?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<PackingLine>>(`/packing/${sessionId}/lines`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packing'] });
    },
  });
}

// ── Complete Session ─────────────────────────────────────────────────────
export function useCompletePackingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<ApiResponse<PackingSession>>(`/packing/${sessionId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packing'] });
    },
  });
}

// ── Cancel Session ───────────────────────────────────────────────────────
export function useCancelPackingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<ApiResponse<PackingSession>>(`/packing/${sessionId}/cancel`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packing'] });
    },
  });
}
