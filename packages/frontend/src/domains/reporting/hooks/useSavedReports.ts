// ============================================================================
// Saved Reports React Query Hooks
// CRUD for custom saved reports + run
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReportFilter {
  field: string;
  operator: string;
  value: string;
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface SavedReport {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  dataSource: string;
  columns: string[];
  filters: ReportFilter[];
  visualization: 'table' | 'bar' | 'line' | 'pie';
  isTemplate?: boolean;
  isPublic?: boolean;
  sharedWithRoles?: string[];
  category?: string;
  owner?: { fullName: string };
  scheduleFrequency?: ScheduleFrequency | null;
  scheduleRecipients?: string[];
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareReportInput {
  id: string;
  roles?: string[];
  isPublic?: boolean;
}

export interface CreateReportInput {
  name: string;
  description?: string;
  dataSource: string;
  columns: string[];
  filters?: ReportFilter[];
  visualization?: 'table' | 'bar' | 'line' | 'pie';
}

export interface UpdateReportInput {
  id: string;
  name?: string;
  description?: string;
  dataSource?: string;
  columns?: string[];
  filters?: ReportFilter[];
  visualization?: 'table' | 'bar' | 'line' | 'pie';
}

export interface ScheduleReportInput {
  id: string;
  scheduleFrequency?: ScheduleFrequency | null;
  scheduleRecipients?: string[];
}

export interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
}

// ── List ────────────────────────────────────────────────────────────────────
export function useSavedReports() {
  return useQuery({
    queryKey: ['saved-reports'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SavedReport[]>>('/reports/saved');
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useSavedReport(id: string | undefined) {
  return useQuery({
    queryKey: ['saved-reports', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SavedReport>>(`/reports/saved/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReportInput) => {
      const { data } = await apiClient.post<ApiResponse<SavedReport>>('/reports/saved', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateReportInput) => {
      const { data } = await apiClient.put<ApiResponse<SavedReport>>(`/reports/saved/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<void>>(`/reports/saved/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}

// ── Run Report ──────────────────────────────────────────────────────────────
export function useRunReport() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<ReportResult>>(`/reports/saved/${id}/run`);
      return data;
    },
  });
}

// ── Templates ───────────────────────────────────────────────────────────────

/** GET /api/reports/saved/templates — list all public report templates */
export function useReportTemplates() {
  return useQuery({
    queryKey: ['report-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SavedReport[]>>('/reports/saved/templates');
      return data;
    },
  });
}

/** POST /api/reports/saved/templates/:id/use — copy template to user's reports */
export function useTemplateToReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await apiClient.post<ApiResponse<SavedReport>>(`/reports/saved/templates/${templateId}/use`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}

// ── Share ────────────────────────────────────────────────────────────────────

/** POST /api/reports/saved/:id/share — update sharing settings (roles + isPublic) */
export function useShareReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: ShareReportInput) => {
      const { data } = await apiClient.post<ApiResponse<SavedReport>>(`/reports/saved/${id}/share`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-reports'] });
      qc.invalidateQueries({ queryKey: ['shared-reports'] });
    },
  });
}

/** GET /api/reports/saved/shared — reports shared with the current user's role */
export function useSharedReports() {
  return useQuery({
    queryKey: ['shared-reports'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SavedReport[]>>('/reports/saved/shared');
      return data;
    },
  });
}

// ── Schedule ─────────────────────────────────────────────────────────────────

/** PATCH /api/reports/saved/:id/schedule — set schedule frequency and recipients */
export function useScheduleReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: ScheduleReportInput) => {
      const { data } = await apiClient.patch<ApiResponse<SavedReport>>(`/reports/saved/${id}/schedule`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}
