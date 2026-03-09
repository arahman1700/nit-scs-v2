import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useStockTransferList,
  useStockTransfer,
  useCreateStockTransfer,
  useUpdateStockTransfer,
  useSubmitStockTransfer,
  useApproveStockTransfer,
  useShipStockTransfer,
  useReceiveStockTransfer,
  useCompleteStockTransfer,
  useCancelStockTransfer,
} from './useStockTransfers';

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

describe('useStockTransferList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/stock-transfers`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'st-1', transferNumber: 'ST-001', status: 'draft', fromWarehouseId: 'wh-1', toWarehouseId: 'wh-2' },
            { id: 'st-2', transferNumber: 'ST-002', status: 'shipped', fromWarehouseId: 'wh-1', toWarehouseId: 'wh-3' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches stock transfer list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStockTransferList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].transferNumber).toBe('ST-001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStockTransferList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/stock-transfers/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, transferNumber: 'ST-001', status: 'draft' },
        }),
      ),
    );
  });

  it('fetches a single stock transfer', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStockTransfer('st-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('st-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStockTransfer(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/stock-transfers`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'st-new', ...(body as object), status: 'draft' } });
      }),
    );
  });

  it('creates a new stock transfer', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateStockTransfer(), { wrapper });

    act(() => {
      result.current.mutate({ fromWarehouseId: 'wh-1', toWarehouseId: 'wh-2' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('st-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/stock-transfers/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a stock transfer', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateStockTransfer(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'st-1', notes: 'Updated' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('st-1');
  });
});

// ############################################################################
// SUBMIT
// ############################################################################

describe('useSubmitStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/stock-transfers/:id/submit`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'submitted' } }),
      ),
    );
  });

  it('submits a stock transfer', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitStockTransfer(), { wrapper });

    act(() => {
      result.current.mutate('st-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('submitted');
  });
});

// ############################################################################
// APPROVE
// ############################################################################

describe('useApproveStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/stock-transfers/:id/approve`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'approved' } }),
      ),
    );
  });

  it('approves a stock transfer', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveStockTransfer(), { wrapper });

    act(() => {
      result.current.mutate('st-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('approved');
  });
});

// ############################################################################
// SHIP
// ############################################################################

describe('useShipStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/stock-transfers/:id/ship`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'shipped' } }),
      ),
    );
  });

  it('ships a stock transfer and invalidates inventory', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useShipStockTransfer(), { wrapper });

    act(() => {
      result.current.mutate('st-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('shipped');

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['stock-transfers']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// RECEIVE
// ############################################################################

describe('useReceiveStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/stock-transfers/:id/receive`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'received' } }),
      ),
    );
  });

  it('receives a stock transfer', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReceiveStockTransfer(), { wrapper });

    act(() => {
      result.current.mutate('st-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('received');
  });
});

// ############################################################################
// COMPLETE
// ############################################################################

describe('useCompleteStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/stock-transfers/:id/complete`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'completed' } }),
      ),
    );
  });

  it('completes a stock transfer', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteStockTransfer(), { wrapper });

    act(() => {
      result.current.mutate('st-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('completed');
  });
});

// ############################################################################
// CANCEL
// ############################################################################

describe('useCancelStockTransfer', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/stock-transfers/:id/cancel`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'cancelled' } }),
      ),
    );
  });

  it('cancels a stock transfer', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelStockTransfer(), { wrapper });

    act(() => {
      result.current.mutate('st-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('cancelled');
  });
});
