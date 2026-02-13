import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────

export interface SemanticMeasure {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  entityType: string;
  aggregation: string;
  field: string | null;
  defaultFilters: unknown;
  unit: string | null;
  isActive: boolean;
}

export interface SemanticDimension {
  id: string;
  key: string;
  name: string;
  description: string | null;
  entityTypes: string[];
  field: string;
  dimensionType: string;
  hierarchy: unknown;
  isActive: boolean;
}

export type SemanticCatalog = Record<string, SemanticMeasure[]>;

export interface SemanticQueryParams {
  measure: string;
  dimensions?: string[];
  filters?: Array<{ field: string; op: string; value: unknown }>;
  dateRange?: { start: string; end: string };
}

export interface SemanticQueryResult {
  measure: { key: string; name: string; aggregation: string };
  dimensions: Array<{ key: string; field: string }>;
  data: unknown;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useSemanticCatalog() {
  return useQuery({
    queryKey: ['semantic', 'catalog'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SemanticCatalog>>('/semantic/catalog');
      return data;
    },
  });
}

export function useSemanticMeasures(category?: string) {
  return useQuery({
    queryKey: ['semantic', 'measures', category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      const { data } = await apiClient.get<ApiResponse<SemanticMeasure[]>>(`/semantic/measures?${params}`);
      return data;
    },
  });
}

export function useSemanticDimensions(entityType?: string) {
  return useQuery({
    queryKey: ['semantic', 'dimensions', entityType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityType) params.set('entityType', entityType);
      const { data } = await apiClient.get<ApiResponse<SemanticDimension[]>>(`/semantic/dimensions?${params}`);
      return data;
    },
  });
}

export function useCompatibleDimensions(measureKey: string | undefined) {
  return useQuery({
    queryKey: ['semantic', 'dimensions', 'compatible', measureKey],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SemanticDimension[]>>(
        `/semantic/measures/${measureKey}/dimensions`,
      );
      return data;
    },
    enabled: !!measureKey,
  });
}

export function useSemanticQuery() {
  return useMutation({
    mutationFn: async (params: SemanticQueryParams) => {
      const { data } = await apiClient.post<ApiResponse<SemanticQueryResult>>('/semantic/query', params);
      return data;
    },
  });
}
