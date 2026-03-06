import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useRateCardList(params?: ListParams) {
  return useQuery({
    queryKey: ['rate-cards', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/rate-cards', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useRateCard(id: string | undefined) {
  return useQuery({
    queryKey: ['rate-cards', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/rate-cards/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateRateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/rate-cards', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-cards'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateRateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/rate-cards/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-cards'] }),
  });
}

// ── Lookup (Auto-pull for JO forms) ─────────────────────────────────────────
/**
 * SOW M2-F06: Auto-pull rate card lookup.
 * Given a supplier and equipment type, returns the active rate card if one exists.
 */
export function useRateCardLookup(supplierId: string | undefined, equipmentTypeId: string | undefined) {
  return useQuery({
    queryKey: ['rate-cards', 'lookup', supplierId, equipmentTypeId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>('/rate-cards/lookup', {
        params: { supplierId, equipmentTypeId },
      });
      return data;
    },
    enabled: !!supplierId && !!equipmentTypeId,
  });
}
