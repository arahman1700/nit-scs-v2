import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Checklist Types ──────────────────────────────────────────────────────

export interface ComplianceChecklistItem {
  id: string;
  checklistId: string;
  itemNumber: number;
  question: string;
  category: string | null;
  requiredEvidence: string | null;
  weight: number;
}

export interface ComplianceChecklist {
  id: string;
  checklistCode: string;
  title: string;
  standard: string;
  category: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items?: ComplianceChecklistItem[];
  _count?: { items: number; audits: number };
}

// ── Audit Types ──────────────────────────────────────────────────────────

export interface ComplianceAuditResponse {
  id: string;
  auditId: string;
  checklistItemId: string;
  response: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  evidence: string | null;
  notes: string | null;
  score: number | null;
  checklistItem?: {
    id: string;
    itemNumber: number;
    question: string;
    weight: number;
  };
}

export interface ComplianceAudit {
  id: string;
  auditNumber: string;
  checklistId: string;
  warehouseId: string;
  auditorId: string;
  auditDate: string;
  status: 'draft' | 'in_progress' | 'completed' | 'action_required';
  overallScore: number | null;
  findings: string | null;
  correctiveActions: string | null;
  dueDate: string | null;
  completedDate: string | null;
  createdAt: string;
  updatedAt: string;
  checklist?: ComplianceChecklist & { items?: ComplianceChecklistItem[] };
  warehouse?: { id: string; warehouseCode: string; warehouseName: string };
  auditor?: { id: string; fullName: string; email?: string };
  responses?: ComplianceAuditResponse[];
  _count?: { responses: number };
}

// ═══════════════════════════════════════════════════════════════════════
// CHECKLIST HOOKS
// ═══════════════════════════════════════════════════════════════════════

// ── List ────────────────────────────────────────────────────────────────────

export function useChecklistList(
  params?: ListParams & {
    standard?: string;
    category?: string;
  },
) {
  return useQuery({
    queryKey: ['compliance', 'checklists', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ComplianceChecklist[]>>('/compliance/checklists', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function useChecklist(id: string | undefined) {
  return useQuery({
    queryKey: ['compliance', 'checklists', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ComplianceChecklist>>(`/compliance/checklists/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      checklistCode: string;
      title: string;
      standard: string;
      category: string;
      version?: number;
      isActive?: boolean;
      items?: Array<{
        itemNumber: number;
        question: string;
        category?: string;
        requiredEvidence?: string;
        weight?: number;
      }>;
    }) => {
      const { data } = await apiClient.post<ApiResponse<ComplianceChecklist>>('/compliance/checklists', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance', 'checklists'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────

export function useUpdateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      standard?: string;
      category?: string;
      version?: number;
      isActive?: boolean;
      items?: Array<{
        itemNumber: number;
        question: string;
        category?: string;
        requiredEvidence?: string;
        weight?: number;
      }>;
    }) => {
      const { data } = await apiClient.put<ApiResponse<ComplianceChecklist>>(`/compliance/checklists/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance', 'checklists'] }),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIT HOOKS
// ═══════════════════════════════════════════════════════════════════════

// ── List ────────────────────────────────────────────────────────────────────

export function useAuditList(
  params?: ListParams & {
    warehouseId?: string;
    checklistId?: string;
    auditorId?: string;
  },
) {
  return useQuery({
    queryKey: ['compliance', 'audits', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ComplianceAudit[]>>('/compliance/audits', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function useAudit(id: string | undefined) {
  return useQuery({
    queryKey: ['compliance', 'audits', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ComplianceAudit>>(`/compliance/audits/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      checklistId: string;
      warehouseId: string;
      auditDate: string;
      dueDate?: string;
      findings?: string;
      correctiveActions?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<ComplianceAudit>>('/compliance/audits', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance', 'audits'] }),
  });
}

// ── Submit Audit Responses ──────────────────────────────────────────────────

export function useSubmitAuditResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      auditId,
      responses,
    }: {
      auditId: string;
      responses: Array<{
        checklistItemId: string;
        response: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
        evidence?: string;
        notes?: string;
        score?: number;
      }>;
    }) => {
      const { data } = await apiClient.post<ApiResponse<ComplianceAudit>>(`/compliance/audits/${auditId}/responses`, {
        responses,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance', 'audits'] }),
  });
}

// ── Complete Audit ──────────────────────────────────────────────────────────

export function useCompleteAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<ComplianceAudit>>(`/compliance/audits/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance', 'audits'] }),
  });
}
