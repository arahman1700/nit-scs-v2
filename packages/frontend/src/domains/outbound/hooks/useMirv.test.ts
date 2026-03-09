import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useMirvList,
  useMirv,
  useCreateMirv,
  useUpdateMirv,
  useSubmitMirv,
  useApproveMirv,
  useIssueMirv,
  useCancelMirv,
} from './useMirv';

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

describe('useMirvList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/mirv`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'mirv-1', formNumber: 'MIRV-2026-00001', status: 'draft' },
            { id: 'mirv-2', formNumber: 'MIRV-2026-00002', status: 'approved' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches MIRV list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMirvList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].formNumber).toBe('MIRV-2026-00001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMirvList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useMirv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/mirv/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, formNumber: 'MIRV-2026-00001', status: 'draft' },
        }),
      ),
    );
  });

  it('fetches a single MIRV by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMirv('mirv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mirv-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMirv(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateMirv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mirv`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'mirv-new', ...(body as object), status: 'draft' } });
      }),
    );
  });

  it('creates a new MIRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateMirv(), { wrapper });

    act(() => {
      result.current.mutate({ warehouseId: 'wh-1', projectId: 'proj-1' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mirv-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateMirv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/mirv/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an existing MIRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateMirv(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mirv-1', notes: 'Updated' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('mirv-1');
  });
});

// ############################################################################
// SUBMIT
// ############################################################################

describe('useSubmitMirv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mirv/:id/submit`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'submitted' } }),
      ),
    );
  });

  it('submits a MIRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitMirv(), { wrapper });

    act(() => {
      result.current.mutate('mirv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('submitted');
  });
});

// ############################################################################
// APPROVE
// ############################################################################

describe('useApproveMirv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mirv/:id/approve`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'approved' } }),
      ),
    );
  });

  it('approves a MIRV and invalidates inventory', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useApproveMirv(), { wrapper });

    act(() => {
      result.current.mutate('mirv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('approved');

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mirv']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// ISSUE
// ############################################################################

describe('useIssueMirv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mirv/:id/issue`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'issued' } }),
      ),
    );
  });

  it('issues a MIRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useIssueMirv(), { wrapper });

    act(() => {
      result.current.mutate('mirv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('issued');
  });
});

// ############################################################################
// CANCEL
// ############################################################################

describe('useCancelMirv', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/mirv/:id/cancel`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'cancelled' } }),
      ),
    );
  });

  it('cancels a MIRV', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelMirv(), { wrapper });

    act(() => {
      result.current.mutate('mirv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('cancelled');
  });
});
