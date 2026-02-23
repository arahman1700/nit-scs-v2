import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useShipmentList,
  useShipment,
  useCreateShipment,
  useUpdateShipment,
  useUpdateShipmentStatus,
  useAddCustomsStage,
  useUpdateCustomsStage,
  useDeliverShipment,
  useCancelShipment,
} from './useShipments';

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
    http.get(`${API}/shipments`, () => {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'ship-1',
            formNumber: 'SHP-2026-00001',
            status: 'in_transit',
            origin: 'Riyadh',
            destination: 'Jeddah',
            createdAt: '2026-01-15T10:00:00Z',
          },
          {
            id: 'ship-2',
            formNumber: 'SHP-2026-00002',
            status: 'customs_clearance',
            origin: 'Dammam',
            destination: 'Riyadh',
            createdAt: '2026-01-16T10:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }),

    // Detail
    http.get(`${API}/shipments/:id`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: {
          id: params.id,
          formNumber: 'SHP-2026-00001',
          status: 'in_transit',
          origin: 'Riyadh',
          destination: 'Jeddah',
        },
      });
    }),

    // Create
    http.post(`${API}/shipments`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'ship-new', ...(body as object), status: 'draft' },
      });
    }),

    // Update
    http.put(`${API}/shipments/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.id, ...(body as object) },
      });
    }),

    // Update status
    http.put(`${API}/shipments/:id/status`, async ({ request, params }) => {
      const body = (await request.json()) as { status: string };
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: body.status },
      });
    }),

    // Add customs stage
    http.post(`${API}/shipments/:id/customs`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'customs-new', shipmentId: params.id, ...(body as object) },
      });
    }),

    // Update customs stage
    http.put(`${API}/shipments/:id/customs/:customsId`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.customsId, shipmentId: params.id, ...(body as object) },
      });
    }),

    // Deliver
    http.post(`${API}/shipments/:id/deliver`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'delivered' },
      });
    }),

    // Cancel
    http.post(`${API}/shipments/:id/cancel`, ({ params }) => {
      return HttpResponse.json({
        success: true,
        data: { id: params.id, status: 'cancelled' },
      });
    }),
  );
});

// ── List ─────────────────────────────────────────────────────────────────────
describe('useShipmentList', () => {
  it('fetches shipment list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useShipmentList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('ship-1');
    expect(data.data[0].formNumber).toBe('SHP-2026-00001');
    expect(data.data[0].status).toBe('in_transit');
    expect(data.data[1].id).toBe('ship-2');
    expect(data.data[1].status).toBe('customs_clearance');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useShipmentList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ── Detail ───────────────────────────────────────────────────────────────────
describe('useShipment', () => {
  it('fetches a single shipment by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useShipment('ship-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ship-1');
    expect(data.data.formNumber).toBe('SHP-2026-00001');
    expect(data.data.status).toBe('in_transit');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useShipment(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ── Create ───────────────────────────────────────────────────────────────────
describe('useCreateShipment', () => {
  it('creates a new shipment with draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateShipment(), { wrapper });

    act(() => {
      result.current.mutate({
        origin: 'Riyadh',
        destination: 'Jeddah',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ship-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.origin).toBe('Riyadh');
    expect(data.data.destination).toBe('Jeddah');
  });
});

// ── Update ───────────────────────────────────────────────────────────────────
describe('useUpdateShipment', () => {
  it('updates an existing shipment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateShipment(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'ship-1',
        notes: 'Updated shipment notes',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ship-1');
    expect(data.data.notes).toBe('Updated shipment notes');
  });
});

// ── Update Status ────────────────────────────────────────────────────────────
describe('useUpdateShipmentStatus', () => {
  it('transitions shipment to a new status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateShipmentStatus(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'ship-1',
        status: 'customs_clearance' as any,
        notes: 'Arrived at customs',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ship-1');
    expect(data.data.status).toBe('customs_clearance');
  });
});

// ── Add Customs Stage ────────────────────────────────────────────────────────
describe('useAddCustomsStage', () => {
  it('adds a customs tracking stage to a shipment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddCustomsStage(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'ship-1',
        stage: 'inspection',
        notes: 'Customs inspection started',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('customs-new');
    expect(data.data.shipmentId).toBe('ship-1');
    expect(data.data.stage).toBe('inspection');
  });
});

// ── Update Customs Stage ─────────────────────────────────────────────────────
describe('useUpdateCustomsStage', () => {
  it('updates an existing customs stage', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCustomsStage(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'ship-1',
        customsId: 'customs-1',
        status: 'cleared',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('customs-1');
    expect(data.data.shipmentId).toBe('ship-1');
    expect(data.data.status).toBe('cleared');
  });
});

// ── Deliver ──────────────────────────────────────────────────────────────────
describe('useDeliverShipment', () => {
  it('transitions shipment to delivered status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeliverShipment(), { wrapper });

    act(() => {
      result.current.mutate('ship-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ship-1');
    expect(data.data.status).toBe('delivered');
  });

  it('invalidates both shipments and mrrv queries on delivery', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useDeliverShipment(), { wrapper });

    act(() => {
      result.current.mutate('ship-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['shipments']);
    expect(invalidatedKeys).toContainEqual(['mrrv']);

    invalidateSpy.mockRestore();
  });
});

// ── Cancel ───────────────────────────────────────────────────────────────────
describe('useCancelShipment', () => {
  it('transitions shipment to cancelled status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelShipment(), { wrapper });

    act(() => {
      result.current.mutate('ship-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('ship-1');
    expect(data.data.status).toBe('cancelled');
  });
});
