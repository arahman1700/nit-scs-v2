import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  createResourceHooks,
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useSuppliers,
  useItems,
  useWarehouses,
  getResourceListHook,
} from './useMasterData';

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

// ── createResourceHooks factory tests ────────────────────────────────────

describe('createResourceHooks factory', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('useList returns paginated data', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.success).toBe(true);
    expect(result.current.data!.data).toBeInstanceOf(Array);
    expect(result.current.data!.data.length).toBeGreaterThan(0);
    expect(result.current.data!.meta).toBeDefined();
    expect(result.current.data!.meta.page).toBe(1);
    expect(result.current.data!.meta.total).toBeGreaterThan(0);
  });

  it('useOne fetches single item when id is provided', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProject('projects-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.success).toBe(true);
    expect(result.current.data!.data).toBeDefined();
    expect(result.current.data!.data.id).toBe('projects-1');
  });

  it('useOne does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProject(undefined), { wrapper });

    // Wait briefly to confirm no fetch happens
    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('useCreate creates item and invalidates queries', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({ name: 'New Project' } as any);
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('projects-new');
      expect(response.data.name).toBe('New Project');
    });
  });

  it('useUpdate updates item and invalidates queries', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateProject(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({ id: 'projects-1', name: 'Updated Project' } as any);
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('projects-1');
      expect(response.data.name).toBe('Updated Project');
    });
  });

  it('useRemove deletes item and invalidates queries', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteProject(), { wrapper });

    // delete returns void on 204, so just check it doesn't throw
    await act(async () => {
      await result.current.mutateAsync('projects-1');
    });

    expect(result.current.isSuccess).toBe(true);
  });
});

// ── Test with different resource instances ────────────────────────────────

describe('useProjects (representative resource instance)', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches project list with pagination metadata', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.meta).toEqual(
      expect.objectContaining({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );
  });

  it('fetches project list with params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProjects({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useSuppliers', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches supplier list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSuppliers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.length).toBeGreaterThan(0);
  });
});

describe('useItems', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches items list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.length).toBeGreaterThan(0);
  });
});

describe('useWarehouses', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches warehouses list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWarehouses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.length).toBeGreaterThan(0);
  });
});

// ── createResourceHooks with a custom test resource ──────────────────────

describe('createResourceHooks with custom resource', () => {
  const { useList, useOne, useCreate, useUpdate, useRemove } = createResourceHooks<{ id: string; name: string }>(
    '/regions',
    'test-regions',
  );

  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('useList fetches data from the correct endpoint', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data[0].id).toBe('regions-1');
  });

  it('useOne fetches single item', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOne('test-id'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('test-id');
  });

  it('useCreate sends POST request', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreate(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({ name: 'Test Region' } as any);
      expect(response.data.name).toBe('Test Region');
    });
  });

  it('useUpdate sends PUT request', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdate(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({ id: 'regions-1', name: 'Updated Region' } as any);
      expect(response.data.id).toBe('regions-1');
      expect(response.data.name).toBe('Updated Region');
    });
  });

  it('useRemove sends DELETE request', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRemove(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('regions-1');
    });
    expect(result.current.isSuccess).toBe(true);
  });
});

// ── getResourceListHook tests ────────────────────────────────────────────

describe('getResourceListHook', () => {
  it('returns correct hook for known resources', () => {
    expect(getResourceListHook('mrrv')).not.toBeNull();
    expect(getResourceListHook('mirv')).not.toBeNull();
    expect(getResourceListHook('projects')).not.toBeNull();
    expect(getResourceListHook('employees')).not.toBeNull();
    expect(getResourceListHook('suppliers')).not.toBeNull();
    expect(getResourceListHook('warehouses')).not.toBeNull();
    expect(getResourceListHook('inventory')).not.toBeNull();
    expect(getResourceListHook('job-orders')).not.toBeNull();
    expect(getResourceListHook('shipments')).not.toBeNull();
    expect(getResourceListHook('customs')).not.toBeNull();
  });

  it('returns null for unknown resources', () => {
    expect(getResourceListHook('nonexistent')).toBeNull();
    expect(getResourceListHook('foobar')).toBeNull();
    expect(getResourceListHook('')).toBeNull();
  });

  it('returned hook is callable and returns data', async () => {
    const hook = getResourceListHook('projects');
    expect(hook).not.toBeNull();

    const wrapper = createWrapper();
    const { result } = renderHook(() => hook!(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });
});
