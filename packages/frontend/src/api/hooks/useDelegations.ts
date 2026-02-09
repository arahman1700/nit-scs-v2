import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DelegationRule {
  id: string;
  delegatorId: string;
  delegateId: string;
  startDate: string;
  endDate: string;
  scope: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  delegator: { id: string; fullName: string; email: string; department: string };
  delegate: { id: string; fullName: string; email: string; department: string };
}

// ── Queries ────────────────────────────────────────────────────────────────

/** GET /delegations — List delegations */
export function useDelegationList(params?: { page?: number; pageSize?: number; activeOnly?: boolean }) {
  return useQuery({
    queryKey: ['delegations', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DelegationRule[]>>('/delegations', { params });
      return data;
    },
  });
}

/** GET /delegations/:id */
export function useDelegation(id: string | undefined) {
  return useQuery({
    queryKey: ['delegations', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DelegationRule>>(`/delegations/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** POST /delegations — Create delegation */
export function useCreateDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      delegateId: string;
      startDate: string;
      endDate: string;
      scope?: string;
      notes?: string;
      delegatorId?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<DelegationRule>>('/delegations', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegations'] }),
  });
}

/** PUT /delegations/:id */
export function useUpdateDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      startDate?: string;
      endDate?: string;
      scope?: string;
      isActive?: boolean;
      notes?: string;
    }) => {
      const { data } = await apiClient.put<ApiResponse<DelegationRule>>(`/delegations/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegations'] }),
  });
}

/** POST /delegations/:id/toggle */
export function useToggleDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<DelegationRule>>(`/delegations/${id}/toggle`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegations'] }),
  });
}

/** DELETE /delegations/:id */
export function useDeleteDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/delegations/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delegations'] }),
  });
}
