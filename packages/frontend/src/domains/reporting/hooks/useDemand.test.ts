import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useItemConsumptionTrend, useTopConsumptionItems, useReorderSuggestions, useItemForecast } from './useDemand';

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

// ############################################################################
// ITEM CONSUMPTION TREND
// ############################################################################

describe('useItemConsumptionTrend', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/demand/trends/:itemId`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            itemId: params.itemId,
            itemCode: 'ITM-001',
            itemDescription: 'Cement',
            months: [
              { month: '2026-01', totalQty: 100, totalValue: 5000, issueCount: 10 },
              { month: '2026-02', totalQty: 120, totalValue: 6000, issueCount: 12 },
            ],
            averageMonthly: 110,
            trend: 'increasing',
          },
        }),
      ),
    );
  });

  it('fetches consumption trend for an item', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemConsumptionTrend('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data.itemCode).toBe('ITM-001');
    expect(data.months).toHaveLength(2);
    expect(data.averageMonthly).toBe(110);
    expect(data.trend).toBe('increasing');
  });

  it('does not fetch when itemId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemConsumptionTrend(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemConsumptionTrend('item-1'), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// TOP CONSUMPTION ITEMS
// ############################################################################

describe('useTopConsumptionItems', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/demand/top-items`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              rank: 1,
              itemId: 'item-1',
              itemCode: 'ITM-001',
              itemDescription: 'Cement',
              totalQty: 500,
              totalValue: 25000,
              issueCount: 50,
            },
            {
              rank: 2,
              itemId: 'item-2',
              itemCode: 'ITM-002',
              itemDescription: 'Steel',
              totalQty: 300,
              totalValue: 60000,
              issueCount: 30,
            },
          ],
        }),
      ),
    );
  });

  it('fetches top consumption items', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopConsumptionItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data).toHaveLength(2);
    expect(data[0].rank).toBe(1);
    expect(data[0].itemCode).toBe('ITM-001');
  });

  it('accepts optional parameters', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopConsumptionItems('wh-1', 6, 10), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// REORDER SUGGESTIONS
// ############################################################################

describe('useReorderSuggestions', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/demand/reorder-suggestions`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              itemId: 'item-1',
              itemCode: 'ITM-001',
              description: 'Cement',
              currentStock: 20,
              avgMonthlyConsumption: 100,
              reorderPoint: 50,
              suggestedQty: 200,
              urgency: 'critical',
              daysUntilStockout: 6,
            },
            {
              itemId: 'item-2',
              itemCode: 'ITM-002',
              description: 'Steel',
              currentStock: 100,
              avgMonthlyConsumption: 50,
              reorderPoint: 80,
              suggestedQty: 100,
              urgency: 'soon',
              daysUntilStockout: 60,
            },
          ],
        }),
      ),
    );
  });

  it('fetches reorder suggestions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReorderSuggestions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data).toHaveLength(2);
    expect(data[0].urgency).toBe('critical');
    expect(data[0].daysUntilStockout).toBe(6);
  });

  it('accepts optional warehouseId', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReorderSuggestions('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// ITEM FORECAST
// ############################################################################

describe('useItemForecast', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/demand/forecast/:itemId`, () =>
        HttpResponse.json({
          success: true,
          data: {
            current: 150,
            forecast: [
              { month: '2026-04', projectedConsumption: 100, projectedEndStock: 50 },
              { month: '2026-05', projectedConsumption: 110, projectedEndStock: -60 },
            ],
            reorderRecommended: true,
          },
        }),
      ),
    );
  });

  it('fetches forecast for an item', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemForecast('item-1', 'wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data.current).toBe(150);
    expect(data.forecast).toHaveLength(2);
    expect(data.reorderRecommended).toBe(true);
  });

  it('does not fetch when itemId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemForecast(undefined, 'wh-1'), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });

  it('does not fetch when warehouseId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemForecast('item-1', undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemForecast('item-1', 'wh-1'), { wrapper });
    expect(result.current).toBeDefined();
  });
});
