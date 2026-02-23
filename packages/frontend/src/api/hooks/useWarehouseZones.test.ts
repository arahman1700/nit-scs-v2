import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useWarehouseZoneList,
  useWarehouseZone,
  useCreateWarehouseZone,
  useUpdateWarehouseZone,
  useDeleteWarehouseZone,
} from './useWarehouseZones';

// Mock localStorage for axios request interceptor (client.ts reads token)
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

const API = '/api/v1';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const mockZones = [
  {
    id: 'zone-1',
    name: 'Receiving Bay',
    warehouseId: 'wh-1',
    zoneType: 'receiving',
    capacity: 500,
    currentOccupancy: 120,
  },
  {
    id: 'zone-2',
    name: 'Cold Storage',
    warehouseId: 'wh-1',
    zoneType: 'storage',
    capacity: 200,
    currentOccupancy: 80,
  },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/warehouse-zones`, () => HttpResponse.json({ success: true, data: mockZones })),
    http.get(`${API}/warehouse-zones/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockZones[0], id: params.id } }),
    ),
    http.post(`${API}/warehouse-zones`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'zone-new', ...(body as object) } });
    }),
    http.put(`${API}/warehouse-zones/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/warehouse-zones/:id`, () => new HttpResponse(null, { status: 204 })),
  );
});

// ── Query Tests ─────────────────────────────────────────────────────────────

describe('useWarehouseZoneList', () => {
  it('fetches the list of warehouse zones', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWarehouseZoneList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].name).toBe('Receiving Bay');
    expect(result.current.data?.data[1].zoneType).toBe('storage');
  });
});

describe('useWarehouseZone', () => {
  it('fetches a single warehouse zone by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWarehouseZone('zone-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('zone-1');
    expect(result.current.data?.data.name).toBe('Receiving Bay');
    expect(result.current.data?.data.capacity).toBe(500);
  });

  it('does not fetch when id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWarehouseZone(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Mutation Tests ──────────────────────────────────────────────────────────

describe('useCreateWarehouseZone', () => {
  it('creates a new warehouse zone', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateWarehouseZone(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'Shipping Dock',
        warehouseId: 'wh-1',
        zoneType: 'shipping',
        capacity: 300,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('zone-new');
    expect(result.current.data?.data.name).toBe('Shipping Dock');
    expect(result.current.data?.data.zoneType).toBe('shipping');
  });
});

describe('useUpdateWarehouseZone', () => {
  it('updates an existing warehouse zone', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateWarehouseZone(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'zone-1', name: 'Updated Bay', capacity: 600 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('zone-1');
    expect(result.current.data?.data.name).toBe('Updated Bay');
    expect(result.current.data?.data.capacity).toBe(600);
  });
});

describe('useDeleteWarehouseZone', () => {
  it('deletes a warehouse zone (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteWarehouseZone(), { wrapper });

    act(() => {
      result.current.mutate('zone-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
