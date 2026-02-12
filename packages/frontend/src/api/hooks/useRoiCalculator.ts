import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ───────────────────────────────────────────────────────────────

export interface RoiInput {
  monthlyOrders: number;
  warehouseWorkers: number;
  avgPickTimeMinutes: number;
  currentAccuracyPercent: number;
  avgShippingCostPerOrder: number;
  avgInventoryValue: number;
  currentShrinkagePercent: number;
}

export interface RoiResult {
  laborSavingsMonthly: number;
  accuracyImprovement: number;
  timeSavingsHoursMonthly: number;
  shippingCostReduction: number;
  shrinkageReduction: number;
  totalMonthlySavings: number;
  annualSavings: number;
  roiMonths: number;
  breakdown: {
    laborPercent: number;
    shippingPercent: number;
    shrinkagePercent: number;
  };
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useCalculateRoi() {
  return useMutation({
    mutationFn: async (input: RoiInput) => {
      const { data } = await apiClient.post<ApiResponse<RoiResult>>('/roi-calculator/calculate', input);
      return data;
    },
  });
}
