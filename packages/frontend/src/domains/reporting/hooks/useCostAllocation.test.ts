import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useCostAllocation, useCostAllocationSummary } from './useCostAllocation';

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
// PER-PROJECT COST ALLOCATION
// ############################################################################

describe('useCostAllocation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/cost-allocation/:projectId`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            project: { id: params.projectId, projectName: 'Project Alpha', projectCode: 'PA-001' },
            dateRange: { from: '2026-01-01', to: '2026-03-31' },
            categories: {
              receiving: { count: 10, totalValue: 50000 },
              materialIssues: { count: 5, totalValue: 30000 },
              jobOrders: { count: 3, totalValue: 20000 },
              shipments: { count: 2, totalValue: 15000 },
              rentalEquipment: { count: 1, totalValue: 5000 },
            },
            grandTotal: 120000,
            monthlyBreakdown: [
              { month: '2026-01', total: 40000 },
              { month: '2026-02', total: 45000 },
              { month: '2026-03', total: 35000 },
            ],
          },
        }),
      ),
    );
  });

  it('fetches cost allocation for a project', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCostAllocation('proj-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data.project.projectCode).toBe('PA-001');
    expect(data.grandTotal).toBe(120000);
    expect(data.categories.receiving.count).toBe(10);
    expect(data.monthlyBreakdown).toHaveLength(3);
  });

  it('does not fetch when projectId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCostAllocation(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCostAllocation('proj-1'), { wrapper });
    expect(result.current).toBeDefined();
  });

  it('accepts optional date range parameters', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCostAllocation('proj-1', '2026-01-01', '2026-03-31'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.grandTotal).toBe(120000);
  });
});

// ############################################################################
// COST ALLOCATION SUMMARY
// ############################################################################

describe('useCostAllocationSummary', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/cost-allocation/summary`, () =>
        HttpResponse.json({
          success: true,
          data: {
            dateRange: { from: null, to: null },
            totals: {
              receiving: { count: 50, totalValue: 250000 },
              materialIssues: { count: 30, totalValue: 150000 },
              jobOrders: { count: 20, totalValue: 100000 },
              shipments: { count: 10, totalValue: 75000 },
              rentalEquipment: { count: 5, totalValue: 25000 },
            },
            grandTotal: 600000,
            projects: [
              {
                projectId: 'proj-1',
                projectName: 'Project Alpha',
                projectCode: 'PA-001',
                receiving: 50000,
                materialIssues: 30000,
                jobOrders: 20000,
                shipments: 15000,
                rentalEquipment: 5000,
                grandTotal: 120000,
              },
            ],
            monthlyBreakdown: [{ month: '2026-01', total: 200000 }],
          },
        }),
      ),
    );
  });

  it('fetches cost allocation summary', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCostAllocationSummary(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data.grandTotal).toBe(600000);
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].projectCode).toBe('PA-001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCostAllocationSummary(), { wrapper });
    expect(result.current).toBeDefined();
  });

  it('accepts optional date range parameters', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCostAllocationSummary('2026-01-01', '2026-03-31'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.grandTotal).toBe(600000);
  });
});
