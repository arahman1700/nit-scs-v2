import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DockDoor {
  id: string;
  warehouseId: string;
  doorNumber: string;
  doorType: 'inbound' | 'outbound' | 'both';
  status: 'available' | 'occupied' | 'maintenance';
  createdAt: string;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  truckVisits?: Array<{ id: string; vehiclePlate: string; driverName: string | null; checkInAt: string }>;
}

export interface YardAppointment {
  id: string;
  warehouseId: string;
  dockDoorId: string | null;
  appointmentType: 'delivery' | 'pickup' | 'transfer';
  scheduledStart: string;
  scheduledEnd: string;
  carrierName: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
  referenceType: string | null;
  referenceId: string | null;
  status: 'scheduled' | 'checked_in' | 'loading' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  createdAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  dockDoor?: { id: string; doorNumber: string; doorType: string; status: string } | null;
}

export interface TruckVisit {
  id: string;
  warehouseId: string;
  dockDoorId: string | null;
  vehiclePlate: string;
  driverName: string | null;
  carrierName: string | null;
  purpose: 'delivery' | 'pickup' | 'transfer';
  checkInAt: string;
  checkOutAt: string | null;
  status: 'in_yard' | 'at_dock' | 'departed';
  notes: string | null;
  createdAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  dockDoor?: { id: string; doorNumber: string; doorType: string } | null;
}

export interface YardStatus {
  dockDoors: Array<
    DockDoor & {
      truckVisits: Array<{ id: string; vehiclePlate: string; driverName: string | null; checkInAt: string }>;
    }
  >;
  activeTrucks: TruckVisit[];
  todayAppointments: YardAppointment[];
  summary: {
    totalDocks: number;
    occupiedDocks: number;
    availableDocks: number;
    maintenanceDocks: number;
    trucksInYard: number;
    appointmentsToday: number;
    upcomingAppointments: number;
  };
}

export interface DockUtilization {
  date: string;
  dockMetrics: Array<{
    id: string;
    doorNumber: string;
    doorType: string;
    status: string;
    appointmentCount: number;
    visitCount: number;
    completedCount: number;
    avgDwellMinutes: number;
  }>;
  summary: {
    totalDocks: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    totalTruckVisits: number;
    utilizationRate: number;
  };
}

// ############################################################################
// DOCK DOORS
// ############################################################################

export function useDockDoorList(params?: ListParams & { warehouseId?: string; status?: string }) {
  return useQuery({
    queryKey: ['yard', 'dock-doors', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DockDoor[]>>('/yard/dock-doors', { params });
      return data;
    },
  });
}

export function useDockDoor(id: string | undefined) {
  return useQuery({
    queryKey: ['yard', 'dock-doors', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DockDoor>>(`/yard/dock-doors/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useAvailableDockDoors(warehouseId: string | undefined, doorType?: string) {
  return useQuery({
    queryKey: ['yard', 'dock-doors', 'available', warehouseId, doorType],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DockDoor[]>>('/yard/dock-doors/available', {
        params: { warehouseId, doorType },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}

export function useCreateDockDoor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<DockDoor>>('/yard/dock-doors', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

export function useUpdateDockDoor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put<ApiResponse<DockDoor>>(`/yard/dock-doors/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

export function useDeleteDockDoor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<unknown>>(`/yard/dock-doors/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

// ############################################################################
// APPOINTMENTS
// ############################################################################

export function useAppointmentList(params?: ListParams & { warehouseId?: string; status?: string; date?: string }) {
  return useQuery({
    queryKey: ['yard', 'appointments', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<YardAppointment[]>>('/yard/appointments', { params });
      return data;
    },
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: ['yard', 'appointments', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<YardAppointment>>(`/yard/appointments/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<YardAppointment>>('/yard/appointments', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

export function useCheckInAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<YardAppointment>>(`/yard/appointments/${id}/check-in`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

export function useCompleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<YardAppointment>>(`/yard/appointments/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<YardAppointment>>(`/yard/appointments/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

// ############################################################################
// TRUCK VISITS
// ############################################################################

export function useTruckVisitList(params?: ListParams & { warehouseId?: string; status?: string }) {
  return useQuery({
    queryKey: ['yard', 'trucks', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TruckVisit[]>>('/yard/trucks', { params });
      return data;
    },
  });
}

export function useCheckInTruck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<TruckVisit>>('/yard/trucks/check-in', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

export function useAssignDock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ truckId, dockDoorId }: { truckId: string; dockDoorId: string }) => {
      const { data } = await apiClient.post<ApiResponse<TruckVisit>>(`/yard/trucks/${truckId}/assign-dock`, {
        dockDoorId,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

export function useCheckOutTruck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<TruckVisit>>(`/yard/trucks/${id}/check-out`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yard'] }),
  });
}

// ############################################################################
// YARD STATUS & UTILIZATION
// ############################################################################

export function useYardStatus(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['yard', 'status', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<YardStatus>>('/yard/status', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
    refetchInterval: 30_000, // Refresh every 30 seconds for live yard view
  });
}

export function useDockUtilization(warehouseId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['yard', 'utilization', warehouseId, date],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DockUtilization>>('/yard/utilization', {
        params: { warehouseId, date },
      });
      return data;
    },
    enabled: !!warehouseId && !!date,
  });
}
