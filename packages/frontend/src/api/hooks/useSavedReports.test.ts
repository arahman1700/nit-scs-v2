import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useSavedReports,
  useSavedReport,
  useCreateReport,
  useUpdateReport,
  useDeleteReport,
  useRunReport,
  useReportTemplates,
  useTemplateToReport,
} from './useSavedReports';

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

const mockReport = {
  id: 'rpt-1',
  name: 'Inventory Report',
  dataSource: 'inventory',
  columns: ['itemCode', 'qty'],
  filters: [],
  visualization: 'table',
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

const mockRunResult = {
  columns: ['itemCode', 'qty'],
  rows: [{ itemCode: 'ITM-001', qty: 50 }],
  totalCount: 1,
};

const mockTemplate = {
  ...mockReport,
  id: 'tpl-1',
  name: 'Template Report',
  isTemplate: true,
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/reports/saved/templates`, () => HttpResponse.json({ success: true, data: [mockTemplate] })),
    http.get(`${API}/reports/saved/:id`, () => HttpResponse.json({ success: true, data: mockReport })),
    http.get(`${API}/reports/saved`, () => HttpResponse.json({ success: true, data: [mockReport] })),
    http.post(`${API}/reports/saved/templates/:id/use`, () =>
      HttpResponse.json({
        success: true,
        data: { ...mockReport, id: 'rpt-from-tpl', name: 'Copy of Template Report' },
      }),
    ),
    http.post(`${API}/reports/saved/:id/run`, () => HttpResponse.json({ success: true, data: mockRunResult })),
    http.post(`${API}/reports/saved`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: {
          id: 'rpt-new',
          ...(body as object),
          createdAt: '2026-02-01T00:00:00Z',
          updatedAt: '2026-02-01T00:00:00Z',
        },
      });
    }),
    http.put(`${API}/reports/saved/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { ...mockReport, id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/reports/saved/:id`, () => new HttpResponse(null, { status: 204 })),
  );
});

// ── Hook Tests ──────────────────────────────────────────────────────────────

describe('useSavedReports', () => {
  it('fetches list of saved reports', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSavedReports(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].name).toBe('Inventory Report');
    expect(result.current.data?.data[0].dataSource).toBe('inventory');
  });
});

describe('useSavedReport', () => {
  it('fetches a single saved report by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSavedReport('rpt-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('rpt-1');
    expect(result.current.data?.data.columns).toEqual(['itemCode', 'qty']);
  });
});

describe('useCreateReport', () => {
  it('creates a new report', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateReport(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'New Report',
        dataSource: 'items',
        columns: ['itemCode', 'itemDescription'],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.name).toBe('New Report');
    expect(result.current.data?.data.dataSource).toBe('items');
  });
});

describe('useUpdateReport', () => {
  it('updates an existing report', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateReport(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rpt-1', name: 'Updated Report' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.name).toBe('Updated Report');
  });
});

describe('useDeleteReport', () => {
  it('deletes a report', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteReport(), { wrapper });

    act(() => {
      result.current.mutate('rpt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useRunReport', () => {
  it('runs a report and returns results', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRunReport(), { wrapper });

    act(() => {
      result.current.mutate('rpt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.columns).toEqual(['itemCode', 'qty']);
    expect(result.current.data?.data.rows).toHaveLength(1);
    expect(result.current.data?.data.totalCount).toBe(1);
  });
});

describe('useReportTemplates', () => {
  it('fetches list of report templates', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReportTemplates(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].name).toBe('Template Report');
    expect(result.current.data?.data[0].isTemplate).toBe(true);
  });
});

describe('useTemplateToReport', () => {
  it('copies a template to user reports', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTemplateToReport(), { wrapper });

    act(() => {
      result.current.mutate('tpl-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('rpt-from-tpl');
    expect(result.current.data?.data.name).toBe('Copy of Template Report');
  });
});
