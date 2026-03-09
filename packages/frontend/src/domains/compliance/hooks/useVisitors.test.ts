import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useVisitorList,
  useVisitor,
  useRegisterVisitor,
  useUpdateVisitor,
  useCheckInVisitor,
  useCheckOutVisitor,
  useCancelVisitor,
} from './useVisitors';

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

describe('useVisitorList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/visitors`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'vis-1', visitorName: 'John Doe', status: 'registered', badgeNumber: null },
            { id: 'vis-2', visitorName: 'Jane Smith', status: 'checked_in', badgeNumber: 'V-001' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches visitor list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVisitorList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].visitorName).toBe('John Doe');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVisitorList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useVisitor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/visitors/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, visitorName: 'John Doe', status: 'registered' },
        }),
      ),
    );
  });

  it('fetches a single visitor by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVisitor('vis-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('vis-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVisitor(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// REGISTER (CREATE)
// ############################################################################

describe('useRegisterVisitor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/visitors`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'vis-new', ...(body as object), status: 'registered' } });
      }),
    );
  });

  it('registers a new visitor', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRegisterVisitor(), { wrapper });

    act(() => {
      result.current.mutate({ visitorName: 'New Visitor', company: 'ACME Corp' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('vis-new');
    expect(result.current.data!.data.visitorName).toBe('New Visitor');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateVisitor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/visitors/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a visitor', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateVisitor(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'vis-1', visitorName: 'Updated Name' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('vis-1');
  });
});

// ############################################################################
// CHECK IN
// ############################################################################

describe('useCheckInVisitor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/visitors/:id/check-in`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'checked_in', badgeNumber: 'V-100' },
        }),
      ),
    );
  });

  it('checks in a visitor', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCheckInVisitor(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'vis-1', badgeNumber: 'V-100' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('checked_in');
    expect(result.current.data!.data.badgeNumber).toBe('V-100');
  });
});

// ############################################################################
// CHECK OUT
// ############################################################################

describe('useCheckOutVisitor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/visitors/:id/check-out`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'checked_out' },
        }),
      ),
    );
  });

  it('checks out a visitor', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCheckOutVisitor(), { wrapper });

    act(() => {
      result.current.mutate('vis-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('checked_out');
  });
});

// ############################################################################
// CANCEL
// ############################################################################

describe('useCancelVisitor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/visitors/:id/cancel`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'cancelled' },
        }),
      ),
    );
  });

  it('cancels a visitor pass', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelVisitor(), { wrapper });

    act(() => {
      result.current.mutate('vis-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('cancelled');
  });
});
