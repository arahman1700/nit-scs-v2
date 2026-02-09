import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from './useMasterData';

export interface SystemSettings {
  vatRate: number;
  currency: string;
  timezone: string;
  dateFormat: string;
  overDeliveryTolerance: number;
  backdateLimit: number;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SystemSettings>>('/settings');
      return data.data;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: SystemSettings) => {
      const { data } = await apiClient.put<ApiResponse<SystemSettings>>('/settings', settings);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}
