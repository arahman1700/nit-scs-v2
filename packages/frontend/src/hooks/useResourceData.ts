// ============================================================================
// Generic Resource Data Hook
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { TableFilters, PaginationMeta } from '@nit-scs/shared/types';

interface UseResourceDataOptions<T> {
  service: {
    getAll: (filters?: TableFilters) => Promise<{ data: T[]; meta?: PaginationMeta; success: boolean }>;
  };
  initialFilters?: TableFilters;
  autoFetch?: boolean;
}

interface UseResourceDataReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  meta: PaginationMeta | null;
  filters: TableFilters;
  setFilters: (filters: Partial<TableFilters>) => void;
  refresh: () => void;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setSort: (sortBy: string) => void;
}

export function useResourceData<T>({
  service,
  initialFilters = {},
  autoFetch = true,
}: UseResourceDataOptions<T>): UseResourceDataReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [filters, setFiltersState] = useState<TableFilters>({
    page: 1,
    pageSize: 20,
    sortDir: 'desc',
    ...initialFilters,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.getAll(filters);
      if (result.success) {
        setData(result.data);
        setMeta(result.meta || null);
      } else {
        setError('Failed to load data');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [service, filters]);

  useEffect(() => {
    if (autoFetch) fetchData();
  }, [fetchData, autoFetch]);

  const setFilters = useCallback((updates: Partial<TableFilters>) => {
    setFiltersState(prev => ({ ...prev, ...updates, page: updates.page || 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFiltersState(prev => ({ ...prev, page }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFiltersState(prev => ({ ...prev, search, page: 1 }));
  }, []);

  const setSort = useCallback((sortBy: string) => {
    setFiltersState(prev => ({
      ...prev,
      sortBy,
      sortDir: prev.sortBy === sortBy && prev.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }, []);

  return { data, loading, error, meta, filters, setFilters, refresh: fetchData, setPage, setSearch, setSort };
}
