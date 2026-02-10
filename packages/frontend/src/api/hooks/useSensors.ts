import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Sensor {
  id: string;
  sensorCode: string;
  sensorType: string;
  warehouseId: string;
  zoneId: string | null;
  location: string | null;
  minThreshold: number | null;
  maxThreshold: number | null;
  unit: string;
  isActive: boolean;
  lastReadingAt: string | null;
  lastValue: number | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  zone?: { id: string; zoneName: string; zoneCode: string; zoneType?: string } | null;
  _count?: { alerts: number; readings?: number };
}

export interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  recordedAt: string;
}

export interface SensorAlert {
  id: string;
  sensorId: string;
  alertType: 'threshold_high' | 'threshold_low' | 'offline';
  value: number | null;
  threshold: number | null;
  message: string;
  acknowledged: boolean;
  acknowledgedById: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  sensor?: {
    id: string;
    sensorCode: string;
    sensorType: string;
    unit: string;
    location: string | null;
    warehouse?: { id: string; warehouseName: string };
    zone?: { id: string; zoneName: string; zoneCode: string } | null;
  };
}

export interface ZoneHeatmapEntry {
  id: string;
  zoneName: string;
  zoneCode: string;
  zoneType: string;
  avgTemperature: number | null;
  avgHumidity: number | null;
}

// ── List Sensors ───────────────────────────────────────────────────────────

export function useSensorList(params?: {
  warehouseId?: string;
  sensorType?: string;
  isActive?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ['sensors', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Sensor[]>>('/sensors', { params });
      return data;
    },
  });
}

// ── Get Single Sensor ──────────────────────────────────────────────────────

export function useSensor(id: string | undefined) {
  return useQuery({
    queryKey: ['sensors', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Sensor>>(`/sensors/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create Sensor ──────────────────────────────────────────────────────────

export function useCreateSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<Sensor>>('/sensors', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sensors'] }),
  });
}

// ── Update Sensor ──────────────────────────────────────────────────────────

export function useUpdateSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<Sensor>>(`/sensors/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sensors'] }),
  });
}

// ── Delete Sensor ──────────────────────────────────────────────────────────

export function useDeleteSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/sensors/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sensors'] }),
  });
}

// ── Ingest Reading ─────────────────────────────────────────────────────────

export function useIngestReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { sensorId: string; value: number }) => {
      const { data } = await apiClient.post<ApiResponse<SensorReading>>('/sensors/readings', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sensors'] });
      qc.invalidateQueries({ queryKey: ['sensor-readings'] });
      qc.invalidateQueries({ queryKey: ['sensor-alerts'] });
    },
  });
}

// ── Get Readings ───────────────────────────────────────────────────────────

export function useSensorReadings(sensorId: string | undefined, from?: string, to?: string) {
  return useQuery({
    queryKey: ['sensor-readings', sensorId, from, to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await apiClient.get<ApiResponse<SensorReading[]>>(`/sensors/readings/${sensorId}`, { params });
      return data;
    },
    enabled: !!sensorId,
  });
}

// ── Get Alerts ─────────────────────────────────────────────────────────────

export function useSensorAlerts(warehouseId?: string, acknowledged?: boolean) {
  return useQuery({
    queryKey: ['sensor-alerts', warehouseId, acknowledged],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (warehouseId) params.warehouseId = warehouseId;
      if (acknowledged !== undefined) params.acknowledged = String(acknowledged);
      const { data } = await apiClient.get<ApiResponse<SensorAlert[]>>('/sensors/alerts', { params });
      return data;
    },
    refetchInterval: 30_000, // Refresh alerts every 30 seconds
  });
}

// ── Acknowledge Alert ──────────────────────────────────────────────────────

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data } = await apiClient.post<ApiResponse<SensorAlert>>(`/sensors/alerts/${alertId}/acknowledge`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sensor-alerts'] });
      qc.invalidateQueries({ queryKey: ['sensors'] });
    },
  });
}

// ── Sensor Status (all sensors in a warehouse) ─────────────────────────────

export function useSensorStatus(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['sensors', 'status', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Sensor[]>>(`/sensors/status/${warehouseId}`);
      return data;
    },
    enabled: !!warehouseId,
    refetchInterval: 60_000, // Refresh every minute
  });
}

// ── Zone Heatmap ───────────────────────────────────────────────────────────

export function useZoneHeatmap(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['sensors', 'heatmap', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ZoneHeatmapEntry[]>>(`/sensors/heatmap/${warehouseId}`);
      return data;
    },
    enabled: !!warehouseId,
    refetchInterval: 60_000,
  });
}
