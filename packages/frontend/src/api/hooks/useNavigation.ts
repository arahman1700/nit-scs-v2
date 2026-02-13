import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { NavItem } from '@nit-scs-v2/shared/types';

export function useNavigation() {
  return useQuery<NavItem[]>({
    queryKey: ['navigation'],
    queryFn: async () => {
      const res = await apiClient.get('/navigation');
      return res.data?.data ?? res.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
