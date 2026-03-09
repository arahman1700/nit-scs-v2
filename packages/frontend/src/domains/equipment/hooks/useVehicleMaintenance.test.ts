import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useVehicleMaintenanceList,
  useVehicleMaintenance,
  useCreateVehicleMaintenance,
  useUpdateVehicleMaintenance,
  useCompleteVehicleMaintenance,
  useCancelVehicleMaintenance,
} from './useVehicleMaintenance';

const API = '/api/v1';

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

// ############################################################################
// LIST
// ############################################################################

describe('useVehicleMaintenanceList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/vehicle-maintenance`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'vm-1', vehicleId: 'v-1', type: 'oil_change', status: 'scheduled' },
            { id: 'vm-2', vehicleId: 'v-2', type: 'tire_rotation', status: 'completed' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches vehicle maintenance list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVehicleMaintenanceList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].type).toBe('oil_change');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVehicleMaintenanceList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useVehicleMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/vehicle-maintenance/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, vehicleId: 'v-1', type: 'oil_change', status: 'scheduled' },
        }),
      ),
    );
  });

  it('fetches a single vehicle maintenance record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVehicleMaintenance('vm-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('vm-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVehicleMaintenance(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateVehicleMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/vehicle-maintenance`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'vm-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new vehicle maintenance record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateVehicleMaintenance(), { wrapper });

    act(() => {
      result.current.mutate({ vehicleId: 'v-1', type: 'brake_inspection' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('vm-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateVehicleMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/vehicle-maintenance/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a vehicle maintenance record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateVehicleMaintenance(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'vm-1', notes: 'Updated notes' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('vm-1');
  });
});

// ############################################################################
// COMPLETE
// ############################################################################

describe('useCompleteVehicleMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/vehicle-maintenance/:id/complete`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'completed' },
        }),
      ),
    );
  });

  it('completes a vehicle maintenance with work details', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteVehicleMaintenance(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'vm-1', workPerformed: 'Oil changed', partsUsed: 'Oil filter', cost: 150 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('completed');
  });
});

// ############################################################################
// CANCEL
// ############################################################################

describe('useCancelVehicleMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/vehicle-maintenance/:id/cancel`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'cancelled' },
        }),
      ),
    );
  });

  it('cancels a vehicle maintenance', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelVehicleMaintenance(), { wrapper });

    act(() => {
      result.current.mutate('vm-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('cancelled');
  });

  it('invalidates vehicle-maintenance queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCancelVehicleMaintenance(), { wrapper });

    act(() => {
      result.current.mutate('vm-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['vehicle-maintenance']);

    invalidateSpy.mockRestore();
  });
});
