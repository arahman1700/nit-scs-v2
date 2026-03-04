import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExpiringLot {
  id: string;
  lotNumber: string;
  expiryDate: string | null;
  availableQty: number;
  binLocation: string | null;
  warehouse: {
    id: string;
    warehouseName: string;
    warehouseCode: string;
  };
}

export interface ExpiringItemGroup {
  item: {
    id: string;
    itemCode: string;
    itemDescription: string;
    category: string;
  };
  lots: ExpiringLot[];
  totalQty: number;
}

export interface ExpiringLotsResponse {
  data: ExpiringItemGroup[];
  meta: {
    daysAhead: number;
    totalItems: number;
    totalLots: number;
    asOf: string;
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useExpiringLots(daysAhead?: number) {
  return useQuery({
    queryKey: ['inventory', 'expiring', daysAhead],
    queryFn: async () => {
      const params = daysAhead ? { daysAhead } : undefined;
      const { data } = await apiClient.get<ExpiringLotsResponse>('/inventory/expiring', { params });
      return data;
    },
  });
}
