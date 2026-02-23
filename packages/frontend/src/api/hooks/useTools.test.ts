import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useToolList, useTool, useCreateTool, useUpdateTool, useDeleteTool, useDecommissionTool } from './useTools';

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
// LIST
// ############################################################################

describe('useToolList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/tools`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'tool-1', name: 'Drill Press', serialNumber: 'DP-001', status: 'active' },
            { id: 'tool-2', name: 'Impact Wrench', serialNumber: 'IW-002', status: 'active' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches tool list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useToolList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('tool-1');
    expect(data.data[0].name).toBe('Drill Press');
    expect(data.data[1].id).toBe('tool-2');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useToolList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useTool', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/tools/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, name: 'Drill Press', serialNumber: 'DP-001', status: 'active' },
        }),
      ),
    );
  });

  it('fetches a single tool by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTool('tool-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('tool-1');
    expect(data.data.name).toBe('Drill Press');
    expect(data.data.serialNumber).toBe('DP-001');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTool(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateTool', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/tools`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'tool-new', ...(body as object) },
        });
      }),
    );
  });

  it('creates a new tool', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateTool(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'Torque Wrench', serialNumber: 'TW-003', status: 'active' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('tool-new');
    expect(data.data.name).toBe('Torque Wrench');
    expect(data.data.serialNumber).toBe('TW-003');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateTool', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/tools/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object) },
        });
      }),
    );
  });

  it('updates an existing tool', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateTool(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'tool-1', name: 'Updated Drill Press', status: 'maintenance' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('tool-1');
    expect(data.data.name).toBe('Updated Drill Press');
    expect(data.data.status).toBe('maintenance');
  });
});

// ############################################################################
// DELETE
// ############################################################################

describe('useDeleteTool', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(http.delete(`${API}/tools/:id`, () => new HttpResponse(null, { status: 204 })));
  });

  it('deletes a tool by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteTool(), { wrapper });

    act(() => {
      result.current.mutate('tool-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('invalidates tools queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useDeleteTool(), { wrapper });

    act(() => {
      result.current.mutate('tool-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['tools']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// DECOMMISSION
// ############################################################################

describe('useDecommissionTool', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/tools/:id/decommission`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'decommissioned' },
        }),
      ),
    );
  });

  it('decommissions a tool and returns decommissioned status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDecommissionTool(), { wrapper });

    act(() => {
      result.current.mutate('tool-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('tool-1');
    expect(data.data.status).toBe('decommissioned');
  });
});
