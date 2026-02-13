import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserViewConfig {
  columnState?: unknown[];
  viewMode?: string;
  filters?: Record<string, unknown>;
  sortKey?: string;
  sortDir?: string;
}

export interface UserView {
  id: string;
  name: string;
  viewType: string;
  config: UserViewConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Queries ────────────────────────────────────────────────────────────────

/** GET /views/:entityType — List user's saved views for an entity type */
export function useUserViews(entityType: string | undefined) {
  return useQuery({
    queryKey: ['user-views', entityType],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<UserView[]>>(`/views/${entityType}`);
      return data;
    },
    enabled: !!entityType,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** POST /views — Save a new view */
export function useSaveView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      entityType: string;
      name: string;
      viewType?: string;
      config: UserViewConfig;
      isDefault?: boolean;
    }) => {
      const { data } = await apiClient.post<ApiResponse<UserView>>('/views', payload);
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['user-views', vars.entityType] });
    },
  });
}

/** PATCH /views/:id — Update an existing view */
export function useUpdateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      entityType,
      ...payload
    }: {
      id: string;
      entityType: string;
      name?: string;
      viewType?: string;
      config?: UserViewConfig;
      isDefault?: boolean;
    }) => {
      const { data } = await apiClient.patch<ApiResponse<UserView>>(`/views/${id}`, payload);
      return { ...data, entityType };
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['user-views', result.entityType] });
    },
  });
}

/** DELETE /views/:id — Delete a view */
export function useDeleteView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityType }: { id: string; entityType: string }) => {
      await apiClient.delete(`/views/${id}`);
      return { entityType };
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['user-views', result.entityType] });
    },
  });
}
