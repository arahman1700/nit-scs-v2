import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useMrvList, useMrv, useCreateMrv, useUpdateMrv, useSubmitMrv, useReceiveMrv, useCompleteMrv } from './useMrv';

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

describe('useMrvList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/mrv`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'mrv-1', formNumber: 'MRV-2026-00001', status: 'draft' },
            { id: 'mrv-2', formNumber: 'MRV-2026-00002', status: 'submitted' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches MRV list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrvList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].formNumber).toBe('MRV-2026-00001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrvList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useMrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/mrv/:id`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, formNumber: 'MRV-2026-00001', status: 'draft' } }),
      ),
    );
  });

  it('fetches a single MRV by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrv('mrv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrv-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrv(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateMrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrv`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'mrv-new', ...(body as object), status: 'draft' } });
      }),
    );
  });

  it('creates a new MRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateMrv(), { wrapper });

    act(() => {
      result.current.mutate({ warehouseId: 'wh-1', mirvId: 'mirv-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrv-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateMrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/mrv/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an MRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateMrv(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mrv-1', notes: 'Updated' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrv-1');
  });
});

// ############################################################################
// SUBMIT
// ############################################################################

describe('useSubmitMrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrv/:id/submit`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'submitted' } }),
      ),
    );
  });

  it('submits an MRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitMrv(), { wrapper });

    act(() => {
      result.current.mutate('mrv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('submitted');
  });
});

// ############################################################################
// RECEIVE
// ############################################################################

describe('useReceiveMrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrv/:id/receive`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'received' } }),
      ),
    );
  });

  it('receives an MRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReceiveMrv(), { wrapper });

    act(() => {
      result.current.mutate('mrv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('received');
  });
});

// ############################################################################
// COMPLETE
// ############################################################################

describe('useCompleteMrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrv/:id/complete`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'completed' } }),
      ),
    );
  });

  it('completes an MRV and invalidates inventory', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCompleteMrv(), { wrapper });

    act(() => {
      result.current.mutate('mrv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('completed');

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mrv']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});
