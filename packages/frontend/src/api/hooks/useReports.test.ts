import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useInventoryReport,
  useJobOrderReport,
  useSlaReport,
  useMaterialMovementReport,
  useSupplierPerformanceReport,
  useFinancialReport,
} from './useReports';

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

const mockInventoryReport = {
  totalItems: 500,
  totalValue: 1250000,
  lowStockCount: 12,
  outOfStockCount: 3,
  byWarehouse: [{ warehouseId: 'wh-1', warehouseName: 'Main', itemCount: 300, totalValue: 750000 }],
};

const mockJobOrderReport = {
  total: 85,
  byStatus: { draft: 5, submitted: 10, approved: 15, in_progress: 30, completed: 20, cancelled: 5 },
  avgCompletionDays: 4.2,
};

const mockSlaReport = {
  overallCompliance: 92,
  byDocumentType: {
    mirv: { total: 100, onTime: 92, breached: 8 },
    jo: { total: 50, onTime: 45, breached: 5 },
  },
};

const mockMaterialMovementReport = {
  totalReceived: 5000,
  totalIssued: 3200,
  totalReturned: 150,
  topItems: [{ itemId: 'item-1', itemCode: 'ITM-001', itemName: 'Steel Bolt', totalQty: 800 }],
};

const mockSupplierPerformanceReport = {
  totalSuppliers: 25,
  avgDeliveryDays: 5.5,
  onTimeRate: 88,
  topSuppliers: [{ supplierId: 'sup-1', supplierName: 'Steel Corp', onTimeRate: 95, totalOrders: 40 }],
};

const mockFinancialReport = {
  totalPurchaseValue: 2500000,
  totalIssuedValue: 1800000,
  inventoryValue: 1250000,
  scrapValue: 50000,
  byMonth: [
    { month: '2026-01', purchases: 400000, issues: 300000 },
    { month: '2026-02', purchases: 350000, issues: 280000 },
  ],
};

// ############################################################################
// INVENTORY REPORT
// ############################################################################

describe('useInventoryReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/reports/inventory-summary`, () =>
        HttpResponse.json({ success: true, data: mockInventoryReport }),
      ),
    );
  });

  it('fetches inventory summary report when enabled', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInventoryReport({}, true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.totalItems).toBe(500);
    expect(data.data.totalValue).toBe(1250000);
    expect(data.data.lowStockCount).toBe(12);
    expect(data.data.byWarehouse).toBeInstanceOf(Array);
    expect(data.data.byWarehouse[0].warehouseName).toBe('Main');
  });
});

// ############################################################################
// JOB ORDER REPORT
// ############################################################################

describe('useJobOrderReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/reports/job-order-status`, () => HttpResponse.json({ success: true, data: mockJobOrderReport })),
    );
  });

  it('fetches job order status report when enabled', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJobOrderReport({}, true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.total).toBe(85);
    expect(data.data.byStatus.in_progress).toBe(30);
    expect(data.data.avgCompletionDays).toBe(4.2);
  });
});

// ############################################################################
// SLA REPORT
// ############################################################################

describe('useSlaReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/reports/sla-compliance`, () => HttpResponse.json({ success: true, data: mockSlaReport })),
    );
  });

  it('fetches SLA compliance report when enabled', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSlaReport({}, true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.overallCompliance).toBe(92);
    expect(data.data.byDocumentType.mirv.total).toBe(100);
    expect(data.data.byDocumentType.mirv.onTime).toBe(92);
    expect(data.data.byDocumentType.jo.breached).toBe(5);
  });
});

// ############################################################################
// MATERIAL MOVEMENT REPORT
// ############################################################################

describe('useMaterialMovementReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/reports/material-movement`, () =>
        HttpResponse.json({ success: true, data: mockMaterialMovementReport }),
      ),
    );
  });

  it('fetches material movement report when enabled', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMaterialMovementReport({}, true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.totalReceived).toBe(5000);
    expect(data.data.totalIssued).toBe(3200);
    expect(data.data.totalReturned).toBe(150);
    expect(data.data.topItems).toBeInstanceOf(Array);
    expect(data.data.topItems[0].itemCode).toBe('ITM-001');
  });
});

// ############################################################################
// SUPPLIER PERFORMANCE REPORT
// ############################################################################

describe('useSupplierPerformanceReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/reports/supplier-performance`, () =>
        HttpResponse.json({ success: true, data: mockSupplierPerformanceReport }),
      ),
    );
  });

  it('fetches supplier performance report when enabled', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSupplierPerformanceReport({}, true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.totalSuppliers).toBe(25);
    expect(data.data.avgDeliveryDays).toBe(5.5);
    expect(data.data.onTimeRate).toBe(88);
    expect(data.data.topSuppliers).toBeInstanceOf(Array);
    expect(data.data.topSuppliers[0].supplierName).toBe('Steel Corp');
    expect(data.data.topSuppliers[0].onTimeRate).toBe(95);
  });
});

// ############################################################################
// FINANCIAL REPORT
// ############################################################################

describe('useFinancialReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/reports/financial-summary`, () =>
        HttpResponse.json({ success: true, data: mockFinancialReport }),
      ),
    );
  });

  it('fetches financial summary report when enabled', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFinancialReport({}, true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.totalPurchaseValue).toBe(2500000);
    expect(data.data.totalIssuedValue).toBe(1800000);
    expect(data.data.inventoryValue).toBe(1250000);
    expect(data.data.scrapValue).toBe(50000);
    expect(data.data.byMonth).toBeInstanceOf(Array);
    expect(data.data.byMonth.length).toBe(2);
    expect(data.data.byMonth[0].month).toBe('2026-01');
    expect(data.data.byMonth[0].purchases).toBe(400000);
  });
});
