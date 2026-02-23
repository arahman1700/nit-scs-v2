import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useGeneratorFuelList,
  useGeneratorFuel,
  useCreateGeneratorFuel,
  useUpdateGeneratorFuel,
} from './useGeneratorFuel';

const API = '/api/v1';

// Ensure localStorage works in the jsdom environment
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
// LIST
// ############################################################################

describe('useGeneratorFuelList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/generator-fuel`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'fuel-1', generatorId: 'gen-1', fuelType: 'diesel', quantityLiters: 200, date: '2026-02-20' },
            { id: 'fuel-2', generatorId: 'gen-2', fuelType: 'diesel', quantityLiters: 150, date: '2026-02-21' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches generator fuel list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeneratorFuelList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('fuel-1');
    expect(data.data[0].generatorId).toBe('gen-1');
    expect(data.data[0].quantityLiters).toBe(200);
    expect(data.data[1].id).toBe('fuel-2');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeneratorFuelList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useGeneratorFuel', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/generator-fuel/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, generatorId: 'gen-1', fuelType: 'diesel', quantityLiters: 200, date: '2026-02-20' },
        }),
      ),
    );
  });

  it('fetches a single generator fuel record by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeneratorFuel('fuel-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('fuel-1');
    expect(data.data.generatorId).toBe('gen-1');
    expect(data.data.fuelType).toBe('diesel');
    expect(data.data.quantityLiters).toBe(200);
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeneratorFuel(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateGeneratorFuel', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/generator-fuel`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'fuel-new', ...(body as object) },
        });
      }),
    );
  });

  it('creates a new generator fuel record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateGeneratorFuel(), { wrapper });

    act(() => {
      result.current.mutate({ generatorId: 'gen-3', fuelType: 'diesel', quantityLiters: 300, date: '2026-02-22' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('fuel-new');
    expect(data.data.generatorId).toBe('gen-3');
    expect(data.data.quantityLiters).toBe(300);
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateGeneratorFuel', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/generator-fuel/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object) },
        });
      }),
    );
  });

  it('updates an existing generator fuel record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateGeneratorFuel(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'fuel-1', quantityLiters: 250, notes: 'Adjusted reading' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('fuel-1');
    expect(data.data.quantityLiters).toBe(250);
    expect(data.data.notes).toBe('Adjusted reading');
  });
});
