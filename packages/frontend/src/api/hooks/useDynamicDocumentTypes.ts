import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────

export interface DynamicDocumentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  category: string;
  statusFlow: StatusFlowConfig;
  approvalConfig?: Record<string, unknown>;
  permissionConfig?: Record<string, unknown>;
  settings: Record<string, unknown>;
  isActive: boolean;
  visibleToRoles: string[];
  version: number;
  createdAt: string;
  fields?: FieldDefinition[];
  _count?: { fields: number; documents: number };
}

export interface StatusFlowConfig {
  initialStatus: string;
  statuses: Array<{ key: string; label: string; color: string }>;
  transitions: Record<string, string[]>;
}

export interface FieldDefinition {
  id: string;
  documentTypeId: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
  isRequired: boolean;
  showInGrid: boolean;
  showInForm: boolean;
  sectionName?: string;
  sortOrder: number;
  validationRules?: Record<string, unknown>;
  defaultValue?: string;
  colSpan: number;
  isLineItem: boolean;
  isReadOnly: boolean;
  conditionalDisplay?: Record<string, unknown>;
}

// ── List ────────────────────────────────────────────────────────────────

export function useDynamicTypeList(params?: ListParams) {
  return useQuery({
    queryKey: ['dynamic-types', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DynamicDocumentType[]>>('/dynamic-types', { params });
      return data;
    },
  });
}

// ── Active types for navigation ─────────────────────────────────────────

export function useActiveDynamicTypes() {
  return useQuery({
    queryKey: ['dynamic-types', 'active'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiResponse<Array<{ code: string; name: string; icon?: string; category: string }>>>(
          '/dynamic-types/active',
        );
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// ── Detail ──────────────────────────────────────────────────────────────

export function useDynamicType(id: string | undefined) {
  return useQuery({
    queryKey: ['dynamic-types', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DynamicDocumentType>>(`/dynamic-types/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────

export function useCreateDynamicType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<DynamicDocumentType>) => {
      const { data } = await apiClient.post<ApiResponse<DynamicDocumentType>>('/dynamic-types', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-types'] });
    },
  });
}

// ── Update ──────────────────────────────────────────────────────────────

export function useUpdateDynamicType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<DynamicDocumentType> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<DynamicDocumentType>>(`/dynamic-types/${id}`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-types'] });
    },
  });
}

// ── Delete ──────────────────────────────────────────────────────────────

export function useDeleteDynamicType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<void>>(`/dynamic-types/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-types'] });
    },
  });
}

// ── Field Management ────────────────────────────────────────────────────

export function useAddField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ typeId, ...body }: Partial<FieldDefinition> & { typeId: string }) => {
      const { data } = await apiClient.post<ApiResponse<FieldDefinition>>(`/dynamic-types/${typeId}/fields`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-types'] });
    },
  });
}

export function useUpdateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      typeId,
      fieldId,
      ...body
    }: Partial<FieldDefinition> & { typeId: string; fieldId: string }) => {
      const { data } = await apiClient.put<ApiResponse<FieldDefinition>>(
        `/dynamic-types/${typeId}/fields/${fieldId}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-types'] });
    },
  });
}

export function useDeleteField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ typeId, fieldId }: { typeId: string; fieldId: string }) => {
      const { data } = await apiClient.delete<ApiResponse<void>>(`/dynamic-types/${typeId}/fields/${fieldId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-types'] });
    },
  });
}

export function useReorderFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ typeId, fieldIds }: { typeId: string; fieldIds: string[] }) => {
      const { data } = await apiClient.post<ApiResponse<void>>(`/dynamic-types/${typeId}/fields/reorder`, { fieldIds });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dynamic-types'] });
    },
  });
}
