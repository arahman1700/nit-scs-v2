import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useSurplusList,
  useSurplus,
  useCreateSurplus,
  useUpdateSurplus,
  useEvaluateSurplus,
  useApproveSurplus,
  useActionSurplus,
  useCloseSurplus,
} from './useSurplus';

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
    http.get(`${API}/surplus`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'surplus-1',
            formNumber: 'SUR-2026-00001',
            status: 'draft',
            itemDescription: 'Surplus Pipe',
            qty: 100,
            createdAt: '2026-02-01T10:00:00Z',
          },
          {
            id: 'surplus-2',
            formNumber: 'SUR-2026-00002',
            status: 'evaluated',
            itemDescription: 'Surplus Valve',
            qty: 50,
            createdAt: '2026-02-02T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/surplus/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: {
          id: params.id,
          formNumber: 'SUR-2026-00001',
          status: 'draft',
          itemDescription: 'Surplus Pipe',
          qty: 100,
        },
      });
    }),

    // Create
    http.post(`${API}/surplus`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'surplus-new', ...(body as object), status: 'draft' },
      });
    }),

    // Update
    http.put(`${API}/surplus/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.id, ...(body as object) },
      });
    }),

    // Evaluate
    http.post(`${API}/surplus/:id/evaluate`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'evaluated' },
      });
    }),

    // Approve
    http.post(`${API}/surplus/:id/approve`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'approved' },
      });
    }),

    // Action
    http.post(`${API}/surplus/:id/action`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'actioned' },
      });
    }),

    // Close
    http.post(`${API}/surplus/:id/close`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'closed' },
      });
    }),
  );
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useSurplusList', () => {
  it('fetches surplus list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSurplusList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('surplus-1');
    expect(data.data[0].formNumber).toBe('SUR-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('surplus-2');
    expect(data.data[1].status).toBe('evaluated');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSurplusList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useSurplus', () => {
  it('fetches a single surplus item by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSurplus('surplus-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('surplus-1');
    expect(data.data.formNumber).toBe('SUR-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSurplus(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateSurplus', () => {
  it('creates a new surplus item with draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateSurplus(), { wrapper });

    act(() => {
      result.current.mutate({
        itemDescription: 'Surplus Bolt',
        qty: 200,
        warehouseId: 'wh-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('surplus-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.itemDescription).toBe('Surplus Bolt');
    expect(data.data.qty).toBe(200);
  });
});

// ── Update ───────────────────────────────────────────────────────────────────
describe('useUpdateSurplus', () => {
  it('updates an existing surplus item', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateSurplus(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'surplus-1',
        qty: 150,
        notes: 'Revised quantity',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('surplus-1');
    expect(data.data.qty).toBe(150);
    expect(data.data.notes).toBe('Revised quantity');
  });
});

// ── Evaluate ─────────────────────────────────────────────────────────────────
describe('useEvaluateSurplus', () => {
  it('transitions surplus to evaluated status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEvaluateSurplus(), { wrapper });

    act(() => {
      result.current.mutate('surplus-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('surplus-1');
    expect(data.data.status).toBe('evaluated');
  });
});

// ── Approve ──────────────────────────────────────────────────────────────────
describe('useApproveSurplus', () => {
  it('transitions surplus to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveSurplus(), { wrapper });

    act(() => {
      result.current.mutate('surplus-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('surplus-1');
    expect(data.data.status).toBe('approved');
  });
});

// ── Action ───────────────────────────────────────────────────────────────────
describe('useActionSurplus', () => {
  it('transitions surplus to actioned status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useActionSurplus(), { wrapper });

    act(() => {
      result.current.mutate('surplus-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('surplus-1');
    expect(data.data.status).toBe('actioned');
  });
});

// ── Close ────────────────────────────────────────────────────────────────────
describe('useCloseSurplus', () => {
  it('transitions surplus to closed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCloseSurplus(), { wrapper });

    act(() => {
      result.current.mutate('surplus-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('surplus-1');
    expect(data.data.status).toBe('closed');
  });

  it('invalidates surplus queries on close', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCloseSurplus(), { wrapper });

    act(() => {
      result.current.mutate('surplus-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['surplus']);

    invalidateSpy.mockRestore();
  });
});
