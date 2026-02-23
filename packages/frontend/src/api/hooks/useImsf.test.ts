import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useImsfList,
  useImsf,
  useCreateImsf,
  useUpdateImsf,
  useSendImsf,
  useConfirmImsf,
  useShipImsf,
  useDeliverImsf,
  useCompleteImsf,
} from './useImsf';

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
    http.get(`${API}/imsf`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'imsf-1',
            formNumber: 'IMSF-2026-00001',
            status: 'draft',
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-2',
            createdAt: '2026-02-01T10:00:00Z',
          },
          {
            id: 'imsf-2',
            formNumber: 'IMSF-2026-00002',
            status: 'sent',
            fromWarehouseId: 'wh-3',
            toWarehouseId: 'wh-4',
            createdAt: '2026-02-02T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/imsf/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: {
          id: params.id,
          formNumber: 'IMSF-2026-00001',
          status: 'draft',
          fromWarehouseId: 'wh-1',
          toWarehouseId: 'wh-2',
        },
      });
    }),

    // Create
    http.post(`${API}/imsf`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'imsf-new', ...(body as object), status: 'draft' },
      });
    }),

    // Update
    http.put(`${API}/imsf/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.id, ...(body as object) },
      });
    }),

    // Send
    http.post(`${API}/imsf/:id/send`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'sent' },
      });
    }),

    // Confirm
    http.post(`${API}/imsf/:id/confirm`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'confirmed' },
      });
    }),

    // Ship
    http.post(`${API}/imsf/:id/ship`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'shipped' },
      });
    }),

    // Deliver
    http.post(`${API}/imsf/:id/deliver`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'delivered' },
      });
    }),

    // Complete
    http.post(`${API}/imsf/:id/complete`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'completed' },
      });
    }),
  );
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useImsfList', () => {
  it('fetches IMSF list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useImsfList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('imsf-1');
    expect(data.data[0].formNumber).toBe('IMSF-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('imsf-2');
    expect(data.data[1].status).toBe('sent');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useImsfList({ page: 2, limit: 5 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useImsf', () => {
  it('fetches a single IMSF by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useImsf('imsf-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('imsf-1');
    expect(data.data.formNumber).toBe('IMSF-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useImsf(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateImsf', () => {
  it('creates a new IMSF with draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateImsf(), { wrapper });

    act(() => {
      result.current.mutate({
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        projectId: 'proj-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('imsf-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.fromWarehouseId).toBe('wh-1');
    expect(data.data.toWarehouseId).toBe('wh-2');
  });
});

// ── Update ───────────────────────────────────────────────────────────────────
describe('useUpdateImsf', () => {
  it('updates an existing IMSF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateImsf(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'imsf-1',
        notes: 'Updated IMSF notes',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('imsf-1');
    expect(data.data.notes).toBe('Updated IMSF notes');
  });
});

// ── Send ─────────────────────────────────────────────────────────────────────
describe('useSendImsf', () => {
  it('transitions IMSF to sent status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSendImsf(), { wrapper });

    act(() => {
      result.current.mutate('imsf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('imsf-1');
    expect(data.data.status).toBe('sent');
  });
});

// ── Confirm ──────────────────────────────────────────────────────────────────
describe('useConfirmImsf', () => {
  it('transitions IMSF to confirmed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useConfirmImsf(), { wrapper });

    act(() => {
      result.current.mutate('imsf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('imsf-1');
    expect(data.data.status).toBe('confirmed');
  });
});

// ── Ship ─────────────────────────────────────────────────────────────────────
describe('useShipImsf', () => {
  it('transitions IMSF to shipped status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useShipImsf(), { wrapper });

    act(() => {
      result.current.mutate('imsf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('imsf-1');
    expect(data.data.status).toBe('shipped');
  });
});

// ── Deliver ──────────────────────────────────────────────────────────────────
describe('useDeliverImsf', () => {
  it('transitions IMSF to delivered status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeliverImsf(), { wrapper });

    act(() => {
      result.current.mutate('imsf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('imsf-1');
    expect(data.data.status).toBe('delivered');
  });
});

// ── Complete ─────────────────────────────────────────────────────────────────
describe('useCompleteImsf', () => {
  it('transitions IMSF to completed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteImsf(), { wrapper });

    act(() => {
      result.current.mutate('imsf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('imsf-1');
    expect(data.data.status).toBe('completed');
  });

  it('invalidates imsf queries on completion', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCompleteImsf(), { wrapper });

    act(() => {
      result.current.mutate('imsf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['imsf']);

    invalidateSpy.mockRestore();
  });
});
