import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useAmcList, useAmc, useCreateAmc, useUpdateAmc, useActivateAmc, useTerminateAmc } from './useAmc';

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

describe('useAmcList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/amc`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'amc-1', contractNumber: 'AMC-001', status: 'active', coverageType: 'comprehensive' },
            { id: 'amc-2', contractNumber: 'AMC-002', status: 'draft', coverageType: 'parts_only' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches AMC list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAmcList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].contractNumber).toBe('AMC-001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAmcList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useAmc', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/amc/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, contractNumber: 'AMC-001', status: 'active' },
        }),
      ),
    );
  });

  it('fetches a single AMC by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAmc('amc-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('amc-1');
    expect(result.current.data!.data.contractNumber).toBe('AMC-001');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAmc(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateAmc', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/amc`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'amc-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new AMC', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateAmc(), { wrapper });

    act(() => {
      result.current.mutate({ contractNumber: 'AMC-003', supplierId: 'sup-1', coverageType: 'comprehensive' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('amc-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateAmc', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/amc/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an existing AMC', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateAmc(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'amc-1', notes: 'Updated notes' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('amc-1');
    expect(result.current.data!.data.notes).toBe('Updated notes');
  });
});

// ############################################################################
// ACTIVATE
// ############################################################################

describe('useActivateAmc', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/amc/:id/activate`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'active' },
        }),
      ),
    );
  });

  it('activates an AMC', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useActivateAmc(), { wrapper });

    act(() => {
      result.current.mutate('amc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('active');
  });
});

// ############################################################################
// TERMINATE
// ############################################################################

describe('useTerminateAmc', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/amc/:id/terminate`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'terminated' },
        }),
      ),
    );
  });

  it('terminates an AMC with reason', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTerminateAmc(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'amc-1', reason: 'Contract expired' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('terminated');
  });

  it('invalidates amc queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useTerminateAmc(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'amc-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['amc']);

    invalidateSpy.mockRestore();
  });
});
