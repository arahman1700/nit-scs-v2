import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDashboards,
  useDashboard,
  useCreateDashboard,
  useUpdateDashboard,
  useDeleteDashboard,
  useAddWidget,
  useUpdateWidget,
  useDeleteWidget,
  useUpdateLayout,
} from './useDashboards';

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

const mockWidget = {
  id: 'w-1',
  dashboardId: 'dash-1',
  widgetType: 'kpi',
  title: 'Total GRNs',
  dataSource: 'grn_count',
  displayConfig: { color: 'blue' },
  position: 0,
  width: 3,
  height: 2,
};

const mockDashboards = [
  {
    id: 'dash-1',
    name: 'Operations Overview',
    description: 'Main ops dashboard',
    isDefault: true,
    widgets: [mockWidget],
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-02-15T12:00:00Z',
  },
  {
    id: 'dash-2',
    name: 'Warehouse KPIs',
    isDefault: false,
    widgets: [],
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-02-20T12:00:00Z',
  },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    // Dashboard CRUD
    http.get(`${API}/dashboards`, () => HttpResponse.json({ success: true, data: mockDashboards })),
    http.get(`${API}/dashboards/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockDashboards[0], id: params.id } }),
    ),
    http.post(`${API}/dashboards`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'dash-new', widgets: [], ...(body as object) },
      });
    }),
    http.put(`${API}/dashboards/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/dashboards/:id`, () => new HttpResponse(null, { status: 204 })),
    // Widget management
    http.post(`${API}/dashboards/:dashboardId/widgets`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: 'w-new', ...(body as object) },
      });
    }),
    http.put(`${API}/dashboards/:dashboardId/widgets/:widgetId`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { id: params.widgetId, ...(body as object) },
      });
    }),
    http.delete(`${API}/dashboards/:dashboardId/widgets/:widgetId`, () => new HttpResponse(null, { status: 204 })),
    // Layout
    http.put(`${API}/dashboards/:dashboardId/layout`, () => HttpResponse.json({ success: true, data: null })),
  );
});

// ── Dashboard Query Tests ───────────────────────────────────────────────────

describe('useDashboards', () => {
  it('fetches the list of dashboards', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboards(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].name).toBe('Operations Overview');
    expect(result.current.data?.data[0].widgets).toHaveLength(1);
    expect(result.current.data?.data[1].isDefault).toBe(false);
  });
});

describe('useDashboard', () => {
  it('fetches a single dashboard by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboard('dash-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('dash-1');
    expect(result.current.data?.data.name).toBe('Operations Overview');
    expect(result.current.data?.data.widgets).toHaveLength(1);
  });

  it('does not fetch when id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDashboard(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Dashboard Mutation Tests ────────────────────────────────────────────────

describe('useCreateDashboard', () => {
  it('creates a new dashboard', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateDashboard(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'New Dashboard', description: 'Testing' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('dash-new');
    expect(result.current.data?.data.name).toBe('New Dashboard');
  });
});

describe('useUpdateDashboard', () => {
  it('updates an existing dashboard', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateDashboard(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'dash-1', name: 'Updated Dashboard' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('dash-1');
    expect(result.current.data?.data.name).toBe('Updated Dashboard');
  });
});

describe('useDeleteDashboard', () => {
  it('deletes a dashboard (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteDashboard(), { wrapper });

    act(() => {
      result.current.mutate('dash-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ── Widget Tests ────────────────────────────────────────────────────────────

describe('useAddWidget', () => {
  it('adds a widget to a dashboard', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddWidget(), { wrapper });

    act(() => {
      result.current.mutate({
        dashboardId: 'dash-1',
        widgetType: 'chart',
        title: 'Monthly Trend',
        dataSource: 'grn_monthly',
        width: 6,
        height: 4,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('w-new');
    expect(result.current.data?.data.title).toBe('Monthly Trend');
    expect(result.current.data?.data.widgetType).toBe('chart');
  });
});

describe('useUpdateWidget', () => {
  it('updates a widget on a dashboard', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateWidget(), { wrapper });

    act(() => {
      result.current.mutate({
        dashboardId: 'dash-1',
        widgetId: 'w-1',
        title: 'Updated KPI',
        width: 4,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('w-1');
    expect(result.current.data?.data.title).toBe('Updated KPI');
  });
});

describe('useDeleteWidget', () => {
  it('deletes a widget from a dashboard (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteWidget(), { wrapper });

    act(() => {
      result.current.mutate({ dashboardId: 'dash-1', widgetId: 'w-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateLayout', () => {
  it('updates widget layout positions (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateLayout(), { wrapper });

    act(() => {
      result.current.mutate({
        dashboardId: 'dash-1',
        layout: [
          { widgetId: 'w-1', position: 1, width: 6, height: 4 },
          { widgetId: 'w-2', position: 0, width: 3, height: 2 },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
