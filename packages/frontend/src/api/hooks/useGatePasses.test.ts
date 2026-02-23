import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useGatePassList,
  useGatePass,
  useCreateGatePass,
  useUpdateGatePass,
  useSubmitGatePass,
  useApproveGatePass,
  useReleaseGatePass,
  useReturnGatePass,
  useCancelGatePass,
} from './useGatePasses';

const API = '/api/v1';

// Ensure localStorage works in the jsdom environment
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

// ── useGatePassList ──────────────────────────────────────────────────────────

describe('useGatePassList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/gate-passes`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'gp-1',
              formNumber: 'GP-2026-00001',
              status: 'draft',
              mirvId: 'mi-1',
              type: 'material',
              createdAt: '2026-02-01T10:00:00Z',
            },
            {
              id: 'gp-2',
              formNumber: 'GP-2026-00002',
              status: 'approved',
              mirvId: 'mi-2',
              type: 'material',
              createdAt: '2026-02-02T10:00:00Z',
            },
            {
              id: 'gp-3',
              formNumber: 'GP-2026-00003',
              status: 'released',
              mirvId: 'mi-3',
              type: 'equipment',
              createdAt: '2026-02-03T10:00:00Z',
            },
          ],
          meta: { page: 1, limit: 20, total: 3, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches gate pass list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGatePassList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(3);
    expect(data.data[0].id).toBe('gp-1');
    expect(data.data[0].formNumber).toBe('GP-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('gp-2');
    expect(data.data[1].status).toBe('approved');
    expect(data.data[2].id).toBe('gp-3');
    expect(data.data[2].status).toBe('released');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(3);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGatePassList({ page: 1, limit: 5 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── useGatePass ──────────────────────────────────────────────────────────────

describe('useGatePass', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/gate-passes/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            formNumber: 'GP-2026-00001',
            status: 'draft',
            mirvId: 'mi-1',
            type: 'material',
            gatePassItems: [{ id: 'gpi-1', itemId: 'item-1', qty: 10 }],
          },
        }),
      ),
    );
  });

  it('fetches a single gate pass by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGatePass('gp-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gp-1');
    expect(data.data.formNumber).toBe('GP-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGatePass(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── useCreateGatePass ────────────────────────────────────────────────────────

describe('useCreateGatePass', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/gate-passes`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'gp-new', ...(body as object), status: 'draft' },
        });
      }),
    );
  });

  it('creates a new gate pass and returns draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateGatePass(), { wrapper });

    act(() => {
      result.current.mutate({
        mirvId: 'mi-1',
        type: 'material',
        destination: 'Site A',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gp-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.mirvId).toBe('mi-1');
  });
});

// ── useUpdateGatePass ────────────────────────────────────────────────────────

describe('useUpdateGatePass', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/gate-passes/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object), formNumber: 'GP-2026-00001' },
        });
      }),
    );
  });

  it('updates an existing gate pass', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateGatePass(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'gp-1',
        destination: 'Site B',
        notes: 'Updated gate pass notes',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gp-1');
    expect(data.data.destination).toBe('Site B');
    expect(data.data.notes).toBe('Updated gate pass notes');
  });
});

// ── useSubmitGatePass ────────────────────────────────────────────────────────

describe('useSubmitGatePass', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/gate-passes/:id/submit`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'submitted' } }),
      ),
    );
  });

  it('transitions gate pass to submitted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitGatePass(), { wrapper });

    act(() => {
      result.current.mutate('gp-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gp-1');
    expect(data.data.status).toBe('submitted');
  });
});

// ── useApproveGatePass ───────────────────────────────────────────────────────

describe('useApproveGatePass', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/gate-passes/:id/approve`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'approved' } }),
      ),
    );
  });

  it('transitions gate pass to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveGatePass(), { wrapper });

    act(() => {
      result.current.mutate('gp-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gp-1');
    expect(data.data.status).toBe('approved');
  });
});

// ── useReleaseGatePass ───────────────────────────────────────────────────────

describe('useReleaseGatePass', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/gate-passes/:id/release`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'released' } }),
      ),
    );
  });

  it('transitions gate pass to released status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReleaseGatePass(), { wrapper });

    act(() => {
      result.current.mutate('gp-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gp-1');
    expect(data.data.status).toBe('released');
  });
});

// ── useReturnGatePass ────────────────────────────────────────────────────────

describe('useReturnGatePass', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/gate-passes/:id/return`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'returned' } }),
      ),
    );
  });

  it('transitions gate pass to returned status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReturnGatePass(), { wrapper });

    act(() => {
      result.current.mutate('gp-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gp-1');
    expect(data.data.status).toBe('returned');
  });
});

// ── useCancelGatePass ────────────────────────────────────────────────────────

describe('useCancelGatePass', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/gate-passes/:id/cancel`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'cancelled' } }),
      ),
    );
  });

  it('transitions gate pass to cancelled status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelGatePass(), { wrapper });

    act(() => {
      result.current.mutate('gp-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gp-1');
    expect(data.data.status).toBe('cancelled');
  });
});
