import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useWtList,
  useWt,
  useCreateWt,
  useUpdateWt,
  useSubmitWt,
  useApproveWt,
  useShipWt,
  useReceiveWt,
  useCompleteWt,
  useCancelWt,
} from './useWt';

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

// ── useWtList ────────────────────────────────────────────────────────────────

describe('useWtList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/wt`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'wt-1',
              formNumber: 'WT-2026-00001',
              status: 'draft',
              fromWarehouseId: 'wh-1',
              toWarehouseId: 'wh-2',
              createdAt: '2026-01-20T10:00:00Z',
            },
            {
              id: 'wt-2',
              formNumber: 'WT-2026-00002',
              status: 'submitted',
              fromWarehouseId: 'wh-1',
              toWarehouseId: 'wh-3',
              createdAt: '2026-01-21T10:00:00Z',
            },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches WT list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWtList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('wt-1');
    expect(data.data[0].formNumber).toBe('WT-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('wt-2');
    expect(data.data[1].status).toBe('submitted');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWtList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── useWt ────────────────────────────────────────────────────────────────────

describe('useWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/wt/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            formNumber: 'WT-2026-00001',
            status: 'draft',
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-2',
          },
        }),
      ),
    );
  });

  it('fetches a single WT by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWt('wt-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-1');
    expect(data.data.formNumber).toBe('WT-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWt(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── useCreateWt ──────────────────────────────────────────────────────────────

describe('useCreateWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/wt`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'wt-new', ...(body as object), status: 'draft' },
        });
      }),
    );
  });

  it('creates a new WT and returns draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateWt(), { wrapper });

    act(() => {
      result.current.mutate({
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        projectId: 'proj-1',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.fromWarehouseId).toBe('wh-1');
    expect(data.data.toWarehouseId).toBe('wh-2');
  });
});

// ── useUpdateWt ──────────────────────────────────────────────────────────────

describe('useUpdateWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/wt/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object), formNumber: 'WT-2026-00001' },
        });
      }),
    );
  });

  it('updates an existing WT', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateWt(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'wt-1',
        notes: 'Updated transfer notes',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-1');
    expect(data.data.notes).toBe('Updated transfer notes');
  });
});

// ── useSubmitWt ──────────────────────────────────────────────────────────────

describe('useSubmitWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/wt/:id/submit`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'submitted' } }),
      ),
    );
  });

  it('transitions WT to submitted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-1');
    expect(data.data.status).toBe('submitted');
  });
});

// ── useApproveWt ─────────────────────────────────────────────────────────────

describe('useApproveWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/wt/:id/approve`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'approved' } }),
      ),
    );
  });

  it('transitions WT to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-1');
    expect(data.data.status).toBe('approved');
  });
});

// ── useShipWt ────────────────────────────────────────────────────────────────

describe('useShipWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/wt/:id/ship`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'shipped' } }),
      ),
    );
  });

  it('transitions WT to shipped status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useShipWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-1');
    expect(data.data.status).toBe('shipped');
  });

  it('invalidates both wt and inventory queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useShipWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['wt']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});

// ── useReceiveWt ─────────────────────────────────────────────────────────────

describe('useReceiveWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/wt/:id/receive`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'received' } }),
      ),
    );
  });

  it('transitions WT to received status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReceiveWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-1');
    expect(data.data.status).toBe('received');
  });

  it('invalidates both wt and inventory queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useReceiveWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['wt']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});

// ── useCompleteWt ────────────────────────────────────────────────────────────

describe('useCompleteWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/wt/:id/complete`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'completed' } }),
      ),
    );
  });

  it('transitions WT to completed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-1');
    expect(data.data.status).toBe('completed');
  });

  it('invalidates both wt and inventory queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCompleteWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['wt']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});

// ── useCancelWt ──────────────────────────────────────────────────────────────

describe('useCancelWt', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/wt/:id/cancel`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'cancelled' } }),
      ),
    );
  });

  it('transitions WT to cancelled status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelWt(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wt-1');
    expect(data.data.status).toBe('cancelled');
  });
});
