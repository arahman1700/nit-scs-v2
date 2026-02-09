import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy?: {
    id: string;
    fullName: string;
  };
}

// ── Queries ────────────────────────────────────────────────────────────────

/** GET /attachments/:entityType/:recordId — List attachments for an entity */
export function useAttachments(entityType: string | undefined, recordId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', entityType, recordId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Attachment[]>>(`/attachments/${entityType}/${recordId}`);
      return data;
    },
    enabled: !!entityType && !!recordId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** POST /attachments/:entityType/:recordId — Upload a file */
export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityType, recordId, file }: { entityType: string; recordId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post<ApiResponse<Attachment>>(
        `/attachments/${entityType}/${recordId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['attachments', vars.entityType, vars.recordId] });
    },
  });
}

/** DELETE /attachments/:id — Soft delete an attachment */
export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityType, recordId }: { id: string; entityType: string; recordId: string }) => {
      await apiClient.delete(`/attachments/${id}`);
      return { entityType, recordId };
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ['attachments', result.entityType, result.recordId] });
    },
  });
}
