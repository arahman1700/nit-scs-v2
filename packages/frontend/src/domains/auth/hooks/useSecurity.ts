// ============================================================================
// Security React Query Hooks — M6: Access Control & Security
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ApiResponse } from '../../../api/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SecurityDashboard {
  activeUsers24h: number;
  failedAttempts24h: number;
  lockedAccounts: number;
  suspiciousIps: string[];
}

export interface LoginHistoryEntry {
  id: string;
  ipAddress: string;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  createdAt: string;
}

export interface LoginHistoryParams {
  page?: number;
  pageSize?: number;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/** GET /api/security/dashboard */
export function useSecurityDashboard() {
  return useQuery({
    queryKey: ['security-dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SecurityDashboard>>('/security/dashboard');
      return data;
    },
    refetchInterval: 60_000, // Auto-refresh every minute
  });
}

/** GET /api/security/login-history/:employeeId */
export function useLoginHistory(employeeId: string | undefined, params?: LoginHistoryParams) {
  return useQuery({
    queryKey: ['login-history', employeeId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<LoginHistoryEntry[]>>(`/security/login-history/${employeeId}`, {
        params,
      });
      return data;
    },
    enabled: !!employeeId,
  });
}
