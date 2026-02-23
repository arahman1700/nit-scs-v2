import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useCalculateRoi } from './useRoiCalculator';

const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(),
    get length() {
      return Object.keys(storage).length;
    },
    key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
  },
  writable: true,
});

const API = '/api/v1';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockRoiResult = {
  laborSavingsMonthly: 5000,
  accuracyImprovement: 3.5,
  timeSavingsHoursMonthly: 120,
  shippingCostReduction: 2000,
  shrinkageReduction: 1500,
  totalMonthlySavings: 8500,
  annualSavings: 102000,
  roiMonths: 8,
  breakdown: { laborPercent: 58.8, shippingPercent: 23.5, shrinkagePercent: 17.6 },
};

beforeEach(() => {
  server.use(
    http.post(`${API}/roi-calculator/calculate`, () => HttpResponse.json({ success: true, data: mockRoiResult })),
  );
});

describe('useCalculateRoi', () => {
  it('calculates ROI and returns result', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCalculateRoi(), { wrapper });

    act(() => {
      result.current.mutate({
        monthlyOrders: 500,
        warehouseWorkers: 10,
        avgPickTimeMinutes: 8,
        currentAccuracyPercent: 95,
        avgShippingCostPerOrder: 25,
        avgInventoryValue: 500000,
        currentShrinkagePercent: 2,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.annualSavings).toBe(102000);
    expect(result.current.data?.data.roiMonths).toBe(8);
    expect(result.current.data?.data.breakdown.laborPercent).toBe(58.8);
  });
});
