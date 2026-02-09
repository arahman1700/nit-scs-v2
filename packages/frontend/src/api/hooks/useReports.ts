import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  projectId?: string;
  warehouseId?: string;
}

/** GET /api/reports/inventory-summary */
export function useInventoryReport(filters?: ReportFilters, enabled = false) {
  return useQuery({
    queryKey: ['reports', 'inventory-summary', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>('/reports/inventory-summary', { params: filters });
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** GET /api/reports/job-order-status */
export function useJobOrderReport(filters?: ReportFilters, enabled = false) {
  return useQuery({
    queryKey: ['reports', 'job-order-status', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>('/reports/job-order-status', { params: filters });
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** GET /api/reports/sla-compliance */
export function useSlaReport(filters?: ReportFilters, enabled = false) {
  return useQuery({
    queryKey: ['reports', 'sla-compliance', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>('/reports/sla-compliance', { params: filters });
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** GET /api/reports/material-movement */
export function useMaterialMovementReport(filters?: ReportFilters, enabled = false) {
  return useQuery({
    queryKey: ['reports', 'material-movement', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>('/reports/material-movement', { params: filters });
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** GET /api/reports/supplier-performance */
export function useSupplierPerformanceReport(filters?: ReportFilters, enabled = false) {
  return useQuery({
    queryKey: ['reports', 'supplier-performance', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>('/reports/supplier-performance', { params: filters });
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** GET /api/reports/financial-summary */
export function useFinancialReport(filters?: ReportFilters, enabled = false) {
  return useQuery({
    queryKey: ['reports', 'financial-summary', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>('/reports/financial-summary', { params: filters });
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}
