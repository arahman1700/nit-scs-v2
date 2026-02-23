import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDashboardStats,
  useRecentActivity,
  useInventorySummary,
  useDocumentCounts,
  useSLACompliance,
  useTopProjects,
  useCrossDepartment,
  useExceptions,
  flattenSLA,
} from './useDashboard';
import type { SLACompliance } from './useDashboard';

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

const mockStats = {
  pendingRequests: 5,
  activeJobs: 3,
  incomingShipments: 2,
  lowStockItems: 1,
};

const mockActivity = [
  {
    id: 'act-1',
    time: '2026-02-20T10:00:00Z',
    action: 'Created GRN',
    user: 'Ahmed',
    details: 'GRN-2026-00001',
    type: 'success',
  },
  {
    id: 'act-2',
    time: '2026-02-20T09:00:00Z',
    action: 'Approved MI',
    user: 'Omar',
    details: 'MI-2026-00012',
    type: 'info',
  },
];

const mockInventory = {
  totalItems: 500,
  totalQty: 12000,
  lowStock: 15,
  outOfStock: 3,
  totalValue: 1250000,
  byCategory: [
    { name: 'Electrical', value: 450000 },
    { name: 'Mechanical', value: 800000 },
  ],
};

const mockDocCounts = {
  mrrv: { total: 45, pending: 8 },
  mirv: { total: 30, pending: 5 },
  jo: { total: 20, inProgress: 12 },
  shipments: { total: 10, inTransit: 4 },
};

const mockSLA: SLACompliance = {
  mirv: { total: 100, onTime: 85, breached: 10, pending: 5 },
  jo: { total: 50, onTime: 90, breached: 5, pending: 5 },
};

const mockTopProjects = [
  { id: 'proj-1', name: 'NEOM Phase 1', client: 'NEOM Co', activeJobs: 12, pendingMirv: 3 },
  { id: 'proj-2', name: 'Jeddah Tower', client: 'JEC', activeJobs: 8, pendingMirv: 1 },
];

const mockCrossDepartment = {
  inventory: {
    totalInventoryValue: 2500000,
    lowStockAlerts: 7,
    blockedLots: 2,
    warehouses: [
      {
        warehouseId: 'wh-1',
        warehouseName: 'Main Warehouse',
        warehouseCode: 'WH-001',
        itemCount: 300,
        totalQty: 8000,
        totalValue: 1500000,
      },
    ],
  },
  documentPipeline: {
    mrrv: { total: 45, byStatus: { draft: 5, submitted: 10, approved: 30 } },
  },
  recentActivity: [
    {
      id: 'log-1',
      tableName: 'mrrv',
      action: 'CREATE',
      performedAt: '2026-02-20T10:00:00Z',
      performedBy: { fullName: 'Ahmed Admin' },
    },
  ],
};

const mockExceptions = {
  overdueApprovals: {
    count: 3,
    items: [{ type: 'mirv', id: 'mirv-1', status: 'pending_approval', created_at: '2026-02-10T00:00:00Z' }],
  },
  slaBreaches: {
    count: 2,
    items: [{ id: 'sla-1', documentNumber: 'MI-2026-00005', slaDueDate: '2026-02-15', status: 'breached' }],
  },
  lowStock: {
    count: 5,
    items: [
      {
        item_id: 'item-1',
        item_code: 'EL-001',
        item_name: 'Cable 10mm',
        qty_on_hand: 10,
        min_level: 50,
        warehouse_name: 'Main Warehouse',
      },
    ],
  },
  stalledDocuments: {
    count: 1,
    items: [{ type: 'mrrv', id: 'mrrv-5', status: 'submitted', updated_at: '2026-01-20T00:00:00Z' }],
  },
  expiringInventory: {
    count: 2,
    items: [{ id: 'lot-1', expiryDate: '2026-03-01', item: { itemCode: 'CH-001', itemName: 'Adhesive' } }],
  },
  totalExceptions: 13,
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/dashboard/stats`, () => HttpResponse.json({ success: true, data: mockStats })),
    http.get(`${API}/dashboard/recent-activity`, () => HttpResponse.json({ success: true, data: mockActivity })),
    http.get(`${API}/dashboard/inventory-summary`, () => HttpResponse.json({ success: true, data: mockInventory })),
    http.get(`${API}/dashboard/document-counts`, () => HttpResponse.json({ success: true, data: mockDocCounts })),
    http.get(`${API}/dashboard/sla-compliance`, () => HttpResponse.json({ success: true, data: mockSLA })),
    http.get(`${API}/dashboard/top-projects`, () => HttpResponse.json({ success: true, data: mockTopProjects })),
    http.get(`${API}/dashboard/cross-department`, () =>
      HttpResponse.json({ success: true, data: mockCrossDepartment }),
    ),
    http.get(`${API}/dashboard/exceptions`, () => HttpResponse.json({ success: true, data: mockExceptions })),
  );
});

// ── Hook Tests ──────────────────────────────────────────────────────────────

describe('useDashboardStats', () => {
  it('fetches dashboard stats successfully', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboardStats(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ success: true, data: mockStats });
    expect(result.current.data?.data.pendingRequests).toBe(5);
    expect(result.current.data?.data.activeJobs).toBe(3);
    expect(result.current.data?.data.incomingShipments).toBe(2);
    expect(result.current.data?.data.lowStockItems).toBe(1);
  });
});

describe('useRecentActivity', () => {
  it('fetches activity list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRecentActivity(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].action).toBe('Created GRN');
    expect(result.current.data?.data[1].user).toBe('Omar');
  });
});

describe('useInventorySummary', () => {
  it('fetches inventory summary with categories', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInventorySummary(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const inv = result.current.data?.data;
    expect(inv?.totalItems).toBe(500);
    expect(inv?.totalQty).toBe(12000);
    expect(inv?.lowStock).toBe(15);
    expect(inv?.outOfStock).toBe(3);
    expect(inv?.totalValue).toBe(1250000);
    expect(inv?.byCategory).toHaveLength(2);
    expect(inv?.byCategory[0].name).toBe('Electrical');
  });
});

describe('useDocumentCounts', () => {
  it('fetches document pipeline counts', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentCounts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const counts = result.current.data?.data;
    expect(counts?.mrrv.total).toBe(45);
    expect(counts?.mrrv.pending).toBe(8);
    expect(counts?.mirv.total).toBe(30);
    expect(counts?.jo.inProgress).toBe(12);
    expect(counts?.shipments.inTransit).toBe(4);
  });
});

describe('useSLACompliance', () => {
  it('fetches SLA metrics', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSLACompliance(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const sla = result.current.data?.data;
    expect(sla?.mirv.total).toBe(100);
    expect(sla?.mirv.onTime).toBe(85);
    expect(sla?.mirv.breached).toBe(10);
    expect(sla?.jo.total).toBe(50);
    expect(sla?.jo.onTime).toBe(90);
  });
});

describe('useTopProjects', () => {
  it('fetches top projects', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTopProjects(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const projects = result.current.data?.data;
    expect(projects).toHaveLength(2);
    expect(projects?.[0].name).toBe('NEOM Phase 1');
    expect(projects?.[0].activeJobs).toBe(12);
    expect(projects?.[1].client).toBe('JEC');
  });
});

describe('useCrossDepartment', () => {
  it('fetches cross-department data', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCrossDepartment(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cd = result.current.data?.data;
    expect(cd?.inventory.totalInventoryValue).toBe(2500000);
    expect(cd?.inventory.lowStockAlerts).toBe(7);
    expect(cd?.inventory.blockedLots).toBe(2);
    expect(cd?.inventory.warehouses).toHaveLength(1);
    expect(cd?.inventory.warehouses[0].warehouseName).toBe('Main Warehouse');
    expect(cd?.documentPipeline.mrrv.total).toBe(45);
    expect(cd?.recentActivity).toHaveLength(1);
    expect(cd?.recentActivity[0].performedBy?.fullName).toBe('Ahmed Admin');
  });
});

describe('useExceptions', () => {
  it('fetches exceptions data', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExceptions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const ex = result.current.data?.data;
    expect(ex?.totalExceptions).toBe(13);
    expect(ex?.overdueApprovals.count).toBe(3);
    expect(ex?.slaBreaches.count).toBe(2);
    expect(ex?.lowStock.count).toBe(5);
    expect(ex?.lowStock.items[0].item_code).toBe('EL-001');
    expect(ex?.stalledDocuments.count).toBe(1);
    expect(ex?.expiringInventory.count).toBe(2);
    expect(ex?.expiringInventory.items[0].item.itemCode).toBe('CH-001');
  });
});

// ── flattenSLA Utility Tests ────────────────────────────────────────────────

describe('flattenSLA', () => {
  it('returns zeros when input is undefined', () => {
    const result = flattenSLA(undefined);
    expect(result).toEqual({ onTrack: 0, atRisk: 0, overdue: 0, compliancePct: 0 });
  });

  it('returns zeros when all totals are 0', () => {
    const sla: SLACompliance = {
      mirv: { total: 0, onTime: 0, breached: 0, pending: 0 },
      jo: { total: 0, onTime: 0, breached: 0, pending: 0 },
    };
    const result = flattenSLA(sla);
    expect(result).toEqual({ onTrack: 0, atRisk: 0, overdue: 0, compliancePct: 0 });
  });

  it('calculates correctly with real data', () => {
    const sla: SLACompliance = {
      mirv: { total: 100, onTime: 85, breached: 10, pending: 5 },
      jo: { total: 50, onTime: 90, breached: 5, pending: 5 },
    };
    const result = flattenSLA(sla);
    // onTrack = Math.round((85*100 + 90*50) / 150) = Math.round(13000/150) = 87
    // overdue = Math.round((10*100 + 5*50) / 150) = Math.round(1250/150) = 8
    // atRisk = Math.max(0, 100 - 87 - 8) = 5
    expect(result.onTrack).toBe(87);
    expect(result.overdue).toBe(8);
    expect(result.atRisk).toBe(5);
    expect(result.compliancePct).toBe(87);
  });
});
