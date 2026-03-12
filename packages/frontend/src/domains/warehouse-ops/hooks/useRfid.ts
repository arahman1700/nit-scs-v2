import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RfidTag {
  id: string;
  tagEpc: string;
  tagType: 'uhf' | 'hf' | 'nfc' | 'active';
  assignedToType: 'item' | 'lpn' | 'asset' | 'zone' | null;
  assignedToId: string | null;
  warehouseId: string | null;
  status: 'unassigned' | 'active' | 'inactive' | 'damaged' | 'lost';
  lastScannedAt: string | null;
  lastScannedLocation: string | null;
  batteryLevel: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
}

export interface RfidScanEvent {
  id: string;
  tagId: string;
  readerId: string;
  location: string;
  signalStrength: number | null;
  scannedAt: string;
}

// ── List ────────────────────────────────────────────────────────────────────
export function useRfidTagList(params?: ListParams) {
  return useQuery({
    queryKey: ['rfid-tags', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RfidTag[]>>('/warehouse-ops/rfid', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useRfidTag(id: string | undefined) {
  return useQuery({
    queryKey: ['rfid-tags', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RfidTag>>(`/warehouse-ops/rfid/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateRfidTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<RfidTag>>('/warehouse-ops/rfid', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfid-tags'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateRfidTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<RfidTag>>(`/warehouse-ops/rfid/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfid-tags'] }),
  });
}

// ── Assign Tag ──────────────────────────────────────────────────────────────
export function useAssignRfidTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; assignedToType: string; assignedToId: string }) => {
      const { data } = await apiClient.post<ApiResponse<RfidTag>>(`/warehouse-ops/rfid/${id}/assign`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfid-tags'] }),
  });
}

// ── Deactivate Tag ──────────────────────────────────────────────────────────
export function useDeactivateRfidTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<RfidTag>>(`/warehouse-ops/rfid/${id}/deactivate`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfid-tags'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteRfidTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/warehouse-ops/rfid/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfid-tags'] }),
  });
}

// ── Scan Events ─────────────────────────────────────────────────────────────
export function useRfidScanEvents(tagId: string | undefined) {
  return useQuery({
    queryKey: ['rfid-tags', 'scans', tagId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RfidScanEvent[]>>(`/warehouse-ops/rfid/${tagId}/scans`);
      return data;
    },
    enabled: !!tagId,
  });
}
