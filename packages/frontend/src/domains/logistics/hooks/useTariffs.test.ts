import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useTariffRateList,
  useTariffRate,
  useCreateTariffRate,
  useUpdateTariffRate,
  useCalculateDuties,
  useApplyDuties,
} from './useTariffs';

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
// LIST
// ############################################################################

describe('useTariffRateList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/tariffs/tariff-rates`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'tr-1', hsCode: '7308.90', description: 'Steel structures', dutyRate: 5, vatRate: 15, country: 'SA' },
            { id: 'tr-2', hsCode: '8544.49', description: 'Electric cables', dutyRate: 12, vatRate: 15, country: 'SA' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches tariff rate list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTariffRateList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].hsCode).toBe('7308.90');
    expect(result.current.data!.data[0].dutyRate).toBe(5);
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTariffRateList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useTariffRate', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/tariffs/tariff-rates/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, hsCode: '7308.90', description: 'Steel structures', dutyRate: 5, vatRate: 15 },
        }),
      ),
    );
  });

  it('fetches a single tariff rate', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTariffRate('tr-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('tr-1');
    expect(result.current.data!.data.hsCode).toBe('7308.90');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTariffRate(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateTariffRate', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/tariffs/tariff-rates`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'tr-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new tariff rate', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateTariffRate(), { wrapper });

    act(() => {
      result.current.mutate({
        hsCode: '3901.10',
        description: 'Polyethylene',
        dutyRate: 5,
        vatRate: 15,
        country: 'SA',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('tr-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateTariffRate', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/tariffs/tariff-rates/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a tariff rate', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateTariffRate(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'tr-1', dutyRate: 8 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('tr-1');
    expect(result.current.data!.data.dutyRate).toBe(8);
  });
});

// ############################################################################
// CALCULATE DUTIES
// ############################################################################

describe('useCalculateDuties', () => {
  it('does not auto-fetch (enabled: false)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCalculateDuties('ship-1'), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCalculateDuties('ship-1'), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// APPLY DUTIES
// ############################################################################

describe('useApplyDuties', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/tariffs/tariff-rates/apply/:shipmentId`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            shipmentId: params.shipmentId,
            shipmentNumber: 'SHP-001',
            lineBreakdown: [],
            totalDuties: 5000,
            totalVat: 3000,
            grandTotal: 8000,
          },
        }),
      ),
    );
  });

  it('applies duties to a shipment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApplyDuties(), { wrapper });

    act(() => {
      result.current.mutate('ship-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.totalDuties).toBe(5000);
    expect(result.current.data!.data.grandTotal).toBe(8000);
  });

  it('invalidates both tariff-rates and shipments queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useApplyDuties(), { wrapper });

    act(() => {
      result.current.mutate('ship-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['tariff-rates']);
    expect(invalidatedKeys).toContainEqual(['shipments']);

    invalidateSpy.mockRestore();
  });
});
