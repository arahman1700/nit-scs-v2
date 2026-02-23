import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useSscList,
  useSsc,
  useCreateSsc,
  useUpdateSsc,
  useDeleteSsc,
  useAcceptBid,
  useRejectBid,
  useSignMemo,
  useNotifyFinance,
} from './useSsc';

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
    http.get(`${API}/ssc`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'ssc-1',
            formNumber: 'SSC-2026-00001',
            status: 'pending_bids',
            scrapType: 'metal',
            estimatedValue: 50000,
            createdAt: '2026-02-01T10:00:00Z',
          },
          {
            id: 'ssc-2',
            formNumber: 'SSC-2026-00002',
            status: 'bid_accepted',
            scrapType: 'cable',
            estimatedValue: 30000,
            createdAt: '2026-02-02T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/ssc/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: {
          id: params.id,
          formNumber: 'SSC-2026-00001',
          status: 'pending_bids',
          scrapType: 'metal',
          estimatedValue: 50000,
        },
      });
    }),

    // Create
    http.post(`${API}/ssc`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'ssc-new', ...(body as object), status: 'draft' },
      });
    }),

    // Update
    http.put(`${API}/ssc/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.id, ...(body as object) },
      });
    }),

    // Delete
    http.delete(`${API}/ssc/:id`, () => {
      return new HttpResponse(null, { status: 204 });
    }),

    // Accept bid
    http.post(`${API}/ssc/:id/accept`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'bid_accepted' },
      });
    }),

    // Reject bid
    http.post(`${API}/ssc/:id/reject`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'bid_rejected' },
      });
    }),

    // Sign memo
    http.post(`${API}/ssc/:id/sign-memo`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'memo_signed' },
      });
    }),

    // Notify finance
    http.post(`${API}/ssc/:id/notify-finance`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'finance_notified' },
      });
    }),
  );
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useSscList', () => {
  it('fetches SSC list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSscList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('ssc-1');
    expect(data.data[0].formNumber).toBe('SSC-2026-00001');
    expect(data.data[0].status).toBe('pending_bids');
    expect(data.data[1].id).toBe('ssc-2');
    expect(data.data[1].status).toBe('bid_accepted');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSscList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useSsc', () => {
  it('fetches a single SSC by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSsc('ssc-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ssc-1');
    expect(data.data.formNumber).toBe('SSC-2026-00001');
    expect(data.data.status).toBe('pending_bids');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSsc(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateSsc', () => {
  it('creates a new SSC with draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateSsc(), { wrapper });

    act(() => {
      result.current.mutate({
        scrapType: 'metal',
        estimatedValue: 50000,
        warehouseId: 'wh-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ssc-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.scrapType).toBe('metal');
    expect(data.data.estimatedValue).toBe(50000);
  });
});

// ── Update ───────────────────────────────────────────────────────────────────
describe('useUpdateSsc', () => {
  it('updates an existing SSC', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateSsc(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'ssc-1',
        estimatedValue: 75000,
        notes: 'Updated estimate',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ssc-1');
    expect(data.data.estimatedValue).toBe(75000);
    expect(data.data.notes).toBe('Updated estimate');
  });
});

// ── Delete ───────────────────────────────────────────────────────────────────
describe('useDeleteSsc', () => {
  it('deletes an SSC record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteSsc(), { wrapper });

    act(() => {
      result.current.mutate('ssc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // useDeleteSsc returns void (no data) since it's a 204 response
  });

  it('invalidates ssc queries after deletion', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useDeleteSsc(), { wrapper });

    act(() => {
      result.current.mutate('ssc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['ssc']);

    invalidateSpy.mockRestore();
  });
});

// ── Accept Bid ───────────────────────────────────────────────────────────────
describe('useAcceptBid', () => {
  it('transitions SSC to bid_accepted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAcceptBid(), { wrapper });

    act(() => {
      result.current.mutate('ssc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ssc-1');
    expect(data.data.status).toBe('bid_accepted');
  });
});

// ── Reject Bid ───────────────────────────────────────────────────────────────
describe('useRejectBid', () => {
  it('transitions SSC to bid_rejected status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRejectBid(), { wrapper });

    act(() => {
      result.current.mutate('ssc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ssc-1');
    expect(data.data.status).toBe('bid_rejected');
  });
});

// ── Sign Memo ────────────────────────────────────────────────────────────────
describe('useSignMemo', () => {
  it('transitions SSC to memo_signed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSignMemo(), { wrapper });

    act(() => {
      result.current.mutate('ssc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ssc-1');
    expect(data.data.status).toBe('memo_signed');
  });
});

// ── Notify Finance ───────────────────────────────────────────────────────────
describe('useNotifyFinance', () => {
  it('transitions SSC to finance_notified status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNotifyFinance(), { wrapper });

    act(() => {
      result.current.mutate('ssc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ssc-1');
    expect(data.data.status).toBe('finance_notified');
  });

  it('invalidates ssc queries on finance notification', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useNotifyFinance(), { wrapper });

    act(() => {
      result.current.mutate('ssc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['ssc']);

    invalidateSpy.mockRestore();
  });
});
