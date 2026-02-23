import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useAsnList,
  useAsn,
  useCreateAsn,
  useUpdateAsn,
  useMarkInTransit,
  useMarkArrived,
  useReceiveAsn,
  useCancelAsn,
  useAsnVariance,
} from './useAsn';

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

beforeEach(() => {
  mockStorage.clear();
  vi.clearAllMocks();

  server.use(
    // List
    http.get(`${API}/asn`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'asn-1',
            asnNumber: 'ASN-2026-00001',
            status: 'draft',
            supplierId: 'sup-1',
            warehouseId: 'wh-1',
            createdAt: '2026-02-01T10:00:00Z',
          },
          {
            id: 'asn-2',
            asnNumber: 'ASN-2026-00002',
            status: 'in_transit',
            supplierId: 'sup-2',
            warehouseId: 'wh-2',
            createdAt: '2026-02-02T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/asn/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, asnNumber: 'ASN-2026-00001', status: 'draft', supplierId: 'sup-1', warehouseId: 'wh-1' },
      });
    }),

    // Create
    http.post(`${API}/asn`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'asn-new', ...(body as object), status: 'draft' },
      });
    }),

    // Update
    http.put(`${API}/asn/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.id, ...(body as object) },
      });
    }),

    // Mark In Transit
    http.post(`${API}/asn/:id/in-transit`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'in_transit' },
      });
    }),

    // Mark Arrived
    http.post(`${API}/asn/:id/arrived`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'arrived' },
      });
    }),

    // Receive
    http.post(`${API}/asn/:id/receive`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'received' },
      });
    }),

    // Cancel (DELETE)
    http.delete(`${API}/asn/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'cancelled' },
      });
    }),

    // Variance
    http.get(`${API}/asn/:id/variance`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { asnId: params.id, lines: [{ itemId: 'item-1', expected: 100, received: 95, variance: -5 }] },
      });
    }),
  );
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useAsnList', () => {
  it('fetches ASN list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsnList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('asn-1');
    expect(data.data[0].asnNumber).toBe('ASN-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('asn-2');
    expect(data.data[1].status).toBe('in_transit');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsnList({ page: 1, limit: 10, status: 'draft' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useAsn', () => {
  it('fetches a single ASN by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsn('asn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('asn-1');
    expect(data.data.asnNumber).toBe('ASN-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsn(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateAsn', () => {
  it('creates a new ASN with draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateAsn(), { wrapper });

    act(() => {
      result.current.mutate({ supplierId: 'sup-1', warehouseId: 'wh-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('asn-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.supplierId).toBe('sup-1');
    expect(data.data.warehouseId).toBe('wh-1');
  });
});

// ── Update ───────────────────────────────────────────────────────────────────
describe('useUpdateAsn', () => {
  it('updates an existing ASN', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateAsn(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'asn-1', notes: 'Updated notes' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('asn-1');
    expect(data.data.notes).toBe('Updated notes');
  });
});

// ── Mark In Transit ─────────────────────────────────────────────────────────
describe('useMarkInTransit', () => {
  it('transitions ASN to in_transit status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMarkInTransit(), { wrapper });

    act(() => {
      result.current.mutate('asn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('asn-1');
    expect(data.data.status).toBe('in_transit');
  });
});

// ── Mark Arrived ─────────────────────────────────────────────────────────────
describe('useMarkArrived', () => {
  it('transitions ASN to arrived status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMarkArrived(), { wrapper });

    act(() => {
      result.current.mutate('asn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('asn-1');
    expect(data.data.status).toBe('arrived');
  });
});

// ── Receive ASN ──────────────────────────────────────────────────────────────
describe('useReceiveAsn', () => {
  it('transitions ASN to received status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReceiveAsn(), { wrapper });

    act(() => {
      result.current.mutate('asn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('asn-1');
    expect(data.data.status).toBe('received');
  });

  it('invalidates both asn and grn queries on receive', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useReceiveAsn(), { wrapper });

    act(() => {
      result.current.mutate('asn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['asn']);
    expect(invalidatedKeys).toContainEqual(['grn']);

    invalidateSpy.mockRestore();
  });
});

// ── Cancel ASN ───────────────────────────────────────────────────────────────
describe('useCancelAsn', () => {
  it('cancels an ASN via DELETE', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelAsn(), { wrapper });

    act(() => {
      result.current.mutate('asn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('asn-1');
    expect(data.data.status).toBe('cancelled');
  });
});

// ── Variance Report ──────────────────────────────────────────────────────────
describe('useAsnVariance', () => {
  it('fetches variance report for an ASN', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsnVariance('asn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.asnId).toBe('asn-1');
    expect(data.data.lines).toBeInstanceOf(Array);
    expect(data.data.lines[0].variance).toBe(-5);
  });

  it('does not fetch variance when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsnVariance(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
