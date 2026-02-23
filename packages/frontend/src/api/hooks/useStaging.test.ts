import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useStagingZones,
  useStagingAssignments,
  useCreateStagingAssignment,
  useMoveFromStaging,
  useStagingAlerts,
  useStagingOccupancy,
} from './useStaging';

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

const mockZone = {
  id: 'sz-1',
  warehouseId: 'wh-1',
  zoneName: 'Inbound Staging',
  zoneCode: 'IS-01',
  zoneType: 'inbound',
  capacity: 100,
  currentOccupancy: 35,
  activeAssignments: 5,
  totalStagedQty: 250,
};

const mockAssignment = {
  id: 'sa-1',
  zoneId: 'sz-1',
  warehouseId: 'wh-1',
  itemId: 'item-1',
  sourceDocType: 'grn',
  sourceDocId: 'grn-1',
  quantity: 50,
  assignedById: 'user-1',
  direction: 'inbound',
  status: 'staged',
  stagedAt: '2026-02-01T08:00:00Z',
  movedAt: null,
  maxDwellHours: 24,
  notes: null,
  createdAt: '2026-02-01T08:00:00Z',
  updatedAt: '2026-02-01T08:00:00Z',
};

const mockOccupancy = {
  zoneId: 'sz-1',
  zoneName: 'Inbound Staging',
  zoneCode: 'IS-01',
  zoneType: 'inbound',
  capacity: 100,
  currentOccupancy: 35,
  stagedCount: 5,
  stagedQty: 250,
  utilizationPct: 35,
};

// ############################################################################
// STAGING ZONES
// ############################################################################

describe('useStagingZones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.get(`${API}/staging/zones`, () => HttpResponse.json({ success: true, data: [mockZone] })));
  });

  it('fetches staging zones for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStagingZones('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('sz-1');
    expect(data.data[0].zoneName).toBe('Inbound Staging');
    expect(data.data[0].zoneCode).toBe('IS-01');
    expect(data.data[0].capacity).toBe(100);
    expect(data.data[0].currentOccupancy).toBe(35);
    expect(data.data[0].activeAssignments).toBe(5);
  });
});

// ############################################################################
// ASSIGNMENTS
// ############################################################################

describe('useStagingAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.get(`${API}/staging`, () => HttpResponse.json({ success: true, data: [mockAssignment] })));
  });

  it('fetches staging assignments with filters', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStagingAssignments({ warehouseId: 'wh-1' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('sa-1');
    expect(data.data[0].sourceDocType).toBe('grn');
    expect(data.data[0].direction).toBe('inbound');
    expect(data.data[0].status).toBe('staged');
    expect(data.data[0].quantity).toBe(50);
  });
});

// ############################################################################
// CREATE ASSIGNMENT
// ############################################################################

describe('useCreateStagingAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/staging`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'sa-new', ...(body as object), status: 'staged', stagedAt: '2026-02-20T10:00:00Z' },
        });
      }),
    );
  });

  it('creates a new staging assignment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateStagingAssignment(), { wrapper });

    act(() => {
      result.current.mutate({
        zoneId: 'sz-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        sourceDocType: 'grn',
        sourceDocId: 'grn-1',
        quantity: 25,
        assignedById: 'user-1',
        direction: 'inbound',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('sa-new');
    expect(data.data.status).toBe('staged');
    expect(data.data.zoneId).toBe('sz-1');
    expect(data.data.quantity).toBe(25);
  });
});

// ############################################################################
// MOVE FROM STAGING
// ############################################################################

describe('useMoveFromStaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/staging/:id/move`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { ...mockAssignment, id: params.id, status: 'moved', movedAt: '2026-02-20T12:00:00Z' },
        }),
      ),
    );
  });

  it('moves an assignment from staging', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMoveFromStaging(), { wrapper });

    act(() => {
      result.current.mutate('sa-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('sa-1');
    expect(data.data.status).toBe('moved');
    expect(data.data.movedAt).toBe('2026-02-20T12:00:00Z');
  });
});

// ############################################################################
// ALERTS
// ############################################################################

describe('useStagingAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/staging/alerts`, () =>
        HttpResponse.json({
          success: true,
          data: [{ ...mockAssignment, id: 'sa-alert-1', status: 'staged', maxDwellHours: 2 }],
        }),
      ),
    );
  });

  it('fetches staging alerts for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStagingAlerts('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('sa-alert-1');
    expect(data.data[0].maxDwellHours).toBe(2);
  });
});

// ############################################################################
// OCCUPANCY
// ############################################################################

describe('useStagingOccupancy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.get(`${API}/staging/occupancy`, () => HttpResponse.json({ success: true, data: [mockOccupancy] })));
  });

  it('fetches staging occupancy for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStagingOccupancy('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].zoneId).toBe('sz-1');
    expect(data.data[0].zoneName).toBe('Inbound Staging');
    expect(data.data[0].capacity).toBe(100);
    expect(data.data[0].currentOccupancy).toBe(35);
    expect(data.data[0].utilizationPct).toBe(35);
    expect(data.data[0].stagedCount).toBe(5);
  });
});
