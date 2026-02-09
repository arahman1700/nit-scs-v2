import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { CompanyDocument } from '@nit-scs/shared/types';
import type { ApiResponse } from '../types';

export interface DocumentListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
}

/** GET /api/documents — List documents */
export function useDocumentList(params?: DocumentListParams) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CompanyDocument[]>>('/documents', { params });
      return data;
    },
  });
}

/** GET /api/documents/:id */
export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CompanyDocument>>(`/documents/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/** GET /api/documents/categories — Category counts */
export function useDocumentCategories() {
  return useQuery({
    queryKey: ['documents', 'categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ category: string; count: number }[]>>('/documents/categories');
      return data;
    },
    staleTime: 60_000,
  });
}

/** POST /api/documents — Upload (multipart FormData) */
export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post<ApiResponse<CompanyDocument>>('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

/** PUT /api/documents/:id — Update metadata */
export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<CompanyDocument> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<CompanyDocument>>(`/documents/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

/** DELETE /api/documents/:id — Soft-delete */
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/documents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
