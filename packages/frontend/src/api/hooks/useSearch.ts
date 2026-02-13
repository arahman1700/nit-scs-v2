import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface SearchResult {
  type: string;
  id: string;
  number: string;
  status: string;
  summary: string;
  createdAt: string;
}

export function useGlobalSearch(query: string, options?: { types?: string[] }) {
  return useQuery<SearchResult[]>({
    queryKey: ['search', query, options?.types],
    queryFn: async () => {
      const params: Record<string, string> = { q: query };
      if (options?.types?.length) params.types = options.types.join(',');
      const res = await apiClient.get('/search', { params });
      return res.data?.data ?? res.data ?? [];
    },
    enabled: query.length >= 2,
    staleTime: 10_000,
  });
}
