import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ImportField {
  dbField: string;
  label: string;
  required: boolean;
}

export interface ImportPreview {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  expectedFields: ImportField[];
}

export interface ImportRowResult {
  row: number;
  success: boolean;
  error?: string;
}

export interface ImportResult {
  entity: string;
  total: number;
  succeeded: number;
  failed: number;
  results: ImportRowResult[];
}

// ── Queries ────────────────────────────────────────────────────────────────

/** GET /import/fields/:entity — Expected fields for an entity */
export function useImportFields(entity: string | undefined) {
  return useQuery({
    queryKey: ['import-fields', entity],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ entity: string; fields: ImportField[] }>>(
        `/import/fields/${entity}`,
      );
      return data;
    },
    enabled: !!entity,
    staleTime: Infinity,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** POST /import/preview — Upload Excel file and get preview */
export function useImportPreview() {
  return useMutation({
    mutationFn: async ({ file, entity }: { file: File; entity: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity', entity);
      const { data } = await apiClient.post<ApiResponse<ImportPreview>>('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  });
}

/** POST /import/execute — Execute import with mapping */
export function useImportExecute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      entity: string;
      mapping: Record<string, string>;
      rows: Record<string, unknown>[];
    }) => {
      const { data } = await apiClient.post<ApiResponse<ImportResult>>('/import/execute', payload);
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['resourceData'] });
      qc.invalidateQueries({ queryKey: [vars.entity] });
    },
  });
}
