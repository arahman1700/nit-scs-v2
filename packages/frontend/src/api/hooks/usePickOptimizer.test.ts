import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useOptimizePickPath,
  useWaveList,
  useWave,
  useCreateWave,
  useStartWave,
  useCompleteWave,
} from './usePickOptimizer';

const API = '/api/v1';

const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(),
    get length() {
      return Object.keys(storage).length;
    },
    key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
  },
  writable: true,
});

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockPickPath = {
  stops: [
    {
      itemId: 'item-1',
      itemCode: 'ITM-001',
      itemName: 'Steel Bolt',
      binNumber: 'B-01',
      zone: 'Zone A',
      aisle: 1,
      shelf: 3,
      quantity: 5,
      stopOrder: 1,
    },
    {
      itemId: 'item-2',
      itemCode: 'ITM-002',
      itemName: 'Steel Nut',
      binNumber: 'B-02',
      zone: 'Zone A',
      aisle: 1,
      shelf: 5,
      quantity: 10,
      stopOrder: 2,
    },
  ],
  totalDistance: 120,
  estimatedMinutes: 8,
};

const mockWave = {
  id: 'wave-1',
  warehouseId: 'wh-1',
  miIds: ['mi-1', 'mi-2'],
  status: 'created',
  createdAt: '2026-02-20T08:00:00Z',
  itemCount: 5,
  totalQuantity: 100,
};

// ############################################################################
// OPTIMIZE PICK PATH
// ############################################################################

describe('useOptimizePickPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.get(`${API}/pick-optimizer/path`, () => HttpResponse.json({ success: true, data: mockPickPath })));
  });

  it('fetches an optimized pick path', async () => {
    const wrapper = createWrapper();
    const items = [{ itemId: 'item-1', quantity: 5 }];
    const { result } = renderHook(() => useOptimizePickPath('wh-1', items), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.stops).toBeInstanceOf(Array);
    expect(data.data.stops.length).toBe(2);
    expect(data.data.stops[0].itemCode).toBe('ITM-001');
    expect(data.data.stops[0].stopOrder).toBe(1);
    expect(data.data.stops[1].stopOrder).toBe(2);
    expect(data.data.totalDistance).toBe(120);
    expect(data.data.estimatedMinutes).toBe(8);
  });
});

// ############################################################################
// WAVE LIST
// ############################################################################

describe('useWaveList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.get(`${API}/pick-optimizer/waves`, () => HttpResponse.json({ success: true, data: [mockWave] })));
  });

  it('fetches the wave list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWaveList('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('wave-1');
    expect(data.data[0].warehouseId).toBe('wh-1');
    expect(data.data[0].status).toBe('created');
    expect(data.data[0].miIds).toEqual(['mi-1', 'mi-2']);
    expect(data.data[0].itemCount).toBe(5);
    expect(data.data[0].totalQuantity).toBe(100);
  });
});

// ############################################################################
// WAVE DETAIL
// ############################################################################

describe('useWave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/pick-optimizer/waves/:id`, ({ params }) =>
        HttpResponse.json({ success: true, data: { ...mockWave, id: params.id } }),
      ),
    );
  });

  it('fetches a single wave by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWave('wave-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wave-1');
    expect(data.data.warehouseId).toBe('wh-1');
    expect(data.data.status).toBe('created');
  });
});

// ############################################################################
// CREATE WAVE
// ############################################################################

describe('useCreateWave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/pick-optimizer/waves`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            id: 'wave-new',
            ...(body as object),
            status: 'created',
            itemCount: 3,
            totalQuantity: 50,
            createdAt: '2026-02-20T10:00:00Z',
          },
        });
      }),
    );
  });

  it('creates a new wave', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateWave(), { wrapper });

    act(() => {
      result.current.mutate({ warehouseId: 'wh-1', miIds: ['mi-1', 'mi-3'] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wave-new');
    expect(data.data.warehouseId).toBe('wh-1');
    expect(data.data.miIds).toEqual(['mi-1', 'mi-3']);
    expect(data.data.status).toBe('created');
  });
});

// ############################################################################
// START WAVE
// ############################################################################

describe('useStartWave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/pick-optimizer/waves/:id/start`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { ...mockWave, id: params.id, status: 'picking' },
        }),
      ),
    );
  });

  it('starts a wave', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStartWave(), { wrapper });

    act(() => {
      result.current.mutate('wave-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wave-1');
    expect(data.data.status).toBe('picking');
  });
});

// ############################################################################
// COMPLETE WAVE
// ############################################################################

describe('useCompleteWave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/pick-optimizer/waves/:id/complete`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { ...mockWave, id: params.id, status: 'completed', completedAt: '2026-02-20T14:00:00Z' },
        }),
      ),
    );
  });

  it('completes a wave', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteWave(), { wrapper });

    act(() => {
      result.current.mutate('wave-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('wave-1');
    expect(data.data.status).toBe('completed');
    expect(data.data.completedAt).toBe('2026-02-20T14:00:00Z');
  });
});
