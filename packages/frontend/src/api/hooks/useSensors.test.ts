import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useSensorList,
  useSensor,
  useCreateSensor,
  useUpdateSensor,
  useDeleteSensor,
  useIngestReading,
  useSensorReadings,
  useSensorAlerts,
  useAcknowledgeAlert,
  useSensorStatus,
  useZoneHeatmap,
} from './useSensors';

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
// SENSOR LIST
// ############################################################################

describe('useSensorList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/sensors`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'sensor-1',
              sensorCode: 'TEMP-001',
              sensorType: 'temperature',
              warehouseId: 'wh-1',
              isActive: true,
              unit: 'C',
              lastValue: 22.5,
            },
            {
              id: 'sensor-2',
              sensorCode: 'HUM-001',
              sensorType: 'humidity',
              warehouseId: 'wh-1',
              isActive: true,
              unit: '%',
              lastValue: 55,
            },
          ],
        }),
      ),
    );
  });

  it('fetches sensor list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensorList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('sensor-1');
    expect(data.data[0].sensorCode).toBe('TEMP-001');
    expect(data.data[0].sensorType).toBe('temperature');
    expect(data.data[1].id).toBe('sensor-2');
    expect(data.data[1].sensorType).toBe('humidity');
  });

  it('accepts optional filter params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useSensorList({ warehouseId: 'wh-1', sensorType: 'temperature', isActive: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// SENSOR DETAIL
// ############################################################################

describe('useSensor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/sensors/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            sensorCode: 'TEMP-001',
            sensorType: 'temperature',
            warehouseId: 'wh-1',
            isActive: true,
            unit: 'C',
            lastValue: 22.5,
          },
        }),
      ),
    );
  });

  it('fetches a single sensor by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensor('sensor-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('sensor-1');
    expect(data.data.sensorCode).toBe('TEMP-001');
    expect(data.data.sensorType).toBe('temperature');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensor(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE SENSOR
// ############################################################################

describe('useCreateSensor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/sensors`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'sensor-new', ...(body as object) },
        });
      }),
    );
  });

  it('creates a new sensor', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateSensor(), { wrapper });

    act(() => {
      result.current.mutate({ sensorCode: 'TEMP-003', sensorType: 'temperature', warehouseId: 'wh-1', unit: 'C' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('sensor-new');
    expect(data.data.sensorCode).toBe('TEMP-003');
    expect(data.data.sensorType).toBe('temperature');
  });
});

// ############################################################################
// UPDATE SENSOR
// ############################################################################

describe('useUpdateSensor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/sensors/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object) },
        });
      }),
    );
  });

  it('updates an existing sensor', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateSensor(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'sensor-1', isActive: false, maxThreshold: 30 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('sensor-1');
    expect(data.data.isActive).toBe(false);
    expect(data.data.maxThreshold).toBe(30);
  });
});

// ############################################################################
// DELETE SENSOR
// ############################################################################

describe('useDeleteSensor', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(http.delete(`${API}/sensors/:id`, () => new HttpResponse(null, { status: 204 })));
  });

  it('deletes a sensor by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteSensor(), { wrapper });

    act(() => {
      result.current.mutate('sensor-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('invalidates sensors queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useDeleteSensor(), { wrapper });

    act(() => {
      result.current.mutate('sensor-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['sensors']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// INGEST READING
// ############################################################################

describe('useIngestReading', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/sensors/readings`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'reading-new', ...(body as object), recordedAt: '2026-02-23T10:00:00Z' },
        });
      }),
    );
  });

  it('ingests a sensor reading and returns it', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useIngestReading(), { wrapper });

    act(() => {
      result.current.mutate({ sensorId: 'sensor-1', value: 24.5 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('reading-new');
    expect(data.data.sensorId).toBe('sensor-1');
    expect(data.data.value).toBe(24.5);
  });

  it('invalidates sensors, sensor-readings, and sensor-alerts on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useIngestReading(), { wrapper });

    act(() => {
      result.current.mutate({ sensorId: 'sensor-1', value: 24.5 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['sensors']);
    expect(invalidatedKeys).toContainEqual(['sensor-readings']);
    expect(invalidatedKeys).toContainEqual(['sensor-alerts']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// SENSOR READINGS
// ############################################################################

describe('useSensorReadings', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/sensors/readings/:sensorId`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'r-1', sensorId: 'sensor-1', value: 22.5, recordedAt: '2026-02-23T08:00:00Z' },
            { id: 'r-2', sensorId: 'sensor-1', value: 23.0, recordedAt: '2026-02-23T09:00:00Z' },
          ],
        }),
      ),
    );
  });

  it('fetches readings for a sensor', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensorReadings('sensor-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('r-1');
    expect(data.data[0].value).toBe(22.5);
    expect(data.data[1].value).toBe(23.0);
  });

  it('does not fetch when sensorId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensorReadings(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// SENSOR ALERTS
// ############################################################################

describe('useSensorAlerts', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/sensors/alerts`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'alert-1',
              sensorId: 'sensor-1',
              alertType: 'threshold_high',
              value: 35.2,
              threshold: 30,
              message: 'Temperature exceeds max',
              acknowledged: false,
              createdAt: '2026-02-23T10:00:00Z',
            },
            {
              id: 'alert-2',
              sensorId: 'sensor-2',
              alertType: 'offline',
              value: null,
              threshold: null,
              message: 'Sensor offline',
              acknowledged: true,
              createdAt: '2026-02-23T09:00:00Z',
            },
          ],
        }),
      ),
    );
  });

  it('fetches sensor alerts (always enabled)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensorAlerts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('alert-1');
    expect(data.data[0].alertType).toBe('threshold_high');
    expect(data.data[0].acknowledged).toBe(false);
    expect(data.data[1].id).toBe('alert-2');
    expect(data.data[1].alertType).toBe('offline');
    expect(data.data[1].acknowledged).toBe(true);
  });

  it('accepts optional warehouseId and acknowledged params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensorAlerts('wh-1', false), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// ACKNOWLEDGE ALERT
// ############################################################################

describe('useAcknowledgeAlert', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/sensors/alerts/:alertId/acknowledge`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.alertId, acknowledged: true, acknowledgedAt: '2026-02-23T10:30:00Z' },
        }),
      ),
    );
  });

  it('acknowledges an alert', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAcknowledgeAlert(), { wrapper });

    act(() => {
      result.current.mutate('alert-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('alert-1');
    expect(data.data.acknowledged).toBe(true);
  });
});

// ############################################################################
// SENSOR STATUS
// ############################################################################

describe('useSensorStatus', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/sensors/status/:warehouseId`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'sensor-1', sensorCode: 'TEMP-001', sensorType: 'temperature', isActive: true, lastValue: 22.5 },
            { id: 'sensor-2', sensorCode: 'HUM-001', sensorType: 'humidity', isActive: true, lastValue: 55 },
          ],
        }),
      ),
    );
  });

  it('fetches sensor status for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensorStatus('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].sensorCode).toBe('TEMP-001');
    expect(data.data[1].sensorCode).toBe('HUM-001');
  });

  it('does not fetch when warehouseId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSensorStatus(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// ZONE HEATMAP
// ############################################################################

describe('useZoneHeatmap', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/sensors/heatmap/:warehouseId`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'zone-1',
              zoneName: 'Zone A',
              zoneCode: 'ZA',
              zoneType: 'storage',
              avgTemperature: 22.5,
              avgHumidity: 55,
            },
            {
              id: 'zone-2',
              zoneName: 'Zone B',
              zoneCode: 'ZB',
              zoneType: 'cold',
              avgTemperature: 4.0,
              avgHumidity: 70,
            },
          ],
        }),
      ),
    );
  });

  it('fetches zone heatmap for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useZoneHeatmap('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].zoneName).toBe('Zone A');
    expect(data.data[0].avgTemperature).toBe(22.5);
    expect(data.data[0].avgHumidity).toBe(55);
    expect(data.data[1].zoneName).toBe('Zone B');
    expect(data.data[1].avgTemperature).toBe(4.0);
  });

  it('does not fetch when warehouseId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useZoneHeatmap(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
