import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

/** GET /api/permissions — returns custom overrides (or {} for defaults) */
export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>('/permissions');
      return data;
    },
    staleTime: 5 * 60_000, // 5min
  });
}

/** PUT /api/permissions — save full permission overrides */
export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.put<ApiResponse<Record<string, unknown>>>('/permissions', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permissions'] }),
  });
}
