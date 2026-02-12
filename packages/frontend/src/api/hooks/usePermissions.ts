import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

type PermissionMatrix = Record<string, Record<string, string[]>>;

/** GET /api/permissions — returns full role-permission matrix */
export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PermissionMatrix>>('/permissions');
      return data;
    },
    staleTime: 5 * 60_000, // 5min
  });
}

/** GET /api/permissions/:role — returns permissions for a single role */
export function useRolePermissions(role: string) {
  return useQuery({
    queryKey: ['permissions', role],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Record<string, string[]>>>(`/permissions/${role}`);
      return data;
    },
    enabled: !!role,
    staleTime: 5 * 60_000,
  });
}

/** PUT /api/permissions/:role — bulk update permissions for a role */
export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, permissions }: { role: string; permissions: Record<string, string[]> }) => {
      const { data } = await apiClient.put<ApiResponse<Record<string, string[]>>>(`/permissions/${role}`, permissions);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}

/** PUT /api/permissions/:role/:resource — update a single permission */
export function useUpdatePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, resource, actions }: { role: string; resource: string; actions: string[] }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/permissions/${role}/${resource}`, { actions });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}

/** POST /api/permissions/reset — reset permissions to defaults */
export function useResetPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (role?: string) => {
      const { data } = await apiClient.post<ApiResponse<PermissionMatrix>>('/permissions/reset', role ? { role } : {});
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}
