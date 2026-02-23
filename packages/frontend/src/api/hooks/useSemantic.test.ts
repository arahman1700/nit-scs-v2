import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useSemanticCatalog,
  useSemanticMeasures,
  useSemanticDimensions,
  useCompatibleDimensions,
  useSemanticQuery,
} from './useSemantic';

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

const mockMeasure = {
  id: 'sm-1',
  key: 'total_grn_value',
  name: 'Total GRN Value',
  description: null,
  category: 'inventory',
  entityType: 'mrrv',
  aggregation: 'SUM',
  field: 'totalAmount',
  defaultFilters: null,
  unit: 'SAR',
  isActive: true,
};

const mockDimension = {
  id: 'sd-1',
  key: 'warehouse',
  name: 'Warehouse',
  description: null,
  entityTypes: ['mrrv', 'mirv'],
  field: 'warehouseId',
  dimensionType: 'categorical',
  hierarchy: null,
  isActive: true,
};

const mockCatalog = { inventory: [mockMeasure] };

beforeEach(() => {
  server.use(
    http.get(`${API}/semantic/catalog`, () => HttpResponse.json({ success: true, data: mockCatalog })),
    http.get(`${API}/semantic/measures/:measureKey/dimensions`, () =>
      HttpResponse.json({ success: true, data: [mockDimension] }),
    ),
    http.get(`${API}/semantic/measures`, () => HttpResponse.json({ success: true, data: [mockMeasure] })),
    http.get(`${API}/semantic/dimensions`, () => HttpResponse.json({ success: true, data: [mockDimension] })),
    http.post(`${API}/semantic/query`, () =>
      HttpResponse.json({
        success: true,
        data: {
          measure: { key: 'total_grn_value', name: 'Total GRN Value', aggregation: 'SUM' },
          dimensions: [{ key: 'warehouse', field: 'warehouseId' }],
          data: [{ warehouseId: 'wh-1', value: 150000 }],
        },
      }),
    ),
  );
});

describe('useSemanticCatalog', () => {
  it('fetches semantic catalog grouped by category', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSemanticCatalog(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveProperty('inventory');
    expect(result.current.data?.data.inventory).toHaveLength(1);
    expect(result.current.data?.data.inventory[0].key).toBe('total_grn_value');
  });
});

describe('useSemanticMeasures', () => {
  it('fetches semantic measures with category filter', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSemanticMeasures('inventory'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].aggregation).toBe('SUM');
  });
});

describe('useSemanticDimensions', () => {
  it('fetches semantic dimensions with entity type filter', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSemanticDimensions('mrrv'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].dimensionType).toBe('categorical');
  });
});

describe('useCompatibleDimensions', () => {
  it('fetches compatible dimensions for a measure', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompatibleDimensions('total_grn_value'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].key).toBe('warehouse');
  });
});

describe('useSemanticQuery', () => {
  it('executes a semantic query mutation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSemanticQuery(), { wrapper });

    act(() => {
      result.current.mutate({ measure: 'total_grn_value', dimensions: ['warehouse'] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.measure.key).toBe('total_grn_value');
    expect(result.current.data?.data.data).toHaveLength(1);
  });
});
