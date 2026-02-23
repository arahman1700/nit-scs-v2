import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useRentalContractList,
  useRentalContract,
  useCreateRentalContract,
  useUpdateRentalContract,
  useSubmitRentalContract,
  useApproveRentalContract,
  useActivateRentalContract,
  useExtendRentalContract,
  useTerminateRentalContract,
} from './useRentalContracts';

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

beforeEach(() => {
  mockStorage.clear();
  vi.clearAllMocks();

  server.use(
    // List
    http.get(`${API}/rental-contracts`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'rc-1',
            contractNumber: 'RC-2026-00001',
            status: 'draft',
            supplierId: 'sup-1',
            startDate: '2026-03-01',
            endDate: '2026-06-01',
            monthlyRate: 5000,
            createdAt: '2026-02-01T10:00:00Z',
          },
          {
            id: 'rc-2',
            contractNumber: 'RC-2026-00002',
            status: 'active',
            supplierId: 'sup-2',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            monthlyRate: 8000,
            createdAt: '2026-01-15T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/rental-contracts/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: {
          id: params.id,
          contractNumber: 'RC-2026-00001',
          status: 'draft',
          supplierId: 'sup-1',
          startDate: '2026-03-01',
          endDate: '2026-06-01',
          monthlyRate: 5000,
        },
      });
    }),

    // Create
    http.post(`${API}/rental-contracts`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'rc-new', ...(body as object), status: 'draft' },
      });
    }),

    // Update
    http.put(`${API}/rental-contracts/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.id, ...(body as object) },
      });
    }),

    // Submit
    http.post(`${API}/rental-contracts/:id/submit`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'submitted' },
      });
    }),

    // Approve
    http.post(`${API}/rental-contracts/:id/approve`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'approved' },
      });
    }),

    // Activate
    http.post(`${API}/rental-contracts/:id/activate`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'active' },
      });
    }),

    // Extend
    http.post(`${API}/rental-contracts/:id/extend`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'extended' },
      });
    }),

    // Terminate
    http.post(`${API}/rental-contracts/:id/terminate`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'terminated' },
      });
    }),
  );
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useRentalContractList', () => {
  it('fetches rental contract list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRentalContractList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('rc-1');
    expect(data.data[0].contractNumber).toBe('RC-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('rc-2');
    expect(data.data[1].status).toBe('active');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRentalContractList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useRentalContract', () => {
  it('fetches a single rental contract by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRentalContract('rc-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('rc-1');
    expect(data.data.contractNumber).toBe('RC-2026-00001');
    expect(data.data.status).toBe('draft');
    expect(data.data.monthlyRate).toBe(5000);
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRentalContract(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateRentalContract', () => {
  it('creates a new rental contract with draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateRentalContract(), { wrapper });

    act(() => {
      result.current.mutate({ supplierId: 'sup-1', startDate: '2026-03-01', endDate: '2026-06-01', monthlyRate: 5000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('rc-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.supplierId).toBe('sup-1');
    expect(data.data.monthlyRate).toBe(5000);
  });
});

// ── Update ───────────────────────────────────────────────────────────────────
describe('useUpdateRentalContract', () => {
  it('updates an existing rental contract', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateRentalContract(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rc-1', monthlyRate: 6000, notes: 'Rate adjusted' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('rc-1');
    expect(data.data.monthlyRate).toBe(6000);
    expect(data.data.notes).toBe('Rate adjusted');
  });
});

// ── Submit ───────────────────────────────────────────────────────────────────
describe('useSubmitRentalContract', () => {
  it('transitions contract to submitted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitRentalContract(), { wrapper });

    act(() => {
      result.current.mutate('rc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('rc-1');
    expect(data.data.status).toBe('submitted');
  });
});

// ── Approve ──────────────────────────────────────────────────────────────────
describe('useApproveRentalContract', () => {
  it('transitions contract to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveRentalContract(), { wrapper });

    act(() => {
      result.current.mutate('rc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('rc-1');
    expect(data.data.status).toBe('approved');
  });
});

// ── Activate ─────────────────────────────────────────────────────────────────
describe('useActivateRentalContract', () => {
  it('transitions contract to active status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useActivateRentalContract(), { wrapper });

    act(() => {
      result.current.mutate('rc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('rc-1');
    expect(data.data.status).toBe('active');
  });
});

// ── Extend ───────────────────────────────────────────────────────────────────
describe('useExtendRentalContract', () => {
  it('transitions contract to extended status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExtendRentalContract(), { wrapper });

    act(() => {
      result.current.mutate('rc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('rc-1');
    expect(data.data.status).toBe('extended');
  });
});

// ── Terminate ────────────────────────────────────────────────────────────────
describe('useTerminateRentalContract', () => {
  it('transitions contract to terminated status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTerminateRentalContract(), { wrapper });

    act(() => {
      result.current.mutate('rc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('rc-1');
    expect(data.data.status).toBe('terminated');
  });
});
