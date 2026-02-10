import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CycleCount {
  id: string;
  countNumber: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  countType: 'full' | 'abc_based' | 'zone' | 'random';
  warehouseId: string;
  zoneId: string | null;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  zone?: { id: string; zoneName: string; zoneCode: string } | null;
  createdBy?: { id: string; fullName: string };
  _count?: { lines: number };
  lines?: CycleCountLine[];
}

export interface CycleCountLine {
  id: string;
  cycleCountId: string;
  itemId: string;
  expectedQty: number;
  countedQty: number | null;
  varianceQty: number | null;
  variancePercent: number | null;
  status: 'pending' | 'counted' | 'verified' | 'adjusted';
  countedAt: string | null;
  notes: string | null;
  item?: { id: string; itemCode: string; itemDescription: string; abcClass: string | null };
  countedBy?: { id: string; fullName: string } | null;
}

// ── List ────────────────────────────────────────────────────────────────────

export function useCycleCountList(params?: ListParams & { status?: string; warehouseId?: string }) {
  return useQuery({
    queryKey: ['cycle-counts', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CycleCount[]>>('/cycle-counts', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function useCycleCount(id: string | undefined) {
  return useQuery({
    queryKey: ['cycle-counts', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CycleCount>>(`/cycle-counts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateCycleCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<CycleCount>>('/cycle-counts', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle-counts'] }),
  });
}

// ── Generate Lines ──────────────────────────────────────────────────────────

export function useGenerateLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<{ lineCount: number }>>(`/cycle-counts/${id}/generate-lines`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle-counts'] }),
  });
}

// ── Start Count ─────────────────────────────────────────────────────────────

export function useStartCycleCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<CycleCount>>(`/cycle-counts/${id}/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle-counts'] }),
  });
}

// ── Record Count ────────────────────────────────────────────────────────────

export function useRecordCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cycleCountId,
      lineId,
      countedQty,
      notes,
    }: {
      cycleCountId: string;
      lineId: string;
      countedQty: number;
      notes?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<CycleCountLine>>(
        `/cycle-counts/${cycleCountId}/lines/${lineId}/count`,
        { countedQty, notes },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle-counts'] }),
  });
}

// ── Complete Count ──────────────────────────────────────────────────────────

export function useCompleteCycleCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<CycleCount>>(`/cycle-counts/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle-counts'] }),
  });
}

// ── Apply Adjustments ───────────────────────────────────────────────────────

export function useApplyAdjustments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<{ adjustedCount: number }>>(
        `/cycle-counts/${id}/apply-adjustments`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle-counts'] }),
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────

export function useCancelCycleCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<CycleCount>>(`/cycle-counts/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle-counts'] }),
  });
}
