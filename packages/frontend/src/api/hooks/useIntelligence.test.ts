import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useSmartDefaults,
  useAnomalies,
  useInventoryHealth,
  useReorderPredictions,
  useAutoUpdateReorderPoints,
} from './useIntelligence';

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

const mockDefaults = {
  warehouses: [{ id: 'wh-1', name: 'Main Warehouse', count: 42 }],
  projects: [{ id: 'proj-1', name: 'Project Alpha', count: 15 }],
  suppliers: [{ id: 'sup-1', name: 'Acme Corp', count: 8 }],
  recentItems: [{ id: 'item-1', code: 'ITEM-001', description: 'Steel Rod', lastUsed: '2026-02-20T10:00:00Z' }],
};

const mockAnomalies = [
  {
    type: 'quantity_spike',
    severity: 'high',
    description: 'Unusual spike in steel rods',
    itemId: 'item-1',
    detectedAt: '2026-02-20T08:00:00Z',
  },
  {
    type: 'negative_stock',
    severity: 'medium',
    description: 'Negative stock detected',
    warehouseId: 'wh-1',
    detectedAt: '2026-02-20T09:00:00Z',
  },
];

const mockHealth = {
  totalItems: 250,
  negativeStockCount: 3,
  lowStockCount: 12,
  overstockCount: 5,
  dormantItemCount: 18,
};

const mockPredictions = [
  {
    itemId: 'item-1',
    itemCode: 'ITEM-001',
    itemDescription: 'Steel Rod',
    warehouseId: 'wh-1',
    warehouseName: 'Main Warehouse',
    currentStock: 100,
    reservedQty: 20,
    effectiveStock: 80,
    avgDailyConsumption: 5,
    stdDevDailyConsumption: 1.2,
    estimatedLeadTimeDays: 7,
    reorderPoint: 50,
    currentReorderPoint: 45,
    daysUntilStockout: 16,
    predictedStockoutDate: '2026-03-08T00:00:00Z',
    suggestedOrderQty: 150,
    urgency: 'warning',
  },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/intelligence/defaults`, () => HttpResponse.json({ success: true, data: mockDefaults })),
    http.get(`${API}/intelligence/anomalies`, () => HttpResponse.json({ success: true, data: mockAnomalies })),
    http.get(`${API}/intelligence/inventory-health`, () => HttpResponse.json({ success: true, data: mockHealth })),
    http.get(`${API}/intelligence/reorder-predictions`, () =>
      HttpResponse.json({ success: true, data: mockPredictions }),
    ),
    http.post(`${API}/intelligence/reorder-predictions/auto-update`, () =>
      HttpResponse.json({ success: true, data: { updated: 12, total: 50 } }),
    ),
  );
});

// ── Smart Defaults Tests ────────────────────────────────────────────────────

describe('useSmartDefaults', () => {
  it('fetches smart defaults (always enabled)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSmartDefaults(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.warehouses).toHaveLength(1);
    expect(result.current.data?.data.warehouses[0].name).toBe('Main Warehouse');
    expect(result.current.data?.data.projects[0].name).toBe('Project Alpha');
    expect(result.current.data?.data.recentItems[0].code).toBe('ITEM-001');
  });
});

// ── Anomaly Detection Tests ─────────────────────────────────────────────────

describe('useAnomalies', () => {
  it('fetches anomalies without params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAnomalies(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].type).toBe('quantity_spike');
    expect(result.current.data?.data[0].severity).toBe('high');
    expect(result.current.data?.data[1].type).toBe('negative_stock');
  });

  it('fetches anomalies with filter params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAnomalies({ since: '2026-02-19T00:00:00Z', notify: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
  });
});

// ── Inventory Health Tests ──────────────────────────────────────────────────

describe('useInventoryHealth', () => {
  it('fetches inventory health summary', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInventoryHealth(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.totalItems).toBe(250);
    expect(result.current.data?.data.negativeStockCount).toBe(3);
    expect(result.current.data?.data.lowStockCount).toBe(12);
    expect(result.current.data?.data.overstockCount).toBe(5);
    expect(result.current.data?.data.dormantItemCount).toBe(18);
  });
});

// ── Reorder Predictions Tests ───────────────────────────────────────────────

describe('useReorderPredictions', () => {
  it('fetches predictions without warehouseId', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReorderPredictions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].itemCode).toBe('ITEM-001');
    expect(result.current.data?.data[0].urgency).toBe('warning');
    expect(result.current.data?.data[0].suggestedOrderQty).toBe(150);
  });

  it('fetches predictions filtered by warehouseId', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReorderPredictions('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
  });
});

// ── Auto-Update Reorder Points Tests ────────────────────────────────────────

describe('useAutoUpdateReorderPoints', () => {
  it('triggers auto-update and returns updated/total counts', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAutoUpdateReorderPoints(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.updated).toBe(12);
    expect(result.current.data?.data.total).toBe(50);
  });
});
