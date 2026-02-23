import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useCycleCountList,
  useCycleCount,
  useCreateCycleCount,
  useGenerateLines,
  useStartCycleCount,
  useRecordCount,
  useCompleteCycleCount,
  useApplyAdjustments,
  useCancelCycleCount,
} from './useCycleCounts';

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

// ── List ────────────────────────────────────────────────────────────────────

describe('useCycleCountList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/cycle-counts`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'cc-1',
              countNumber: 'CC-2026-00001',
              status: 'scheduled',
              countType: 'full',
              warehouseId: 'wh-1',
              scheduledDate: '2026-02-20',
              createdAt: '2026-02-18T10:00:00Z',
            },
            {
              id: 'cc-2',
              countNumber: 'CC-2026-00002',
              status: 'in_progress',
              countType: 'abc_based',
              warehouseId: 'wh-1',
              scheduledDate: '2026-02-21',
              createdAt: '2026-02-19T10:00:00Z',
            },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches cycle count list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCycleCountList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('cc-1');
    expect(data.data[0].countNumber).toBe('CC-2026-00001');
    expect(data.data[0].status).toBe('scheduled');
    expect(data.data[0].countType).toBe('full');
    expect(data.data[1].id).toBe('cc-2');
    expect(data.data[1].status).toBe('in_progress');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCycleCountList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ──────────────────────────────────────────────────────────────────

describe('useCycleCount', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/cycle-counts/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            countNumber: 'CC-2026-00001',
            status: 'scheduled',
            countType: 'full',
            warehouseId: 'wh-1',
            scheduledDate: '2026-02-20',
          },
        }),
      ),
    );
  });

  it('fetches a single cycle count by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCycleCount('cc-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cc-1');
    expect(data.data.countNumber).toBe('CC-2026-00001');
    expect(data.data.status).toBe('scheduled');
    expect(data.data.countType).toBe('full');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCycleCount(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ──────────────────────────────────────────────────────────────────

describe('useCreateCycleCount', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/cycle-counts`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'cc-new', ...(body as object), status: 'scheduled', countNumber: 'CC-2026-00003' },
        });
      }),
    );
  });

  it('creates a new cycle count', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateCycleCount(), { wrapper });

    act(() => {
      result.current.mutate({ countType: 'zone', warehouseId: 'wh-1', scheduledDate: '2026-02-25' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cc-new');
    expect(data.data.status).toBe('scheduled');
    expect(data.data.countType).toBe('zone');
    expect(data.data.warehouseId).toBe('wh-1');
  });
});

// ── Generate Lines ──────────────────────────────────────────────────────────

describe('useGenerateLines', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/cycle-counts/:id/generate-lines`, () =>
        HttpResponse.json({
          success: true,
          data: { lineCount: 25 },
        }),
      ),
    );
  });

  it('generates lines for a cycle count and returns line count', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGenerateLines(), { wrapper });

    act(() => {
      result.current.mutate('cc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.lineCount).toBe(25);
  });
});

// ── Start Count ─────────────────────────────────────────────────────────────

describe('useStartCycleCount', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/cycle-counts/:id/start`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'in_progress', startedAt: '2026-02-20T08:00:00Z' },
        }),
      ),
    );
  });

  it('starts a cycle count and transitions to in_progress', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStartCycleCount(), { wrapper });

    act(() => {
      result.current.mutate('cc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cc-1');
    expect(data.data.status).toBe('in_progress');
  });
});

// ── Record Count ────────────────────────────────────────────────────────────

describe('useRecordCount', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/cycle-counts/:cycleCountId/lines/:lineId/count`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            id: params.lineId,
            cycleCountId: params.cycleCountId,
            ...(body as object),
            status: 'counted',
            countedAt: '2026-02-20T09:30:00Z',
            expectedQty: 100,
            varianceQty: (body as any).countedQty - 100,
          },
        });
      }),
    );
  });

  it('records a count for a cycle count line', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRecordCount(), { wrapper });

    act(() => {
      result.current.mutate({ cycleCountId: 'cc-1', lineId: 'line-1', countedQty: 95 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('line-1');
    expect(data.data.cycleCountId).toBe('cc-1');
    expect(data.data.countedQty).toBe(95);
    expect(data.data.status).toBe('counted');
    expect(data.data.varianceQty).toBe(-5);
  });

  it('records a count with optional notes', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRecordCount(), { wrapper });

    act(() => {
      result.current.mutate({ cycleCountId: 'cc-1', lineId: 'line-2', countedQty: 100, notes: 'Exact match' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.countedQty).toBe(100);
    expect(data.data.notes).toBe('Exact match');
    expect(data.data.varianceQty).toBe(0);
  });
});

// ── Complete Count ──────────────────────────────────────────────────────────

describe('useCompleteCycleCount', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/cycle-counts/:id/complete`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'completed', completedAt: '2026-02-20T16:00:00Z' },
        }),
      ),
    );
  });

  it('completes a cycle count', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteCycleCount(), { wrapper });

    act(() => {
      result.current.mutate('cc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cc-1');
    expect(data.data.status).toBe('completed');
  });
});

// ── Apply Adjustments ───────────────────────────────────────────────────────

describe('useApplyAdjustments', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/cycle-counts/:id/apply-adjustments`, () =>
        HttpResponse.json({
          success: true,
          data: { adjustedCount: 3 },
        }),
      ),
    );
  });

  it('applies adjustments and returns adjusted count', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApplyAdjustments(), { wrapper });

    act(() => {
      result.current.mutate('cc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.adjustedCount).toBe(3);
  });
});

// ── Cancel ──────────────────────────────────────────────────────────────────

describe('useCancelCycleCount', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.delete(`${API}/cycle-counts/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'cancelled' },
        }),
      ),
    );
  });

  it('cancels a cycle count', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelCycleCount(), { wrapper });

    act(() => {
      result.current.mutate('cc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cc-1');
    expect(data.data.status).toBe('cancelled');
  });

  it('invalidates cycle-counts queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCancelCycleCount(), { wrapper });

    act(() => {
      result.current.mutate('cc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['cycle-counts']);

    invalidateSpy.mockRestore();
  });
});
