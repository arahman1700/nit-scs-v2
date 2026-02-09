import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DocumentComment {
  id: string;
  documentType: string;
  documentId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    fullName: string;
    email: string;
    department: string;
  };
}

// ── Queries ────────────────────────────────────────────────────────────────

/** GET /comments/:documentType/:documentId — List comments */
export function useDocumentComments(
  documentType: string | undefined,
  documentId: string | undefined,
  params?: { page?: number; pageSize?: number },
) {
  return useQuery({
    queryKey: ['comments', documentType, documentId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DocumentComment[]>>(`/comments/${documentType}/${documentId}`, {
        params,
      });
      return data;
    },
    enabled: !!documentType && !!documentId,
  });
}

/** GET /comments/:documentType/:documentId/count — Comment count for badges */
export function useCommentCount(documentType: string | undefined, documentId: string | undefined) {
  return useQuery({
    queryKey: ['comments', documentType, documentId, 'count'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ count: number }>>(
        `/comments/${documentType}/${documentId}/count`,
      );
      return data;
    },
    enabled: !!documentType && !!documentId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/** POST /comments/:documentType/:documentId — Create comment */
export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentType,
      documentId,
      content,
    }: {
      documentType: string;
      documentId: string;
      content: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<DocumentComment>>(`/comments/${documentType}/${documentId}`, {
        content,
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.documentType, vars.documentId] });
    },
  });
}

/** PUT /comments/:documentType/:documentId/:commentId — Update comment */
export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentType,
      documentId,
      commentId,
      content,
    }: {
      documentType: string;
      documentId: string;
      commentId: string;
      content: string;
    }) => {
      const { data } = await apiClient.put<ApiResponse<DocumentComment>>(
        `/comments/${documentType}/${documentId}/${commentId}`,
        { content },
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.documentType, vars.documentId] });
    },
  });
}

/** DELETE /comments/:documentType/:documentId/:commentId — Delete comment */
export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentType,
      documentId,
      commentId,
    }: {
      documentType: string;
      documentId: string;
      commentId: string;
    }) => {
      await apiClient.delete(`/comments/${documentType}/${documentId}/${commentId}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.documentType, vars.documentId] });
    },
  });
}
