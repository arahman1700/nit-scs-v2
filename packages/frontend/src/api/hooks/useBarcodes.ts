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

// ── Print GRN Labels ────────────────────────────────────────────────────────
export function useGrnLabels() {
  return useMutation({
    mutationFn: async (grnId: string) => {
      const { data } = await apiClient.post<string>(
        `/barcodes/print-labels/grn/${grnId}`,
        {},
        { responseType: 'text' },
      );
      return data;
    },
  });
}

// ── Print Bin QR Labels ─────────────────────────────────────────────────────
export function useBinQrLabels() {
  return useMutation({
    mutationFn: async (params: { binCardIds?: string[]; warehouseId?: string; zoneId?: string }) => {
      const { data } = await apiClient.post<string>('/barcodes/print-labels/bins', params, { responseType: 'text' });
      return data;
    },
  });
}

// ── Lookup Bin by Scanned QR Code ───────────────────────────────────────────
export function useBinLookup(code: string | undefined) {
  return useQuery({
    queryKey: ['barcode', 'bin-lookup', code],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/barcodes/lookup/bin/${encodeURIComponent(code!)}`);
      return data;
    },
    enabled: !!code,
  });
}
