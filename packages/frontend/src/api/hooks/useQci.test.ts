import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useQciList, useQci, useUpdateQci, useStartQci, useCompleteQci } from './useQci';

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

describe('useQciList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches QCI list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useQciList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('qci-1');
    expect(data.data[0].status).toBe('pending');
    expect(data.data[1].id).toBe('qci-2');
    expect(data.data[1].status).toBe('in_progress');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useQciList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useQci', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches a single QCI by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useQci('qci-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('qci-1');
    expect(data.data.formNumber).toBe('QCI-2026-00001');
    expect(data.data.status).toBe('pending');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useQci(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useUpdateQci', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('updates an existing QCI', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateQci(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        id: 'qci-1',
        remarks: 'Updated remarks',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('qci-1');
      expect(response.data.remarks).toBe('Updated remarks');
    });
  });
});

describe('useStartQci', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions QCI to in_progress status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStartQci(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('qci-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('qci-1');
      expect(response.data.status).toBe('in_progress');
    });
  });
});

describe('useCompleteQci', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('completes a QCI with result and remarks', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteQci(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        id: 'qci-1',
        result: 'pass',
        remarks: 'All items passed inspection',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('qci-1');
      expect(response.data.status).toBe('completed');
      expect(response.data.result).toBe('pass');
    });
  });

  it('invalidates both qci and grn queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCompleteQci(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'qci-1',
        result: 'pass',
      } as any);
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['qci']);
    expect(invalidatedKeys).toContainEqual(['grn']);

    invalidateSpy.mockRestore();
  });
});
