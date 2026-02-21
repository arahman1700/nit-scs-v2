import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { Shipment, CustomsTracking } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useShipmentList(params?: ListParams) {
  return useQuery({
    queryKey: ['shipments', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Shipment[]>>('/shipments', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: ['shipments', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Shipment>>(`/shipments/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Shipment>) => {
      const { data } = await apiClient.post<ApiResponse<Shipment>>('/shipments', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Shipment> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<Shipment>>(`/shipments/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// ── Update Status ───────────────────────────────────────────────────────────
export function useUpdateShipmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; status: Shipment['status']; notes?: string }) => {
      const { data } = await apiClient.put<ApiResponse<Shipment>>(`/shipments/${id}/status`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// ── Customs Stage ───────────────────────────────────────────────────────────
export function useAddCustomsStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<CustomsTracking> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<CustomsTracking>>(`/shipments/${id}/customs`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

export function useUpdateCustomsStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, customsId, ...body }: Partial<CustomsTracking> & { id: string; customsId: string }) => {
      const { data } = await apiClient.put<ApiResponse<CustomsTracking>>(`/shipments/${id}/customs/${customsId}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// ── Deliver ─────────────────────────────────────────────────────────────────
export function useDeliverShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<Shipment>>(`/shipments/${id}/deliver`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] });
      qc.invalidateQueries({ queryKey: ['mrrv'] });
    },
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────
export function useCancelShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<Shipment>>(`/shipments/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
}
