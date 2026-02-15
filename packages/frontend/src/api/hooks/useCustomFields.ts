import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────

export interface CustomFieldDefinition {
  id: string;
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'email' | 'url' | 'phone' | 'currency';
  options?: Array<{ value: string; label: string }>;
  validationRules?: Record<string, unknown>;
  isRequired: boolean;
  showInGrid: boolean;
  sortOrder: number;
}

export type CreateFieldDefinitionInput = Omit<CustomFieldDefinition, 'id'>;

// ── Field Definitions ──────────────────────────────────────────────────

export function useCustomFieldDefinitions(entityType?: string) {
  return useQuery({
    queryKey: ['custom-fields', 'definitions', entityType],
    queryFn: async () => {
      const params = entityType ? { entityType } : undefined;
      const { data } = await apiClient.get<ApiResponse<CustomFieldDefinition[]>>('/custom-fields/definitions', {
        params,
      });
      return data;
    },
  });
}

export function useCustomFieldDefinition(id: string | undefined) {
  return useQuery({
    queryKey: ['custom-fields', 'definitions', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CustomFieldDefinition>>(`/custom-fields/definitions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCustomFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateFieldDefinitionInput) => {
      const { data } = await apiClient.post<ApiResponse<CustomFieldDefinition>>('/custom-fields/definitions', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', 'definitions'] });
    },
  });
}

export function useUpdateCustomFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<CreateFieldDefinitionInput> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<CustomFieldDefinition>>(
        `/custom-fields/definitions/${id}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', 'definitions'] });
    },
  });
}

export function useDeleteCustomFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<void>>(`/custom-fields/definitions/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', 'definitions'] });
    },
  });
}

// ── Field Values ────────────────────────────────────────────────────────

export function useCustomFieldValues(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['custom-fields', 'values', entityType, entityId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>(
        `/custom-fields/values/${entityType}/${entityId}`,
      );
      return data;
    },
    enabled: !!entityType && !!entityId,
  });
}

export function useSaveCustomFieldValues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      values,
    }: {
      entityType: string;
      entityId: string;
      values: Record<string, unknown>;
    }) => {
      const { data } = await apiClient.put<ApiResponse<Record<string, unknown>>>(
        `/custom-fields/values/${entityType}/${entityId}`,
        values,
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['custom-fields', 'values', vars.entityType, vars.entityId] });
    },
  });
}
