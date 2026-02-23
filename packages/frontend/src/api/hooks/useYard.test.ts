import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDockDoorList,
  useDockDoor,
  useAvailableDockDoors,
  useCreateDockDoor,
  useUpdateDockDoor,
  useDeleteDockDoor,
  useAppointmentList,
  useAppointment,
  useCreateAppointment,
  useCheckInAppointment,
  useCompleteAppointment,
  useCancelAppointment,
  useTruckVisitList,
  useCheckInTruck,
  useAssignDock,
  useCheckOutTruck,
  useYardStatus,
  useDockUtilization,
} from './useYard';

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

// ############################################################################
// DOCK DOORS
// ############################################################################

describe('useDockDoorList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/yard/dock-doors`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'door-1', doorNumber: 'D-01', doorType: 'inbound', status: 'available', warehouseId: 'wh-1' },
            { id: 'door-2', doorNumber: 'D-02', doorType: 'outbound', status: 'occupied', warehouseId: 'wh-1' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches dock door list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDockDoorList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('door-1');
    expect(data.data[0].doorNumber).toBe('D-01');
    expect(data.data[0].doorType).toBe('inbound');
    expect(data.data[0].status).toBe('available');
    expect(data.data[1].id).toBe('door-2');
    expect(data.data[1].status).toBe('occupied');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDockDoorList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useDockDoor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/yard/dock-doors/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, doorNumber: 'D-01', doorType: 'inbound', status: 'available', warehouseId: 'wh-1' },
        }),
      ),
    );
  });

  it('fetches a single dock door by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDockDoor('door-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('door-1');
    expect(data.data.doorNumber).toBe('D-01');
    expect(data.data.doorType).toBe('inbound');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDockDoor(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useAvailableDockDoors', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/yard/dock-doors/available`, () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 'door-1', doorNumber: 'D-01', doorType: 'inbound', status: 'available', warehouseId: 'wh-1' }],
        }),
      ),
    );
  });

  it('fetches available dock doors for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAvailableDockDoors('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('door-1');
    expect(data.data[0].status).toBe('available');
  });

  it('does not fetch when warehouseId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAvailableDockDoors(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateDockDoor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/yard/dock-doors`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'door-new', ...(body as object) },
        });
      }),
    );
  });

  it('creates a new dock door', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateDockDoor(), { wrapper });

    act(() => {
      result.current.mutate({ doorNumber: 'D-03', doorType: 'both', warehouseId: 'wh-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('door-new');
    expect(data.data.doorNumber).toBe('D-03');
    expect(data.data.doorType).toBe('both');
  });
});

describe('useUpdateDockDoor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/yard/dock-doors/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object) },
        });
      }),
    );
  });

  it('updates an existing dock door', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateDockDoor(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'door-1', status: 'maintenance' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('door-1');
    expect(data.data.status).toBe('maintenance');
  });
});

describe('useDeleteDockDoor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.delete(`${API}/yard/dock-doors/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id },
        }),
      ),
    );
  });

  it('deletes a dock door by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteDockDoor(), { wrapper });

    act(() => {
      result.current.mutate('door-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
  });

  it('invalidates yard queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useDeleteDockDoor(), { wrapper });

    act(() => {
      result.current.mutate('door-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['yard']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// APPOINTMENTS
// ############################################################################

describe('useAppointmentList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/yard/appointments`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'appt-1',
              appointmentType: 'delivery',
              status: 'scheduled',
              scheduledStart: '2026-02-20T08:00:00Z',
              scheduledEnd: '2026-02-20T09:00:00Z',
              warehouseId: 'wh-1',
            },
            {
              id: 'appt-2',
              appointmentType: 'pickup',
              status: 'checked_in',
              scheduledStart: '2026-02-20T10:00:00Z',
              scheduledEnd: '2026-02-20T11:00:00Z',
              warehouseId: 'wh-1',
            },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches appointment list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAppointmentList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('appt-1');
    expect(data.data[0].appointmentType).toBe('delivery');
    expect(data.data[0].status).toBe('scheduled');
    expect(data.data[1].id).toBe('appt-2');
    expect(data.data[1].status).toBe('checked_in');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });
});

describe('useAppointment', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/yard/appointments/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            appointmentType: 'delivery',
            status: 'scheduled',
            scheduledStart: '2026-02-20T08:00:00Z',
            scheduledEnd: '2026-02-20T09:00:00Z',
            warehouseId: 'wh-1',
          },
        }),
      ),
    );
  });

  it('fetches a single appointment by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAppointment('appt-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('appt-1');
    expect(data.data.appointmentType).toBe('delivery');
    expect(data.data.status).toBe('scheduled');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAppointment(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateAppointment', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/yard/appointments`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'appt-new', ...(body as object), status: 'scheduled' },
        });
      }),
    );
  });

  it('creates a new appointment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateAppointment(), { wrapper });

    act(() => {
      result.current.mutate({
        appointmentType: 'delivery',
        warehouseId: 'wh-1',
        scheduledStart: '2026-02-21T08:00:00Z',
        scheduledEnd: '2026-02-21T09:00:00Z',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('appt-new');
    expect(data.data.status).toBe('scheduled');
    expect(data.data.appointmentType).toBe('delivery');
  });
});

describe('useCheckInAppointment', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/yard/appointments/:id/check-in`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'checked_in' },
        }),
      ),
    );
  });

  it('checks in an appointment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCheckInAppointment(), { wrapper });

    act(() => {
      result.current.mutate('appt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('appt-1');
    expect(data.data.status).toBe('checked_in');
  });
});

describe('useCompleteAppointment', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/yard/appointments/:id/complete`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'completed' },
        }),
      ),
    );
  });

  it('completes an appointment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteAppointment(), { wrapper });

    act(() => {
      result.current.mutate('appt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('appt-1');
    expect(data.data.status).toBe('completed');
  });
});

describe('useCancelAppointment', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.delete(`${API}/yard/appointments/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'cancelled' },
        }),
      ),
    );
  });

  it('cancels an appointment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelAppointment(), { wrapper });

    act(() => {
      result.current.mutate('appt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('appt-1');
    expect(data.data.status).toBe('cancelled');
  });
});

// ############################################################################
// TRUCK VISITS
// ############################################################################

describe('useTruckVisitList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/yard/trucks`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'truck-1',
              vehiclePlate: 'ABC-1234',
              driverName: 'Ali',
              status: 'in_yard',
              purpose: 'delivery',
              warehouseId: 'wh-1',
              checkInAt: '2026-02-20T08:00:00Z',
            },
            {
              id: 'truck-2',
              vehiclePlate: 'XYZ-5678',
              driverName: 'Omar',
              status: 'at_dock',
              purpose: 'pickup',
              warehouseId: 'wh-1',
              checkInAt: '2026-02-20T09:00:00Z',
            },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches truck visit list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTruckVisitList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('truck-1');
    expect(data.data[0].vehiclePlate).toBe('ABC-1234');
    expect(data.data[0].status).toBe('in_yard');
    expect(data.data[1].id).toBe('truck-2');
    expect(data.data[1].status).toBe('at_dock');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });
});

describe('useCheckInTruck', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/yard/trucks/check-in`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'truck-new', ...(body as object), status: 'in_yard', checkInAt: '2026-02-20T10:00:00Z' },
        });
      }),
    );
  });

  it('checks in a truck and returns in_yard status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCheckInTruck(), { wrapper });

    act(() => {
      result.current.mutate({
        vehiclePlate: 'DEF-9999',
        driverName: 'Khalid',
        warehouseId: 'wh-1',
        purpose: 'delivery',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('truck-new');
    expect(data.data.vehiclePlate).toBe('DEF-9999');
    expect(data.data.status).toBe('in_yard');
  });
});

describe('useAssignDock', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/yard/trucks/:truckId/assign-dock`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.truckId, ...(body as object), status: 'at_dock' },
        });
      }),
    );
  });

  it('assigns a dock door to a truck', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAssignDock(), { wrapper });

    act(() => {
      result.current.mutate({ truckId: 'truck-1', dockDoorId: 'door-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('truck-1');
    expect(data.data.dockDoorId).toBe('door-1');
    expect(data.data.status).toBe('at_dock');
  });
});

describe('useCheckOutTruck', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/yard/trucks/:id/check-out`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'departed', checkOutAt: '2026-02-20T15:00:00Z' },
        }),
      ),
    );
  });

  it('checks out a truck and returns departed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCheckOutTruck(), { wrapper });

    act(() => {
      result.current.mutate('truck-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('truck-1');
    expect(data.data.status).toBe('departed');
  });
});

// ############################################################################
// YARD STATUS & UTILIZATION
// ############################################################################

describe('useYardStatus', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/yard/status`, () =>
        HttpResponse.json({
          success: true,
          data: {
            dockDoors: [
              { id: 'door-1', doorNumber: 'D-01', doorType: 'inbound', status: 'available', truckVisits: [] },
            ],
            activeTrucks: [{ id: 'truck-1', vehiclePlate: 'ABC-1234', status: 'in_yard' }],
            todayAppointments: [{ id: 'appt-1', status: 'scheduled' }],
            summary: {
              totalDocks: 5,
              occupiedDocks: 2,
              availableDocks: 2,
              maintenanceDocks: 1,
              trucksInYard: 3,
              appointmentsToday: 8,
              upcomingAppointments: 4,
            },
          },
        }),
      ),
    );
  });

  it('fetches yard status for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useYardStatus('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.dockDoors).toBeInstanceOf(Array);
    expect(data.data.activeTrucks).toBeInstanceOf(Array);
    expect(data.data.todayAppointments).toBeInstanceOf(Array);
    expect(data.data.summary.totalDocks).toBe(5);
    expect(data.data.summary.occupiedDocks).toBe(2);
    expect(data.data.summary.trucksInYard).toBe(3);
  });

  it('does not fetch when warehouseId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useYardStatus(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useDockUtilization', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/yard/utilization`, () =>
        HttpResponse.json({
          success: true,
          data: {
            date: '2026-02-20',
            dockMetrics: [
              {
                id: 'door-1',
                doorNumber: 'D-01',
                doorType: 'inbound',
                status: 'available',
                appointmentCount: 5,
                visitCount: 4,
                completedCount: 3,
                avgDwellMinutes: 45,
              },
            ],
            summary: {
              totalDocks: 5,
              totalAppointments: 20,
              completedAppointments: 15,
              cancelledAppointments: 2,
              noShowAppointments: 1,
              totalTruckVisits: 18,
              utilizationRate: 0.75,
            },
          },
        }),
      ),
    );
  });

  it('fetches dock utilization for a warehouse and date', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDockUtilization('wh-1', '2026-02-20'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.date).toBe('2026-02-20');
    expect(data.data.dockMetrics).toBeInstanceOf(Array);
    expect(data.data.dockMetrics[0].doorNumber).toBe('D-01');
    expect(data.data.dockMetrics[0].avgDwellMinutes).toBe(45);
    expect(data.data.summary.totalDocks).toBe(5);
    expect(data.data.summary.utilizationRate).toBe(0.75);
    expect(data.data.summary.totalTruckVisits).toBe(18);
  });

  it('does not fetch when warehouseId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDockUtilization(undefined, '2026-02-20'), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch when date is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDockUtilization('wh-1', undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
