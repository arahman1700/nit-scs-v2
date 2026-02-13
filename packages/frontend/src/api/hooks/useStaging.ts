import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StagingZone {
  id: string;
  warehouseId: string;
  zoneName: string;
  zoneCode: string;
  zoneType: string;
  capacity: number | null;
  currentOccupancy: number | null;
  activeAssignments: number;
  totalStagedQty: number;
}

export interface StagingAssignment {
  id: string;
  zoneId: string;
  warehouseId: string;
  itemId: string;
  sourceDocType: 'grn' | 'mi' | 'wt' | 'cross_dock';
  sourceDocId: string;
  quantity: number;
  assignedById: string;
  direction: 'inbound' | 'outbound';
  status: 'staged' | 'moved' | 'expired';
  stagedAt: string;
  movedAt: string | null;
  maxDwellHours: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  zone?: {
    id: string;
    zoneName: string;
    zoneCode: string;
    zoneType: string;
    capacity: number | null;
    currentOccupancy: number | null;
  };
  item?: { id: string; code: string; name: string; category: string };
  assignedBy?: { id: string; name: string; employeeCode: string };
}

export interface StagingOccupancy {
  zoneId: string;
  zoneName: string;
  zoneCode: string;
  zoneType: string;
  capacity: number;
  currentOccupancy: number;
  stagedCount: number;
  stagedQty: number;
  utilizationPct: number;
}

export interface AssignmentFilters {
  warehouseId?: string;
  zoneId?: string;
  status?: string;
  direction?: string;
  page?: number;
  pageSize?: number;
}

// ############################################################################
// STAGING ZONES
// ############################################################################

export function useStagingZones(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['staging', 'zones', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StagingZone[]>>('/staging/zones', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}

// ############################################################################
// ASSIGNMENTS
// ############################################################################

export function useStagingAssignments(filters?: AssignmentFilters) {
  return useQuery({
    queryKey: ['staging', 'assignments', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StagingAssignment[]>>('/staging', { params: filters });
      return data;
    },
    enabled: !!filters?.warehouseId,
  });
}

export function useCreateStagingAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<StagingAssignment>>('/staging', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staging'] }),
  });
}

export function useMoveFromStaging() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StagingAssignment>>(`/staging/${id}/move`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staging'] }),
  });
}

// ############################################################################
// ALERTS & OCCUPANCY
// ############################################################################

export function useStagingAlerts(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['staging', 'alerts', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StagingAssignment[]>>('/staging/alerts', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
    refetchInterval: 60_000, // Refresh every minute for alerts
  });
}

export function useStagingOccupancy(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['staging', 'occupancy', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StagingOccupancy[]>>('/staging/occupancy', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}
