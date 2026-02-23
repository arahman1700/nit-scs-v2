import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useCustomDataSourceList,
  useCustomDataSource,
  useCreateCustomDataSource,
  useUpdateCustomDataSource,
  useDeleteCustomDataSource,
  useTestCustomDataSource,
  usePreviewCustomDataSource,
} from './useCustomDataSources';

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

const mockDataSources = [
  {
    id: 'ds-1',
    name: 'GRN Count',
    sourceKey: 'grn_count',
    entityType: 'mrrv',
    aggregation: 'count',
    queryTemplate: { entityType: 'mrrv', filters: [] },
    outputType: 'number',
    isPublic: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'ds-2',
    name: 'MI by Project',
    sourceKey: 'mi_by_project',
    entityType: 'mirv',
    aggregation: 'group_by',
    queryTemplate: { entityType: 'mirv', groupBy: 'projectId' },
    outputType: 'grouped',
    isPublic: false,
    createdAt: '2026-01-16T10:00:00Z',
  },
];

const mockTestResult = { value: 42, executedAt: '2026-02-20T10:00:00Z' };

const mockPreviewResult = {
  value: [
    { group: 'Project A', count: 10 },
    { group: 'Project B', count: 5 },
  ],
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/custom-data-sources`, () => HttpResponse.json({ success: true, data: mockDataSources })),
    http.get(`${API}/custom-data-sources/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockDataSources[0], id: params.id } }),
    ),
    http.post(`${API}/custom-data-sources`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'ds-new', ...(body as object) } });
    }),
    http.put(`${API}/custom-data-sources/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/custom-data-sources/:id`, () => new HttpResponse(null, { status: 204 })),
    http.post(`${API}/custom-data-sources/:id/test`, () => HttpResponse.json({ success: true, data: mockTestResult })),
    http.post(`${API}/custom-data-sources/preview`, () =>
      HttpResponse.json({ success: true, data: mockPreviewResult }),
    ),
  );
});

// ── Query Tests ─────────────────────────────────────────────────────────────

describe('useCustomDataSourceList', () => {
  it('fetches the list of custom data sources', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomDataSourceList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].name).toBe('GRN Count');
    expect(result.current.data?.data[1].aggregation).toBe('group_by');
  });
});

describe('useCustomDataSource', () => {
  it('fetches a single data source by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomDataSource('ds-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('ds-1');
    expect(result.current.data?.data.sourceKey).toBe('grn_count');
  });

  it('does not fetch when id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomDataSource(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Mutation Tests ──────────────────────────────────────────────────────────

describe('useCreateCustomDataSource', () => {
  it('creates a new data source', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateCustomDataSource(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'New Source',
        sourceKey: 'new_source',
        entityType: 'mrrv',
        aggregation: 'sum',
        queryTemplate: { entityType: 'mrrv', sumField: 'totalQty' },
        outputType: 'number',
        isPublic: true,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('ds-new');
    expect(result.current.data?.data.name).toBe('New Source');
  });
});

describe('useUpdateCustomDataSource', () => {
  it('updates an existing data source', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCustomDataSource(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'ds-1', name: 'Updated GRN Count' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('ds-1');
    expect(result.current.data?.data.name).toBe('Updated GRN Count');
  });
});

describe('useDeleteCustomDataSource', () => {
  it('deletes a data source (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteCustomDataSource(), { wrapper });

    act(() => {
      result.current.mutate('ds-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useTestCustomDataSource', () => {
  it('tests a data source and returns the result', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTestCustomDataSource(), { wrapper });

    act(() => {
      result.current.mutate('ds-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual(mockTestResult);
  });
});

describe('usePreviewCustomDataSource', () => {
  it('previews a data source query without saving', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePreviewCustomDataSource(), { wrapper });

    act(() => {
      result.current.mutate({
        entityType: 'mirv',
        aggregation: 'group_by',
        queryTemplate: { entityType: 'mirv', groupBy: 'projectId' },
        outputType: 'grouped',
        name: 'Preview Test',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual(mockPreviewResult);
  });
});
