import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useMrrvList,
  useMrrv,
  useCreateMrrv,
  useUpdateMrrv,
  useSubmitMrrv,
  useApproveQcMrrv,
  useReceiveMrrv,
  useStoreMrrv,
} from './useMrrv';

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

describe('useMrrvList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/mrrv`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'mrrv-1', formNumber: 'MRRV-2026-00001', status: 'draft' },
            { id: 'mrrv-2', formNumber: 'MRRV-2026-00002', status: 'submitted' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches MRRV list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrrvList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].formNumber).toBe('MRRV-2026-00001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrrvList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useMrrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/mrrv/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, formNumber: 'MRRV-2026-00001', status: 'draft' },
        }),
      ),
    );
  });

  it('fetches a single MRRV by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrrv('mrrv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrrv-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrrv(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateMrrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrrv`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'mrrv-new', ...(body as object), status: 'draft' } });
      }),
    );
  });

  it('creates a new MRRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateMrrv(), { wrapper });

    act(() => {
      result.current.mutate({ supplierId: 'sup-1', warehouseId: 'wh-1' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrrv-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateMrrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/mrrv/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an existing MRRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateMrrv(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mrrv-1', notes: 'Updated' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrrv-1');
  });
});

// ############################################################################
// SUBMIT
// ############################################################################

describe('useSubmitMrrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrrv/:id/submit`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'submitted' } }),
      ),
    );
  });

  it('submits an MRRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitMrrv(), { wrapper });

    act(() => {
      result.current.mutate('mrrv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('submitted');
  });
});

// ############################################################################
// APPROVE QC
// ############################################################################

describe('useApproveQcMrrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrrv/:id/approve-qc`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'qc_approved' } }),
      ),
    );
  });

  it('approves QC for an MRRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveQcMrrv(), { wrapper });

    act(() => {
      result.current.mutate('mrrv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('qc_approved');
  });
});

// ############################################################################
// RECEIVE
// ############################################################################

describe('useReceiveMrrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrrv/:id/receive`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'received' } }),
      ),
    );
  });

  it('receives an MRRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReceiveMrrv(), { wrapper });

    act(() => {
      result.current.mutate('mrrv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('received');
  });
});

// ############################################################################
// STORE
// ############################################################################

describe('useStoreMrrv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrrv/:id/store`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'stored' } }),
      ),
    );
  });

  it('stores an MRRV and invalidates inventory', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useStoreMrrv(), { wrapper });

    act(() => {
      result.current.mutate('mrrv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data.status).toBe('stored');
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mrrv']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});
