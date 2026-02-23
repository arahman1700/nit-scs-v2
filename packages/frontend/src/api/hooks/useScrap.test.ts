import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useScrapList,
  useScrap,
  useCreateScrap,
  useUpdateScrap,
  useReportScrap,
  useApproveScrap,
  useSendToSscScrap,
  useMarkSoldScrap,
  useDisposeScrap,
  useCloseScrap,
  useApproveBySiteManager,
  useApproveByQc,
  useApproveByStorekeeper,
} from './useScrap';

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
    http.get(`${API}/scrap`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'scrap-1',
            formNumber: 'SCR-2026-00001',
            status: 'draft',
            itemDescription: 'Scrap Metal',
            estimatedQty: 500,
            createdAt: '2026-02-01T10:00:00Z',
          },
          {
            id: 'scrap-2',
            formNumber: 'SCR-2026-00002',
            status: 'reported',
            itemDescription: 'Scrap Cable',
            estimatedQty: 200,
            createdAt: '2026-02-02T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/scrap/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: {
          id: params.id,
          formNumber: 'SCR-2026-00001',
          status: 'draft',
          itemDescription: 'Scrap Metal',
          estimatedQty: 500,
        },
      });
    }),

    // Create
    http.post(`${API}/scrap`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'scrap-new', ...(body as object), status: 'draft' },
      });
    }),

    // Update
    http.put(`${API}/scrap/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.id, ...(body as object) },
      });
    }),

    // Report
    http.post(`${API}/scrap/:id/report`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'reported' },
      });
    }),

    // Approve
    http.post(`${API}/scrap/:id/approve`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'approved' },
      });
    }),

    // Send to SSC
    http.post(`${API}/scrap/:id/send-to-ssc`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'sent_to_ssc' },
      });
    }),

    // Mark sold
    http.post(`${API}/scrap/:id/mark-sold`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'sold' },
      });
    }),

    // Dispose
    http.post(`${API}/scrap/:id/dispose`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'disposed' },
      });
    }),

    // Close
    http.post(`${API}/scrap/:id/close`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'closed' },
      });
    }),

    // Approve by site manager
    http.post(`${API}/scrap/:id/approve-site-manager`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'site_manager_approved' },
      });
    }),

    // Approve by QC
    http.post(`${API}/scrap/:id/approve-qc`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'qc_approved' },
      });
    }),

    // Approve by storekeeper
    http.post(`${API}/scrap/:id/approve-storekeeper`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'storekeeper_approved' },
      });
    }),
  );
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useScrapList', () => {
  it('fetches scrap list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useScrapList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('scrap-1');
    expect(data.data[0].formNumber).toBe('SCR-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('scrap-2');
    expect(data.data[1].status).toBe('reported');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useScrapList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useScrap', () => {
  it('fetches a single scrap item by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useScrap('scrap-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.formNumber).toBe('SCR-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useScrap(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateScrap', () => {
  it('creates a new scrap item with draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateScrap(), { wrapper });

    act(() => {
      result.current.mutate({
        itemDescription: 'Scrap Iron',
        estimatedQty: 300,
        warehouseId: 'wh-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.itemDescription).toBe('Scrap Iron');
    expect(data.data.estimatedQty).toBe(300);
  });
});

// ── Update ───────────────────────────────────────────────────────────────────
describe('useUpdateScrap', () => {
  it('updates an existing scrap item', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateScrap(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'scrap-1',
        estimatedQty: 750,
        notes: 'Updated quantity',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.estimatedQty).toBe(750);
    expect(data.data.notes).toBe('Updated quantity');
  });
});

// ── Report ───────────────────────────────────────────────────────────────────
describe('useReportScrap', () => {
  it('transitions scrap to reported status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReportScrap(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('reported');
  });
});

// ── Approve ──────────────────────────────────────────────────────────────────
describe('useApproveScrap', () => {
  it('transitions scrap to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveScrap(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('approved');
  });
});

// ── Send to SSC ──────────────────────────────────────────────────────────────
describe('useSendToSscScrap', () => {
  it('transitions scrap to sent_to_ssc status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSendToSscScrap(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('sent_to_ssc');
  });
});

// ── Mark Sold ────────────────────────────────────────────────────────────────
describe('useMarkSoldScrap', () => {
  it('transitions scrap to sold status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMarkSoldScrap(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('sold');
  });
});

// ── Dispose ──────────────────────────────────────────────────────────────────
describe('useDisposeScrap', () => {
  it('transitions scrap to disposed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDisposeScrap(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('disposed');
  });
});

// ── Close ────────────────────────────────────────────────────────────────────
describe('useCloseScrap', () => {
  it('transitions scrap to closed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCloseScrap(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('closed');
  });
});

// ── Approve by Site Manager ──────────────────────────────────────────────────
describe('useApproveBySiteManager', () => {
  it('transitions scrap to site_manager_approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveBySiteManager(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('site_manager_approved');
  });
});

// ── Approve by QC ────────────────────────────────────────────────────────────
describe('useApproveByQc', () => {
  it('transitions scrap to qc_approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveByQc(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('qc_approved');
  });
});

// ── Approve by Storekeeper ───────────────────────────────────────────────────
describe('useApproveByStorekeeper', () => {
  it('transitions scrap to storekeeper_approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveByStorekeeper(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('scrap-1');
    expect(data.data.status).toBe('storekeeper_approved');
  });

  it('invalidates scrap queries on storekeeper approval', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useApproveByStorekeeper(), { wrapper });

    act(() => {
      result.current.mutate('scrap-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['scrap']);

    invalidateSpy.mockRestore();
  });
});
