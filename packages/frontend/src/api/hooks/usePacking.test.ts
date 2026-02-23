import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  usePackingQueue,
  usePackingSession,
  useCreatePackingSession,
  useAddPackingLine,
  useCompletePackingSession,
  useCancelPackingSession,
} from './usePacking';

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

const mockQueueItem = {
  id: 'mi-1',
  mirvNumber: 'MI-2026-00010',
  status: 'approved',
  project: { id: 'proj-1', projectName: 'Alpha Project', projectCode: 'ALP-001' },
  mirvLines: [{ id: 'ml-1', item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'Steel Bolt M10' } }],
};

const mockSession = {
  id: 'ps-1',
  sessionNumber: 'PACK-2026-00001',
  mirvId: 'mi-1',
  warehouseId: 'wh-1',
  packedById: 'user-1',
  status: 'in_progress',
  totalWeight: null,
  totalVolume: null,
  cartonCount: 0,
  palletCount: 0,
  completedAt: null,
  notes: null,
  createdAt: '2026-02-20T08:00:00Z',
  updatedAt: '2026-02-20T08:00:00Z',
  mirv: {
    id: 'mi-1',
    mirvNumber: 'MI-2026-00010',
    project: { id: 'proj-1', projectName: 'Alpha Project', projectCode: 'ALP-001' },
  },
  warehouse: { id: 'wh-1', warehouseName: 'Main Warehouse', warehouseCode: 'MW-01' },
  packedBy: { id: 'user-1', firstName: 'Ali', lastName: 'Hassan' },
  lines: [],
};

const mockLine = {
  id: 'pl-1',
  packingSessionId: 'ps-1',
  itemId: 'item-1',
  qtyPacked: 10,
  containerType: 'carton',
  containerLabel: 'CTN-001',
  weight: 5.2,
  volume: 0.03,
  scannedBarcode: null,
  createdAt: '2026-02-20T09:00:00Z',
  item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'Steel Bolt M10' },
};

// ############################################################################
// PACKING QUEUE
// ############################################################################

describe('usePackingQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.get(`${API}/packing`, () => HttpResponse.json({ success: true, data: [mockQueueItem] })));
  });

  it('fetches packing queue for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePackingQueue('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('mi-1');
    expect(data.data[0].mirvNumber).toBe('MI-2026-00010');
    expect(data.data[0].project.projectCode).toBe('ALP-001');
    expect(data.data[0].mirvLines.length).toBe(1);
  });
});

// ############################################################################
// SESSION DETAIL
// ############################################################################

describe('usePackingSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/packing/:id`, ({ params }) =>
        HttpResponse.json({ success: true, data: { ...mockSession, id: params.id } }),
      ),
    );
  });

  it('fetches a single packing session by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePackingSession('ps-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ps-1');
    expect(data.data.sessionNumber).toBe('PACK-2026-00001');
    expect(data.data.status).toBe('in_progress');
    expect(data.data.mirv.mirvNumber).toBe('MI-2026-00010');
    expect(data.data.warehouse.warehouseCode).toBe('MW-01');
    expect(data.data.packedBy.firstName).toBe('Ali');
  });
});

// ############################################################################
// CREATE SESSION
// ############################################################################

describe('useCreatePackingSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/packing`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { ...mockSession, id: 'ps-new', ...(body as object) },
        });
      }),
    );
  });

  it('creates a new packing session', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreatePackingSession(), { wrapper });

    act(() => {
      result.current.mutate({ mirvId: 'mi-1', packedById: 'user-1', warehouseId: 'wh-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ps-new');
    expect(data.data.mirvId).toBe('mi-1');
    expect(data.data.warehouseId).toBe('wh-1');
  });
});

// ############################################################################
// ADD PACKING LINE
// ############################################################################

describe('useAddPackingLine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/packing/:sessionId/lines`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { ...mockLine, ...(body as object) },
        });
      }),
    );
  });

  it('adds a line to a packing session', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddPackingLine(), { wrapper });

    act(() => {
      result.current.mutate({
        sessionId: 'ps-1',
        itemId: 'item-1',
        qtyPacked: 10,
        containerType: 'carton',
        containerLabel: 'CTN-001',
        weight: 5.2,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.itemId).toBe('item-1');
    expect(data.data.qtyPacked).toBe(10);
    expect(data.data.containerType).toBe('carton');
  });
});

// ############################################################################
// COMPLETE SESSION
// ############################################################################

describe('useCompletePackingSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/packing/:sessionId/complete`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { ...mockSession, id: params.sessionId, status: 'completed', completedAt: '2026-02-20T12:00:00Z' },
        }),
      ),
    );
  });

  it('completes a packing session', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompletePackingSession(), { wrapper });

    act(() => {
      result.current.mutate('ps-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ps-1');
    expect(data.data.status).toBe('completed');
    expect(data.data.completedAt).toBe('2026-02-20T12:00:00Z');
  });
});

// ############################################################################
// CANCEL SESSION
// ############################################################################

describe('useCancelPackingSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/packing/:sessionId/cancel`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { ...mockSession, id: params.sessionId, status: 'cancelled' },
        }),
      ),
    );
  });

  it('cancels a packing session', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelPackingSession(), { wrapper });

    act(() => {
      result.current.mutate('ps-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ps-1');
    expect(data.data.status).toBe('cancelled');
  });
});
