import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useGrnList,
  useGrn,
  useCreateGrn,
  useUpdateGrn,
  useSubmitGrn,
  useApproveQcGrn,
  useReceiveGrn,
  useStoreGrn,
} from './useGrn';

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

describe('useGrnList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches GRN list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGrnList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('grn-1');
    expect(data.data[0].formNumber).toBe('GRN-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('grn-2');
    expect(data.data[1].status).toBe('submitted');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGrnList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useGrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches a single GRN by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGrn('grn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('grn-1');
    expect(data.data.formNumber).toBe('GRN-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGrn(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateGrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('creates a new GRN and returns draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateGrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        supplierId: 'sup-1',
        warehouseId: 'wh-1',
        projectId: 'proj-1',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('grn-new');
      expect(response.data.status).toBe('draft');
      expect(response.data.supplierId).toBe('sup-1');
    });
  });
});

describe('useUpdateGrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('updates an existing GRN', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateGrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        id: 'grn-1',
        notes: 'Updated notes',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('grn-1');
      expect(response.data.notes).toBe('Updated notes');
    });
  });
});

describe('useSubmitGrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions GRN to submitted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitGrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('grn-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('grn-1');
      expect(response.data.status).toBe('submitted');
    });
  });
});

describe('useApproveQcGrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions GRN to qc_approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveQcGrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('grn-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('grn-1');
      expect(response.data.status).toBe('qc_approved');
    });
  });
});

describe('useReceiveGrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions GRN to received status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReceiveGrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('grn-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('grn-1');
      expect(response.data.status).toBe('received');
    });
  });
});

describe('useStoreGrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions GRN to stored status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStoreGrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('grn-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('grn-1');
      expect(response.data.status).toBe('stored');
    });
  });

  it('invalidates both grn and inventory queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useStoreGrn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('grn-1');
    });

    // Verify both grn and inventory query keys were invalidated
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['grn']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});
