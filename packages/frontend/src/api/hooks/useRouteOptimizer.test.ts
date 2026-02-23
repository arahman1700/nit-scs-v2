import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useUndeliveredJOs, useOptimizeRoute, useEstimateFuel } from './useRouteOptimizer';

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

const mockJO = {
  id: 'jo-1',
  joNumber: 'JO-2026-00001',
  joType: 'delivery',
  status: 'approved',
  description: 'Deliver steel bolts to Project Alpha',
  projectId: 'proj-1',
  projectName: 'Alpha Project',
  projectCode: 'ALP-001',
  latitude: 24.7136,
  longitude: 46.6753,
};

const mockRoute = {
  origin: {
    id: 'wh-1',
    name: 'Main Warehouse',
    latitude: 24.7,
    longitude: 46.65,
    type: 'warehouse',
  },
  stops: [
    {
      id: 'proj-1',
      name: 'Alpha Project',
      latitude: 24.7136,
      longitude: 46.6753,
      type: 'project',
      stopOrder: 1,
      distanceFromPrev: 5.2,
      cumulativeDistance: 5.2,
    },
    {
      id: 'proj-2',
      name: 'Beta Project',
      latitude: 24.73,
      longitude: 46.7,
      type: 'project',
      stopOrder: 2,
      distanceFromPrev: 3.8,
      cumulativeDistance: 9.0,
    },
  ],
  totalDistanceKm: 9.0,
  estimatedDurationMinutes: 25,
  estimatedFuelLiters: 1.8,
};

const mockFuelEstimate = {
  fuelLiters: 3.5,
  totalCost: 7.35,
};

// ############################################################################
// UNDELIVERED JOs
// ############################################################################

describe('useUndeliveredJOs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/route-optimizer/undelivered`, () => HttpResponse.json({ success: true, data: [mockJO] })),
    );
  });

  it('fetches undelivered job orders for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUndeliveredJOs('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('jo-1');
    expect(data.data[0].joNumber).toBe('JO-2026-00001');
    expect(data.data[0].joType).toBe('delivery');
    expect(data.data[0].projectName).toBe('Alpha Project');
    expect(data.data[0].latitude).toBe(24.7136);
    expect(data.data[0].longitude).toBe(46.6753);
  });
});

// ############################################################################
// OPTIMIZE ROUTE
// ############################################################################

describe('useOptimizeRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/route-optimizer/optimize`, () => HttpResponse.json({ success: true, data: mockRoute })),
    );
  });

  it('optimizes a delivery route', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimizeRoute(), { wrapper });

    act(() => {
      result.current.mutate({ warehouseId: 'wh-1', joIds: ['jo-1', 'jo-2'] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.origin.name).toBe('Main Warehouse');
    expect(data.data.stops).toBeInstanceOf(Array);
    expect(data.data.stops.length).toBe(2);
    expect(data.data.stops[0].stopOrder).toBe(1);
    expect(data.data.stops[0].distanceFromPrev).toBe(5.2);
    expect(data.data.stops[1].stopOrder).toBe(2);
    expect(data.data.stops[1].cumulativeDistance).toBe(9.0);
    expect(data.data.totalDistanceKm).toBe(9.0);
    expect(data.data.estimatedDurationMinutes).toBe(25);
    expect(data.data.estimatedFuelLiters).toBe(1.8);
  });
});

// ############################################################################
// ESTIMATE FUEL
// ############################################################################

describe('useEstimateFuel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/route-optimizer/estimate-fuel`, () =>
        HttpResponse.json({ success: true, data: mockFuelEstimate }),
      ),
    );
  });

  it('estimates fuel cost for a given distance and price', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEstimateFuel(), { wrapper });

    act(() => {
      result.current.mutate({ distanceKm: 35, fuelPrice: 2.1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.fuelLiters).toBe(3.5);
    expect(data.data.totalCost).toBe(7.35);
  });
});
