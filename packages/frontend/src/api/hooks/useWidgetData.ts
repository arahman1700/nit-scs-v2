// ============================================================================
// Widget Data Hook — universal data fetcher for dashboard widgets
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

export interface WidgetDataConfig {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Fetches data for a dashboard widget from the widget-data API.
 * Auto-refetches every 60 seconds.
 */
export function useWidgetData(dataSource: string | undefined, queryConfig?: WidgetDataConfig) {
  return useQuery({
    queryKey: ['widget-data', dataSource, queryConfig],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/widget-data/${dataSource}`, { params: queryConfig });
      return data;
    },
    enabled: !!dataSource,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
