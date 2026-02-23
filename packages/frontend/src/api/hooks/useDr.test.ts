import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDrList, useDr, useCreateDr, useUpdateDr, useSendClaimDr, useResolveDr } from './useDr';

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

describe('useDrList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches DR list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDrList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('dr-1');
    expect(data.data[0].formNumber).toBe('DR-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('dr-2');
    expect(data.data[1].status).toBe('claim_sent');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDrList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useDr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches a single DR by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDr('dr-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('dr-1');
    expect(data.data.formNumber).toBe('DR-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDr(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateDr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('creates a new DR and returns draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateDr(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        grnId: 'grn-1',
        type: 'damage',
        description: 'Damaged packaging',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('dr-new');
      expect(response.data.status).toBe('draft');
      expect(response.data.grnId).toBe('grn-1');
    });
  });
});

describe('useUpdateDr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('updates an existing DR', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateDr(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        id: 'dr-1',
        description: 'Updated damage description',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('dr-1');
      expect(response.data.description).toBe('Updated damage description');
    });
  });
});

describe('useSendClaimDr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions DR to claim_sent status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSendClaimDr(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('dr-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('dr-1');
      expect(response.data.status).toBe('claim_sent');
    });
  });
});

describe('useResolveDr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('resolves a DR with resolution details', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useResolveDr(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        id: 'dr-1',
        resolution: 'replacement',
        resolutionNotes: 'Supplier agreed to replace',
      } as any);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('dr-1');
      expect(response.data.status).toBe('resolved');
      expect(response.data.resolution).toBe('replacement');
    });
  });

  it('invalidates dr queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useResolveDr(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'dr-1',
        resolution: 'replacement',
      } as any);
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['dr']);

    invalidateSpy.mockRestore();
  });
});
