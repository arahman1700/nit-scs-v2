import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useCrossDockOpportunities,
  useCrossDockStats,
  useCrossDockList,
  useCrossDock,
  useCreateCrossDock,
  useApproveCrossDock,
  useExecuteCrossDock,
  useCompleteCrossDock,
  useCancelCrossDock,
} from './useCrossDock';

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
    // Opportunities
    http.get(`${API}/cross-docks/opportunities`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            itemId: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Beam',
            warehouseId: 'wh-1',
            sourceGrnId: 'grn-1',
            sourceGrnNumber: 'GRN-001',
            grnQuantity: 200,
            targets: [{ type: 'mi', id: 'mi-1', documentNumber: 'MI-001', quantityNeeded: 50 }],
            suggestedQuantity: 50,
          },
        ],
      });
    }),

    // Stats
    http.get(`${API}/cross-docks/stats`, () => {
      return HttpResponse.json({
        success: true,
        data: {
          totalIdentified: 12,
          totalActive: 5,
          totalCompleted: 20,
          totalCancelled: 3,
          totalItemsBypassed: 8,
          avgCompletionHours: 4.5,
        },
      });
    }),

    // List
    http.get(`${API}/cross-docks`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'cd-1',
            warehouseId: 'wh-1',
            itemId: 'item-1',
            quantity: 100,
            status: 'identified',
            createdAt: '2026-02-01T10:00:00Z',
            updatedAt: '2026-02-01T10:00:00Z',
            sourceGrnId: null,
            targetMiId: null,
            targetWtId: null,
            completedAt: null,
          },
          {
            id: 'cd-2',
            warehouseId: 'wh-2',
            itemId: 'item-2',
            quantity: 50,
            status: 'approved',
            createdAt: '2026-02-02T10:00:00Z',
            updatedAt: '2026-02-02T10:00:00Z',
            sourceGrnId: 'grn-1',
            targetMiId: 'mi-1',
            targetWtId: null,
            completedAt: null,
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/cross-docks/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: {
          id: params.id,
          warehouseId: 'wh-1',
          itemId: 'item-1',
          quantity: 100,
          status: 'identified',
          createdAt: '2026-02-01T10:00:00Z',
          updatedAt: '2026-02-01T10:00:00Z',
          sourceGrnId: null,
          targetMiId: null,
          targetWtId: null,
          completedAt: null,
        },
      });
    }),

    // Create
    http.post(`${API}/cross-docks`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: {
          id: 'cd-new',
          ...(body as object),
          status: 'identified',
          createdAt: '2026-02-03T10:00:00Z',
          updatedAt: '2026-02-03T10:00:00Z',
          completedAt: null,
        },
      });
    }),

    // Approve
    http.post(`${API}/cross-docks/:id/approve`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'approved' },
      });
    }),

    // Execute
    http.post(`${API}/cross-docks/:id/execute`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'in_progress' },
      });
    }),

    // Complete
    http.post(`${API}/cross-docks/:id/complete`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'completed' },
      });
    }),

    // Cancel
    http.post(`${API}/cross-docks/:id/cancel`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'cancelled' },
      });
    }),
  );
});

// ── Opportunities ────────────────────────────────────────────────────────────
describe('useCrossDockOpportunities', () => {
  it('fetches cross-dock opportunities for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCrossDockOpportunities('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].itemCode).toBe('ITM-001');
    expect(data.data[0].suggestedQuantity).toBe(50);
    expect(data.data[0].targets[0].type).toBe('mi');
  });

  it('does not fetch when warehouseId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCrossDockOpportunities(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Stats ────────────────────────────────────────────────────────────────────
describe('useCrossDockStats', () => {
  it('fetches cross-dock stats (warehouseId optional)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCrossDockStats(undefined), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.totalIdentified).toBe(12);
    expect(data.data.totalActive).toBe(5);
    expect(data.data.totalCompleted).toBe(20);
    expect(data.data.totalCancelled).toBe(3);
    expect(data.data.avgCompletionHours).toBe(4.5);
  });
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useCrossDockList', () => {
  it('fetches cross-dock list with filters', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCrossDockList({ warehouseId: 'wh-1', status: 'identified' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('cd-1');
    expect(data.data[1].status).toBe('approved');
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useCrossDock', () => {
  it('fetches a single cross-dock by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCrossDock('cd-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cd-1');
    expect(data.data.warehouseId).toBe('wh-1');
    expect(data.data.quantity).toBe(100);
    expect(data.data.status).toBe('identified');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCrossDock(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateCrossDock', () => {
  it('creates a new cross-dock with identified status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateCrossDock(), { wrapper });

    act(() => {
      result.current.mutate({ warehouseId: 'wh-1', itemId: 'item-1', quantity: 100 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cd-new');
    expect(data.data.status).toBe('identified');
    expect(data.data.warehouseId).toBe('wh-1');
    expect(data.data.itemId).toBe('item-1');
    expect(data.data.quantity).toBe(100);
  });
});

// ── Approve ──────────────────────────────────────────────────────────────────
describe('useApproveCrossDock', () => {
  it('transitions cross-dock to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveCrossDock(), { wrapper });

    act(() => {
      result.current.mutate('cd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cd-1');
    expect(data.data.status).toBe('approved');
  });
});

// ── Execute ──────────────────────────────────────────────────────────────────
describe('useExecuteCrossDock', () => {
  it('transitions cross-dock to in_progress status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExecuteCrossDock(), { wrapper });

    act(() => {
      result.current.mutate('cd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cd-1');
    expect(data.data.status).toBe('in_progress');
  });
});

// ── Complete ─────────────────────────────────────────────────────────────────
describe('useCompleteCrossDock', () => {
  it('transitions cross-dock to completed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteCrossDock(), { wrapper });

    act(() => {
      result.current.mutate('cd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cd-1');
    expect(data.data.status).toBe('completed');
  });
});

// ── Cancel ───────────────────────────────────────────────────────────────────
describe('useCancelCrossDock', () => {
  it('transitions cross-dock to cancelled status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelCrossDock(), { wrapper });

    act(() => {
      result.current.mutate('cd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cd-1');
    expect(data.data.status).toBe('cancelled');
  });
});
