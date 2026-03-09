import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useRfimList, useRfim, useUpdateRfim, useStartRfim, useCompleteRfim } from './useRfim';

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

describe('useRfimList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/rfim`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'rfim-1', formNumber: 'RFIM-2026-00001', status: 'pending' },
            { id: 'rfim-2', formNumber: 'RFIM-2026-00002', status: 'in_progress' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches RFIM list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRfimList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].formNumber).toBe('RFIM-2026-00001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRfimList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useRfim', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/rfim/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, formNumber: 'RFIM-2026-00001', status: 'pending' },
        }),
      ),
    );
  });

  it('fetches a single RFIM by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRfim('rfim-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('rfim-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRfim(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateRfim', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/rfim/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an RFIM', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateRfim(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rfim-1', inspectionResult: 'pass' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('rfim-1');
  });
});

// ############################################################################
// START
// ############################################################################

describe('useStartRfim', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/rfim/:id/start`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'in_progress' } }),
      ),
    );
  });

  it('starts an RFIM inspection', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStartRfim(), { wrapper });

    act(() => {
      result.current.mutate('rfim-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('in_progress');
  });
});

// ############################################################################
// COMPLETE
// ############################################################################

describe('useCompleteRfim', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/rfim/:id/complete`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'completed' } }),
      ),
    );
  });

  it('completes an RFIM inspection', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteRfim(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rfim-1', overallResult: 'pass' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('completed');
  });

  it('invalidates both rfim and mrrv queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCompleteRfim(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rfim-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['rfim']);
    expect(invalidatedKeys).toContainEqual(['mrrv']);

    invalidateSpy.mockRestore();
  });
});
