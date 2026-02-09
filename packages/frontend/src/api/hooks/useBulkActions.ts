import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BulkResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface BulkActionResponse {
  documentType: string;
  action: string;
  total: number;
  succeeded: number;
  failed: number;
  results: BulkResult[];
}

// ── Queries ────────────────────────────────────────────────────────────────

/** GET /bulk/actions/:documentType — Available bulk actions */
export function useBulkActions(documentType: string | undefined) {
  return useQuery({
    queryKey: ['bulk-actions', documentType],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ documentType: string; actions: string[] }>>(
        `/bulk/actions/${documentType}`,
      );
      return data;
    },
    enabled: !!documentType,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** POST /bulk/execute — Execute bulk action */
export function useExecuteBulkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { documentType: string; ids: string[]; action: string }) => {
      const { data } = await apiClient.post<ApiResponse<BulkActionResponse>>('/bulk/execute', payload);
      return data;
    },
    onSuccess: (_data, vars) => {
      // Invalidate the affected resource queries
      qc.invalidateQueries({ queryKey: [vars.documentType] });
      // Also invalidate generic resource data
      qc.invalidateQueries({ queryKey: ['resourceData'] });
    },
  });
}
