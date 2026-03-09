import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useMrfList,
  useMrf,
  useCreateMrf,
  useUpdateMrf,
  useSubmitMrf,
  useReviewMrf,
  useApproveMrf,
  useCheckStockMrf,
  useConvertMirvMrf,
  useFulfillMrf,
  useRejectMrf,
  useCancelMrf,
} from './useMrf';

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

describe('useMrfList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/mrf`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'mrf-1', formNumber: 'MRF-2026-00001', status: 'draft' },
            { id: 'mrf-2', formNumber: 'MRF-2026-00002', status: 'submitted' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches MRF list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrfList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].formNumber).toBe('MRF-2026-00001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrfList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/mrf/:id`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, formNumber: 'MRF-2026-00001', status: 'draft' } }),
      ),
    );
  });

  it('fetches a single MRF by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrf('mrf-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrf-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrf(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'mrf-new', ...(body as object), status: 'draft' } });
      }),
    );
  });

  it('creates a new MRF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateMrf(), { wrapper });

    act(() => {
      result.current.mutate({ projectId: 'proj-1' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrf-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/mrf/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an MRF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateMrf(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mrf-1', notes: 'Updated' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mrf-1');
  });
});

// ############################################################################
// STATUS TRANSITIONS
// ############################################################################

describe('useSubmitMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf/:id/submit`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'submitted' } }),
      ),
    );
  });

  it('submits an MRF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitMrf(), { wrapper });

    act(() => {
      result.current.mutate('mrf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('submitted');
  });
});

describe('useReviewMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf/:id/review`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'reviewed' } }),
      ),
    );
  });

  it('reviews an MRF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReviewMrf(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mrf-1' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('reviewed');
  });
});

describe('useApproveMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf/:id/approve`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'approved' } }),
      ),
    );
  });

  it('approves an MRF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveMrf(), { wrapper });

    act(() => {
      result.current.mutate('mrf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('approved');
  });
});

describe('useCheckStockMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf/:id/check-stock`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'stock_checked' } }),
      ),
    );
  });

  it('checks stock for an MRF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCheckStockMrf(), { wrapper });

    act(() => {
      result.current.mutate('mrf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('stock_checked');
  });
});

describe('useConvertMirvMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf/:id/convert-mirv`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'converted_mirv' } }),
      ),
    );
  });

  it('converts MRF to MIRV and invalidates both queries', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useConvertMirvMrf(), { wrapper });

    act(() => {
      result.current.mutate('mrf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mrf']);
    expect(invalidatedKeys).toContainEqual(['mirv']);

    invalidateSpy.mockRestore();
  });
});

describe('useFulfillMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf/:id/fulfill`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'fulfilled' } }),
      ),
    );
  });

  it('fulfills an MRF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFulfillMrf(), { wrapper });

    act(() => {
      result.current.mutate('mrf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('fulfilled');
  });
});

describe('useRejectMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf/:id/reject`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'rejected' } }),
      ),
    );
  });

  it('rejects an MRF with reason', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRejectMrf(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mrf-1', reason: 'Insufficient budget' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('rejected');
  });
});

describe('useCancelMrf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mrf/:id/cancel`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'cancelled' } }),
      ),
    );
  });

  it('cancels an MRF', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelMrf(), { wrapper });

    act(() => {
      result.current.mutate('mrf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('cancelled');
  });
});
