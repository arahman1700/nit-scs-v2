import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useAbcAnalysis, useAbcSummary, useRecalculateAbc } from './useAbcAnalysis';

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

const mockAbcItems = [
  {
    itemId: 'item-1',
    itemCode: 'ITM-001',
    itemDescription: 'Steel Pipe',
    annualConsumptionValue: 50000,
    cumulativePercent: 25,
    abcClass: 'A' as const,
  },
  {
    itemId: 'item-2',
    itemCode: 'ITM-002',
    itemDescription: 'Copper Wire',
    annualConsumptionValue: 30000,
    cumulativePercent: 55,
    abcClass: 'A' as const,
  },
  {
    itemId: 'item-3',
    itemCode: 'ITM-003',
    itemDescription: 'Bolts M10',
    annualConsumptionValue: 500,
    cumulativePercent: 98,
    abcClass: 'C' as const,
  },
];

const mockSummary = {
  classA: { count: 20, totalValue: 400000, percentOfItems: 20, percentOfValue: 80 },
  classB: { count: 30, totalValue: 75000, percentOfItems: 30, percentOfValue: 15 },
  classC: { count: 50, totalValue: 25000, percentOfItems: 50, percentOfValue: 5 },
  totalItems: 100,
  totalValue: 500000,
  lastCalculatedAt: '2026-02-20T10:00:00Z',
};

beforeEach(() => {
  server.use(
    http.get(`${API}/abc-analysis`, () => HttpResponse.json({ success: true, data: mockAbcItems })),
    http.get(`${API}/abc-analysis/summary`, () => HttpResponse.json({ success: true, data: mockSummary })),
    http.post(`${API}/abc-analysis/recalculate`, () =>
      HttpResponse.json({ success: true, data: { recalculated: true, itemsProcessed: 100 } }),
    ),
  );
});

describe('useAbcAnalysis', () => {
  it('fetches ABC analysis list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAbcAnalysis(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(3);
    expect(result.current.data?.data[0].abcClass).toBe('A');
    expect(result.current.data?.data[2].abcClass).toBe('C');
  });
});

describe('useAbcSummary', () => {
  it('fetches ABC summary statistics', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAbcSummary(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.totalItems).toBe(100);
    expect(result.current.data?.data.totalValue).toBe(500000);
    expect(result.current.data?.data.classA.percentOfValue).toBe(80);
  });
});

describe('useRecalculateAbc', () => {
  it('triggers ABC recalculation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRecalculateAbc(), { wrapper });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
