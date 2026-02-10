import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── AQL Types ──────────────────────────────────────────────────────────────

export type InspectionLevel = 'I' | 'II' | 'III';

export interface AqlSample {
  lotSize: number;
  inspectionLevel: InspectionLevel;
  aqlPercent: number;
  sampleSize: number;
  acceptNumber: number;
  rejectNumber: number;
}

export interface AqlTableRow {
  lotSizeMin: number;
  lotSizeMax: number;
  lotSizeLabel: string;
  sampleSizeLevelI: number;
  sampleSizeLevelII: number;
  sampleSizeLevelIII: number;
}

export interface AqlTable {
  rows: AqlTableRow[];
  aqlValues: number[];
}

// ── Checklist Types ────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  checklistId: string;
  itemOrder: number;
  description: string;
  isMandatory: boolean;
  inspectionType: string;
}

export interface Checklist {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items?: ChecklistItem[];
  _count?: { items: number };
}

// ── AQL Hooks ──────────────────────────────────────────────────────────────

export function useAqlCalculation(lotSize: number | undefined, level: InspectionLevel, aql: number | undefined) {
  return useQuery({
    queryKey: ['inspections', 'aql', 'calculate', lotSize, level, aql],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AqlSample>>('/inspections/aql/calculate', {
        params: { lotSize, level, aql },
      });
      return data;
    },
    enabled: !!lotSize && lotSize > 0 && !!aql && aql > 0,
  });
}

export function useAqlTable() {
  return useQuery({
    queryKey: ['inspections', 'aql', 'table'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AqlTable>>('/inspections/aql/table');
      return data;
    },
    staleTime: Infinity, // table data never changes
  });
}

// ── Checklist Hooks ────────────────────────────────────────────────────────

export function useChecklistList(params?: { category?: string; isActive?: boolean; search?: string }) {
  return useQuery({
    queryKey: ['inspections', 'checklists', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Checklist[]>>('/inspections/checklists', { params });
      return data;
    },
  });
}

export function useChecklist(id: string | undefined) {
  return useQuery({
    queryKey: ['inspections', 'checklists', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Checklist>>(`/inspections/checklists/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      description?: string;
      category?: string;
      isActive?: boolean;
      items?: Omit<ChecklistItem, 'id' | 'checklistId'>[];
    }) => {
      const { data } = await apiClient.post<ApiResponse<Checklist>>('/inspections/checklists', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections', 'checklists'] }),
  });
}

export function useUpdateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      description?: string;
      category?: string;
      isActive?: boolean;
    }) => {
      const { data } = await apiClient.put<ApiResponse<Checklist>>(`/inspections/checklists/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections', 'checklists'] }),
  });
}

export function useDeleteChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inspections/checklists/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections', 'checklists'] }),
  });
}

// ── Checklist Item Mutations ───────────────────────────────────────────────

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checklistId,
      ...body
    }: {
      checklistId: string;
      description: string;
      itemOrder: number;
      isMandatory?: boolean;
      inspectionType?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<ChecklistItem>>(
        `/inspections/checklists/${checklistId}/items`,
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections', 'checklists'] }),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checklistId,
      itemId,
      ...body
    }: {
      checklistId: string;
      itemId: string;
      description?: string;
      itemOrder?: number;
      isMandatory?: boolean;
      inspectionType?: string;
    }) => {
      const { data } = await apiClient.put<ApiResponse<ChecklistItem>>(
        `/inspections/checklists/${checklistId}/items/${itemId}`,
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections', 'checklists'] }),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ checklistId, itemId }: { checklistId: string; itemId: string }) => {
      await apiClient.delete(`/inspections/checklists/${checklistId}/items/${itemId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections', 'checklists'] }),
  });
}

export function useReorderChecklistItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ checklistId, itemIds }: { checklistId: string; itemIds: string[] }) => {
      const { data } = await apiClient.post<ApiResponse<ChecklistItem[]>>(
        `/inspections/checklists/${checklistId}/items/reorder`,
        { itemIds },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections', 'checklists'] }),
  });
}
