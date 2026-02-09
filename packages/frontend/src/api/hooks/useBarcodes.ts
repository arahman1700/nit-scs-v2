import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Lookup Item by Barcode/Code ─────────────────────────────────────────────
export function useBarcodeLookup(code: string | undefined) {
  return useQuery({
    queryKey: ['barcode', 'lookup', code],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/barcodes/lookup/${code}`);
      return data;
    },
    enabled: !!code,
  });
}

// ── Print Labels (POST) ────────────────────────────────────────────────────
export function usePrintLabels() {
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { data } = await apiClient.post<string>(
        '/barcodes/print-labels',
        { itemIds },
        {
          responseType: 'text',
        },
      );
      return data;
    },
  });
}
