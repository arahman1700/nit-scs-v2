import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useMiList,
  useMi,
  useCreateMi,
  useUpdateMi,
  useSubmitMi,
  useApproveMi,
  useIssueMi,
  useCancelMi,
} from './useMi';

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

describe('useMiList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches MI list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMiList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('mi-1');
    expect(data.data[0].formNumber).toBe('MI-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMiList({ page: 1, limit: 5 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useMi', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches a single MI by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMi('mi-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mi-1');
    expect(data.data.formNumber).toBe('MI-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMi(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateMi', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('creates a new MI and returns draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateMi(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        projectId: 'proj-1',
        warehouseId: 'wh-1',
        requestedById: 'emp-1',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mi-new');
      expect(response.data.status).toBe('draft');
      expect(response.data.projectId).toBe('proj-1');
    });
  });
});

describe('useUpdateMi', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('updates an existing MI', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateMi(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        id: 'mi-1',
        notes: 'Updated MI notes',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mi-1');
      expect(response.data.notes).toBe('Updated MI notes');
    });
  });
});

describe('useSubmitMi', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MI to submitted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitMi(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('mi-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mi-1');
      expect(response.data.status).toBe('submitted');
    });
  });
});

describe('useApproveMi', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MI to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveMi(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('mi-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mi-1');
      expect(response.data.status).toBe('approved');
    });
  });

  it('invalidates both mi and inventory queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useApproveMi(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('mi-1');
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mi']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});

describe('useIssueMi', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MI to issued status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useIssueMi(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('mi-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mi-1');
      expect(response.data.status).toBe('issued');
    });
  });

  it('invalidates mi, inventory, and gate-passes queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useIssueMi(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('mi-1');
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mi']);
    expect(invalidatedKeys).toContainEqual(['inventory']);
    expect(invalidatedKeys).toContainEqual(['gate-passes']);

    invalidateSpy.mockRestore();
  });
});

describe('useCancelMi', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MI to cancelled status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelMi(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('mi-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mi-1');
      expect(response.data.status).toBe('cancelled');
    });
  });

  it('invalidates both mi and inventory queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCancelMi(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('mi-1');
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mi']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});
