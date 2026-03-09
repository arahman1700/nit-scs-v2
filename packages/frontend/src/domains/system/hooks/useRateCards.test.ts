import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useRateCardList, useRateCard, useCreateRateCard, useUpdateRateCard, useRateCardLookup } from './useRateCards';

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

describe('useRateCardList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/rate-cards`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'rc-1', supplierId: 'sup-1', equipmentTypeId: 'et-1', dailyRate: 500, status: 'active' },
            { id: 'rc-2', supplierId: 'sup-2', equipmentTypeId: 'et-2', dailyRate: 750, status: 'active' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches rate card list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRateCardList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].dailyRate).toBe(500);
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRateCardList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useRateCard', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/rate-cards/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, supplierId: 'sup-1', dailyRate: 500, status: 'active' },
        }),
      ),
    );
  });

  it('fetches a single rate card', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRateCard('rc-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('rc-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRateCard(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateRateCard', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/rate-cards`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'rc-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new rate card', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateRateCard(), { wrapper });

    act(() => {
      result.current.mutate({ supplierId: 'sup-1', equipmentTypeId: 'et-1', dailyRate: 600 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('rc-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateRateCard', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/rate-cards/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a rate card', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateRateCard(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rc-1', dailyRate: 550 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('rc-1');
    expect(result.current.data!.data.dailyRate).toBe(550);
  });

  it('invalidates rate-cards queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useUpdateRateCard(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rc-1', dailyRate: 550 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['rate-cards']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// LOOKUP
// ############################################################################

describe('useRateCardLookup', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/rate-cards/lookup`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 'rc-1', supplierId: 'sup-1', equipmentTypeId: 'et-1', dailyRate: 500, status: 'active' },
        }),
      ),
    );
  });

  it('looks up a rate card by supplier and equipment type', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRateCardLookup('sup-1', 'et-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.dailyRate).toBe(500);
  });

  it('does not fetch when supplierId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRateCardLookup(undefined, 'et-1'), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });

  it('does not fetch when equipmentTypeId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRateCardLookup('sup-1', undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});
