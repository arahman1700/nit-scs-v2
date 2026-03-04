import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ═════════════════════════════════════════════════════════════════════════════
// DELIVERY NOTES
// ═════════════════════════════════════════════════════════════════════════════

// ── List ────────────────────────────────────────────────────────────────────
export function useEquipmentDeliveryNoteList(params?: ListParams) {
  return useQuery({
    queryKey: ['equipment-delivery-notes', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/equipment-notes/delivery', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useEquipmentDeliveryNote(id: string | undefined) {
  return useQuery({
    queryKey: ['equipment-delivery-notes', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/equipment-notes/delivery/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateEquipmentDeliveryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/equipment-notes/delivery', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-delivery-notes'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateEquipmentDeliveryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/equipment-notes/delivery/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-delivery-notes'] }),
  });
}

// ── Confirm ─────────────────────────────────────────────────────────────────
export function useConfirmEquipmentDeliveryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/equipment-notes/delivery/${id}/confirm`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-delivery-notes'] }),
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────
export function useCancelEquipmentDeliveryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/equipment-notes/delivery/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-delivery-notes'] }),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// RETURN NOTES
// ═════════════════════════════════════════════════════════════════════════════

// ── List ────────────────────────────────────────────────────────────────────
export function useEquipmentReturnNoteList(params?: ListParams) {
  return useQuery({
    queryKey: ['equipment-return-notes', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/equipment-notes/return', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useEquipmentReturnNote(id: string | undefined) {
  return useQuery({
    queryKey: ['equipment-return-notes', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/equipment-notes/return/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateEquipmentReturnNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/equipment-notes/return', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-return-notes'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateEquipmentReturnNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/equipment-notes/return/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-return-notes'] }),
  });
}

// ── Inspect ─────────────────────────────────────────────────────────────────
export function useInspectEquipmentReturnNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/equipment-notes/return/${id}/inspect`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-return-notes'] }),
  });
}

// ── Confirm ─────────────────────────────────────────────────────────────────
export function useConfirmEquipmentReturnNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/equipment-notes/return/${id}/confirm`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-return-notes'] }),
  });
}

// ── Dispute ─────────────────────────────────────────────────────────────────
export function useDisputeEquipmentReturnNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/equipment-notes/return/${id}/dispute`, { reason });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment-return-notes'] }),
  });
}
