import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReorderSuggestion {
  id: string;
  itemId: string;
  warehouseId: string;
  item: {
    id: string;
    itemCode: string;
    itemDescription: string;
    category: string;
    reorderPoint: number | null;
  };
  warehouse: {
    id: string;
    warehouseName: string;
    warehouseCode: string;
  };
  currentQty: number;
  reorderPoint: number;
  minLevel: number | null;
  suggestedOrderQty: number;
  lastMovementDate: string | null;
  alertSent: boolean | null;
}

export interface ApplyReorderPayload {
  itemId: string;
  warehouseId: string;
  reorderPoint?: number;
  minLevel?: number;
}

interface ApiSuccessResponse<T> {
  success: boolean;
  data: T;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useReorderSuggestions — fetch inventory items at or below their reorder point.
 * Maps to GET /inventory/reorder-suggestions
 */
export function useReorderSuggestions() {
  return useQuery({
    queryKey: ['inventory', 'reorder-suggestions'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccessResponse<ReorderSuggestion[]>>('/inventory/reorder-suggestions');
      return data.data;
    },
  });
}

/**
 * useApplyReorderSuggestion — update reorderPoint / minLevel for a specific
 * item+warehouse inventory level record.
 * Maps to POST /inventory/reorder-suggestions/:itemId/apply
 */
export function useApplyReorderSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, warehouseId, reorderPoint, minLevel }: ApplyReorderPayload) => {
      const { data } = await apiClient.post<ApiSuccessResponse<unknown>>(
        `/inventory/reorder-suggestions/${itemId}/apply`,
        { warehouseId, reorderPoint, minLevel },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'reorder-suggestions'] });
    },
  });
}
