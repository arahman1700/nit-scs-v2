import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useOsdList, useOsd, useCreateOsd, useUpdateOsd, useSendClaimOsd, useResolveOsd } from './useOsd';

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

describe('useOsdList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/osd`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'osd-1', reportNumber: 'OSD-001', status: 'draft', discrepancyType: 'overage' },
            { id: 'osd-2', reportNumber: 'OSD-002', status: 'claim_sent', discrepancyType: 'shortage' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches OSD list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOsdList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].reportNumber).toBe('OSD-001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOsdList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useOsd', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/osd/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, reportNumber: 'OSD-001', status: 'draft' },
        }),
      ),
    );
  });

  it('fetches a single OSD report by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOsd('osd-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('osd-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOsd(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateOsd', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/osd`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'osd-new', ...(body as object), status: 'draft' } });
      }),
    );
  });

  it('creates a new OSD report', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateOsd(), { wrapper });

    act(() => {
      result.current.mutate({ discrepancyType: 'damage', grnId: 'grn-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('osd-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateOsd', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/osd/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an OSD report', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateOsd(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'osd-1', notes: 'Updated description' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('osd-1');
  });
});

// ############################################################################
// SEND CLAIM
// ############################################################################

describe('useSendClaimOsd', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/osd/:id/send-claim`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'claim_sent' } }),
      ),
    );
  });

  it('sends a claim for an OSD report', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSendClaimOsd(), { wrapper });

    act(() => {
      result.current.mutate('osd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('claim_sent');
  });
});

// ############################################################################
// RESOLVE
// ############################################################################

describe('useResolveOsd', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/osd/:id/resolve`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'resolved' } }),
      ),
    );
  });

  it('resolves an OSD report', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useResolveOsd(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'osd-1', resolution: 'Credit note received' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('resolved');
  });

  it('invalidates osd queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useResolveOsd(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'osd-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['osd']);

    invalidateSpy.mockRestore();
  });
});
