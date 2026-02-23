import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useDemandForecast, useTopDemandItems, useReorderAlerts, useSeasonalPatterns } from './useDemandForecast';

// Mock localStorage for axios request interceptor (client.ts reads token)
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

// ── Mock Data ───────────────────────────────────────────────────────────────

const mockForecasts = [
  {
    itemId: 'item-1',
    itemCode: 'ITEM-001',
    itemName: 'Steel Rod',
    historicalMonthly: [{ month: '2026-01', quantity: 100 }],
    forecastMonthly: [{ month: '2026-03', quantity: 120, confidence: 'high' }],
    avgMonthlyDemand: 110,
    trend: 'increasing',
    trendSlope: 2.5,
    suggestedReorderPoint: 50,
    currentStock: 80,
    reorderAlert: false,
  },
];

const mockTopDemand = [
  {
    itemId: 'item-2',
    itemCode: 'ITEM-002',
    itemName: 'Copper Wire',
    historicalMonthly: [{ month: '2026-01', quantity: 500 }],
    forecastMonthly: [{ month: '2026-03', quantity: 550, confidence: 'medium' }],
    avgMonthlyDemand: 520,
    trend: 'stable',
    trendSlope: 0.3,
    suggestedReorderPoint: 200,
    currentStock: 300,
    reorderAlert: false,
  },
];

const mockAlerts = [
  {
    itemId: 'item-3',
    itemCode: 'ITEM-003',
    itemName: 'Cement Bags',
    historicalMonthly: [{ month: '2026-01', quantity: 200 }],
    forecastMonthly: [{ month: '2026-03', quantity: 210, confidence: 'low' }],
    avgMonthlyDemand: 205,
    trend: 'increasing',
    trendSlope: 1.1,
    suggestedReorderPoint: 100,
    currentStock: 30,
    reorderAlert: true,
  },
];

const mockPatterns = [
  {
    itemId: 'item-1',
    itemCode: 'ITEM-001',
    itemName: 'Steel Rod',
    seasonalIndices: [
      { month: 1, index: 0.8, label: 'Jan' },
      { month: 6, index: 1.4, label: 'Jun' },
    ],
    seasonalityStrength: 0.72,
    peakMonth: 'Jun',
    troughMonth: 'Jan',
  },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/demand-forecast`, () => HttpResponse.json({ success: true, data: mockForecasts })),
    http.get(`${API}/demand-forecast/top-demand`, () => HttpResponse.json({ success: true, data: mockTopDemand })),
    http.get(`${API}/demand-forecast/reorder-alerts`, () => HttpResponse.json({ success: true, data: mockAlerts })),
    http.get(`${API}/demand-forecast/seasonal`, () => HttpResponse.json({ success: true, data: mockPatterns })),
  );
});

// ── Demand Forecast Tests ───────────────────────────────────────────────────

describe('useDemandForecast', () => {
  it('does not fetch when both warehouseId and itemId are undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDemandForecast(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches forecast when warehouseId is provided', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDemandForecast('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].itemCode).toBe('ITEM-001');
    expect(result.current.data?.data[0].trend).toBe('increasing');
    expect(result.current.data?.data[0].avgMonthlyDemand).toBe(110);
  });
});

// ── Top Demand Items Tests ──────────────────────────────────────────────────

describe('useTopDemandItems', () => {
  it('does not fetch when warehouseId is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopDemandItems(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches top demand items for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopDemandItems('wh-1', 10), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].itemName).toBe('Copper Wire');
    expect(result.current.data?.data[0].avgMonthlyDemand).toBe(520);
  });
});

// ── Reorder Alerts Tests ────────────────────────────────────────────────────

describe('useReorderAlerts', () => {
  it('fetches reorder alerts for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReorderAlerts('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].reorderAlert).toBe(true);
    expect(result.current.data?.data[0].currentStock).toBe(30);
    expect(result.current.data?.data[0].suggestedReorderPoint).toBe(100);
  });
});

// ── Seasonal Patterns Tests ─────────────────────────────────────────────────

describe('useSeasonalPatterns', () => {
  it('fetches seasonal patterns for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSeasonalPatterns('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].peakMonth).toBe('Jun');
    expect(result.current.data?.data[0].troughMonth).toBe('Jan');
    expect(result.current.data?.data[0].seasonalityStrength).toBe(0.72);
    expect(result.current.data?.data[0].seasonalIndices).toHaveLength(2);
  });
});
