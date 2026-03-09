import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useTransportOrderList,
  useTransportOrder,
  useCreateTransportOrder,
  useUpdateTransportOrder,
  useScheduleTransportOrder,
  useDispatchTransportOrder,
  useDeliverTransportOrder,
  useCancelTransportOrder,
} from './useTransportOrders';

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

describe('useTransportOrderList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/transport-orders`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'to-1', orderNumber: 'TO-001', status: 'draft', origin: 'WH-A', destination: 'WH-B' },
            { id: 'to-2', orderNumber: 'TO-002', status: 'dispatched', origin: 'WH-A', destination: 'WH-C' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches transport order list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTransportOrderList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].orderNumber).toBe('TO-001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTransportOrderList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useTransportOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/transport-orders/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, orderNumber: 'TO-001', status: 'draft' },
        }),
      ),
    );
  });

  it('fetches a single transport order', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTransportOrder('to-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('to-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTransportOrder(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateTransportOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/transport-orders`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'to-new', ...(body as object), status: 'draft' } });
      }),
    );
  });

  it('creates a new transport order', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateTransportOrder(), { wrapper });

    act(() => {
      result.current.mutate({ origin: 'WH-A', destination: 'WH-B', vehicleId: 'v-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('to-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateTransportOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/transport-orders/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a transport order', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateTransportOrder(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'to-1', notes: 'Updated route' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('to-1');
  });
});

// ############################################################################
// SCHEDULE
// ############################################################################

describe('useScheduleTransportOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/transport-orders/:id/schedule`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'scheduled' } }),
      ),
    );
  });

  it('schedules a transport order', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useScheduleTransportOrder(), { wrapper });

    act(() => {
      result.current.mutate('to-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('scheduled');
  });
});

// ############################################################################
// DISPATCH
// ############################################################################

describe('useDispatchTransportOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/transport-orders/:id/dispatch`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'dispatched' } }),
      ),
    );
  });

  it('dispatches a transport order', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDispatchTransportOrder(), { wrapper });

    act(() => {
      result.current.mutate('to-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('dispatched');
  });
});

// ############################################################################
// DELIVER
// ############################################################################

describe('useDeliverTransportOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/transport-orders/:id/deliver`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'delivered' } }),
      ),
    );
  });

  it('marks a transport order as delivered', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeliverTransportOrder(), { wrapper });

    act(() => {
      result.current.mutate('to-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('delivered');
  });
});

// ############################################################################
// CANCEL
// ############################################################################

describe('useCancelTransportOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/transport-orders/:id/cancel`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'cancelled' } }),
      ),
    );
  });

  it('cancels a transport order', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelTransportOrder(), { wrapper });

    act(() => {
      result.current.mutate('to-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('cancelled');
  });
});
