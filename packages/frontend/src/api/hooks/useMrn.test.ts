import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMrnList, useMrn, useCreateMrn, useUpdateMrn, useSubmitMrn, useReceiveMrn, useCompleteMrn } from './useMrn';

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

describe('useMrnList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches MRN list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrnList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('mrn-1');
    expect(data.data[0].formNumber).toBe('MRN-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('mrn-2');
    expect(data.data[1].status).toBe('submitted');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrnList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useMrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches a single MRN by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrn('mrn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mrn-1');
    expect(data.data.formNumber).toBe('MRN-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrn(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateMrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('creates a new MRN and returns draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateMrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        warehouseId: 'wh-1',
        reason: 'Damaged items return',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mrn-new');
      expect(response.data.status).toBe('draft');
      expect(response.data.warehouseId).toBe('wh-1');
    });
  });
});

describe('useUpdateMrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('updates an existing MRN', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateMrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        id: 'mrn-1',
        reason: 'Updated return reason',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mrn-1');
      expect(response.data.reason).toBe('Updated return reason');
    });
  });
});

describe('useSubmitMrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MRN to submitted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitMrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('mrn-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mrn-1');
      expect(response.data.status).toBe('submitted');
    });
  });
});

describe('useReceiveMrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MRN to received status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReceiveMrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('mrn-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mrn-1');
      expect(response.data.status).toBe('received');
    });
  });
});

describe('useCompleteMrn', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MRN to completed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteMrn(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('mrn-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('mrn-1');
      expect(response.data.status).toBe('completed');
    });
  });

  it('invalidates both mrn and inventory queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCompleteMrn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('mrn-1');
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mrn']);
    expect(invalidatedKeys).toContainEqual(['inventory']);

    invalidateSpy.mockRestore();
  });
});
