import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RouteStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'warehouse' | 'project';
}

export interface OptimizedRouteStop extends RouteStop {
  stopOrder: number;
  distanceFromPrev: number;
  cumulativeDistance: number;
}

export interface OptimizedRoute {
  origin: RouteStop;
  stops: OptimizedRouteStop[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  estimatedFuelLiters: number;
}

export interface UndeliveredJO {
  id: string;
  joNumber: string;
  joType: string;
  status: string;
  description: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  latitude: number | null;
  longitude: number | null;
}

export interface FuelEstimate {
  fuelLiters: number;
  totalCost: number;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch undelivered JOs for a given warehouse.
 */
export function useUndeliveredJOs(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['route-optimizer', 'undelivered', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<UndeliveredJO[]>>('/route-optimizer/undelivered', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}

/**
 * Optimize the delivery route for selected JOs.
 */
export function useOptimizeRoute() {
  return useMutation({
    mutationFn: async (body: { warehouseId: string; joIds: string[] }) => {
      const { data } = await apiClient.post<ApiResponse<OptimizedRoute>>('/route-optimizer/optimize', body);
      return data;
    },
  });
}

/**
 * Estimate fuel cost for a given distance and price.
 */
export function useEstimateFuel() {
  return useMutation({
    mutationFn: async (body: { distanceKm: number; fuelPrice: number }) => {
      const { data } = await apiClient.post<ApiResponse<FuelEstimate>>('/route-optimizer/estimate-fuel', body);
      return data;
    },
  });
}
