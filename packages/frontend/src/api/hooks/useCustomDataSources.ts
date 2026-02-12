import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────

export interface CustomDataSource {
  id: string;
  name: string;
  sourceKey: string;
  entityType: string;
  aggregation: 'count' | 'sum' | 'avg' | 'group_by' | 'timeseries';
  queryTemplate: {
    entityType: string;
    filters?: Array<{ field: string; op: string; value: unknown }>;
    groupBy?: string;
    dateField?: string;
    dateRange?: string;
    sumField?: string;
  };
  outputType: 'number' | 'grouped' | 'timeseries' | 'table';
  isPublic: boolean;
  createdById?: string;
  createdAt: string;
}

export type CreateDataSourceInput = Omit<CustomDataSource, 'id' | 'createdById' | 'createdAt'>;

// ── List ────────────────────────────────────────────────────────────────

export function useCustomDataSourceList() {
  return useQuery({
    queryKey: ['custom-data-sources', 'list'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CustomDataSource[]>>('/custom-data-sources');
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────

export function useCustomDataSource(id: string | undefined) {
  return useQuery({
    queryKey: ['custom-data-sources', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CustomDataSource>>(`/custom-data-sources/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────

export function useCreateCustomDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateDataSourceInput) => {
      const { data } = await apiClient.post<ApiResponse<CustomDataSource>>('/custom-data-sources', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-data-sources'] });
    },
  });
}

// ── Update ──────────────────────────────────────────────────────────────

export function useUpdateCustomDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<CreateDataSourceInput> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<CustomDataSource>>(`/custom-data-sources/${id}`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-data-sources'] });
    },
  });
}

// ── Delete ──────────────────────────────────────────────────────────────

export function useDeleteCustomDataSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<void>>(`/custom-data-sources/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-data-sources'] });
    },
  });
}

// ── Test / Preview ──────────────────────────────────────────────────────

export function useTestCustomDataSource() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/custom-data-sources/${id}/test`);
      return data;
    },
  });
}

export function usePreviewCustomDataSource() {
  return useMutation({
    mutationFn: async (body: {
      entityType: string;
      aggregation: string;
      queryTemplate: unknown;
      outputType?: string;
      name?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/custom-data-sources/preview', body);
      return data;
    },
  });
}
