import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useHandoverList,
  useHandover,
  useCreateHandover,
  useUpdateHandover,
  useStartHandoverVerification,
  useCompleteHandover,
} from './useHandovers';

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
    http.get(`${API}/handovers`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'ho-1',
            formNumber: 'HO-2026-00001',
            status: 'draft',
            fromStorekeeperId: 'emp-1',
            toStorekeeperId: 'emp-2',
            warehouseId: 'wh-1',
            createdAt: '2026-02-01T10:00:00Z',
          },
          {
            id: 'ho-2',
            formNumber: 'HO-2026-00002',
            status: 'verifying',
            fromStorekeeperId: 'emp-3',
            toStorekeeperId: 'emp-4',
            warehouseId: 'wh-2',
            createdAt: '2026-02-02T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/handovers/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: {
          id: params.id,
          formNumber: 'HO-2026-00001',
          status: 'draft',
          fromStorekeeperId: 'emp-1',
          toStorekeeperId: 'emp-2',
          warehouseId: 'wh-1',
        },
      });
    }),

    // Create
    http.post(`${API}/handovers`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'ho-new', ...(body as object), status: 'draft' },
      });
    }),

    // Update
    http.put(`${API}/handovers/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.id, ...(body as object) },
      });
    }),

    // Start verification
    http.post(`${API}/handovers/:id/start-verification`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'verifying' },
      });
    }),

    // Complete
    http.post(`${API}/handovers/:id/complete`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'completed' },
      });
    }),
  );
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useHandoverList', () => {
  it('fetches handover list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useHandoverList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('ho-1');
    expect(data.data[0].formNumber).toBe('HO-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('ho-2');
    expect(data.data[1].status).toBe('verifying');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useHandoverList({ page: 1, limit: 5 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useHandover', () => {
  it('fetches a single handover by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useHandover('ho-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ho-1');
    expect(data.data.formNumber).toBe('HO-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useHandover(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateHandover', () => {
  it('creates a new handover with draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateHandover(), { wrapper });

    act(() => {
      result.current.mutate({
        fromStorekeeperId: 'emp-1',
        toStorekeeperId: 'emp-2',
        warehouseId: 'wh-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ho-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.fromStorekeeperId).toBe('emp-1');
    expect(data.data.toStorekeeperId).toBe('emp-2');
  });
});

// ── Update ───────────────────────────────────────────────────────────────────
describe('useUpdateHandover', () => {
  it('updates an existing handover', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateHandover(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'ho-1',
        notes: 'Updated handover notes',
        toStorekeeperId: 'emp-5',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ho-1');
    expect(data.data.notes).toBe('Updated handover notes');
    expect(data.data.toStorekeeperId).toBe('emp-5');
  });
});

// ── Start Verification ───────────────────────────────────────────────────────
describe('useStartHandoverVerification', () => {
  it('transitions handover to verifying status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStartHandoverVerification(), { wrapper });

    act(() => {
      result.current.mutate('ho-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ho-1');
    expect(data.data.status).toBe('verifying');
  });
});

// ── Complete ─────────────────────────────────────────────────────────────────
describe('useCompleteHandover', () => {
  it('transitions handover to completed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteHandover(), { wrapper });

    act(() => {
      result.current.mutate('ho-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ho-1');
    expect(data.data.status).toBe('completed');
  });

  it('invalidates handovers queries on completion', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCompleteHandover(), { wrapper });

    act(() => {
      result.current.mutate('ho-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['handovers']);

    invalidateSpy.mockRestore();
  });
});
