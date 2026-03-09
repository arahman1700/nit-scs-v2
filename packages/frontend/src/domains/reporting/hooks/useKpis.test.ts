import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useKpis, useKpisByCategory } from './useKpis';

const API = '/api/v1';

const storage: Record<string, string> = {};
const mockStorage = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
  }),
  get length() {
    return Object.keys(storage).length;
  },
  key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
};
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true });

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockKpiResult = { value: 95, trend: 2.5, label: 'Test KPI', unit: '%' };

// ############################################################################
// ALL KPIs
// ############################################################################

describe('useKpis', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/kpis`, () =>
        HttpResponse.json({
          success: true,
          data: {
            inventory: {
              inventoryTurnover: { value: 4.2, trend: 0.3, label: 'Inventory Turnover', unit: 'x' },
              stockAccuracy: { value: 98, trend: 1, label: 'Stock Accuracy', unit: '%' },
              deadStock: { value: 2, trend: -0.5, label: 'Dead Stock', unit: '%' },
              warehouseUtilization: { value: 72, trend: 3, label: 'Warehouse Utilization', unit: '%' },
            },
            procurement: {
              grnProcessingTime: { value: 2.1, trend: -0.3, label: 'GRN Processing Time', unit: 'days' },
              supplierOnTimeDelivery: { value: 88, trend: 2, label: 'Supplier On-Time Delivery', unit: '%' },
              poFulfillmentRate: { value: 92, trend: 1.5, label: 'PO Fulfillment Rate', unit: '%' },
            },
            logistics: {
              joCompletionRate: { value: 85, trend: 1, label: 'JO Completion Rate', unit: '%' },
              joAvgResponseTime: { value: 4, trend: -1, label: 'JO Avg Response Time', unit: 'hours' },
              gatePassTurnaround: { value: 30, trend: -5, label: 'Gate Pass Turnaround', unit: 'min' },
            },
            quality: {
              qciPassRate: mockKpiResult,
              drResolutionTime: mockKpiResult,
              ncrRate: mockKpiResult,
            },
            financial: {
              pendingApprovalValue: mockKpiResult,
              monthlySpend: mockKpiResult,
            },
          },
        }),
      ),
    );
  });

  it('fetches all comprehensive KPIs', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useKpis(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data.inventory.inventoryTurnover.value).toBe(4.2);
    expect(data.procurement.grnProcessingTime.value).toBe(2.1);
    expect(data.logistics.joCompletionRate.value).toBe(85);
    expect(data.quality).toBeDefined();
    expect(data.financial).toBeDefined();
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useKpis(), { wrapper });
    expect(result.current).toBeDefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('accepts optional date range parameters', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useKpis('2026-01-01', '2026-03-31'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.inventory).toBeDefined();
  });

  it('returns trend data for each KPI', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useKpis(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const turnover = result.current.data!.data.inventory.inventoryTurnover;
    expect(turnover.trend).toBe(0.3);
    expect(turnover.unit).toBe('x');
    expect(turnover.label).toBe('Inventory Turnover');
  });
});

// ############################################################################
// KPIs BY CATEGORY
// ############################################################################

describe('useKpisByCategory', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/kpis/:category`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            [`${params.category}Kpi1`]: { value: 90, trend: 1.5, label: 'KPI 1', unit: '%' },
            [`${params.category}Kpi2`]: { value: 85, trend: -2, label: 'KPI 2', unit: '%' },
          },
        }),
      ),
    );
  });

  it('fetches KPIs filtered by category', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useKpisByCategory('inventory'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data).toBeDefined();
    expect(Object.keys(data).length).toBeGreaterThan(0);
  });

  it('accepts date range parameters', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useKpisByCategory('procurement', '2026-01-01', '2026-03-31'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.success).toBe(true);
  });

  it('renders without crashing for all categories', async () => {
    const wrapper = createWrapper();
    const categories = ['inventory', 'procurement', 'logistics', 'quality', 'financial'] as const;

    for (const category of categories) {
      const { result } = renderHook(() => useKpisByCategory(category), { wrapper: createWrapper() });
      expect(result.current).toBeDefined();
    }
  });
});
