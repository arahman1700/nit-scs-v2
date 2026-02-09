// ============================================================================
// Audit Log React Query Hooks
// Read-only access to audit trail
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { AuditLogEntry } from '@nit-scs/shared/types';
import type { ApiResponse } from '../types';

export interface AuditLogParams {
  page?: number;
  pageSize?: number;
  tableName?: string;
  action?: string;
  performedById?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/** GET /api/audit */
export function useAuditLogs(params?: AuditLogParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AuditLogEntry[]>>('/audit', { params });
      return data;
    },
  });
}

/** GET /api/audit/:id */
export function useAuditLogEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['audit-logs', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AuditLogEntry>>(`/audit/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
