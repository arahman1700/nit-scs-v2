import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useMrList,
  useMr,
  useCreateMr,
  useUpdateMr,
  useSubmitMr,
  useReviewMr,
  useApproveMr,
  useCheckStockMr,
  useConvertMiMr,
  useConvertMrToImsf,
  useFulfillMr,
  useRejectMr,
  useCancelMr,
} from './useMr';

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

describe('useMrList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches MR list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('mr-1');
    expect(data.data[0].formNumber).toBe('MR-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('mr-2');
    expect(data.data[1].status).toBe('submitted');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMrList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches a single MR by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMr('mr-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.formNumber).toBe('MR-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMr(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('creates a new MR and returns draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateMr(), { wrapper });

    act(() => {
      result.current.mutate({
        projectId: 'proj-1',
        warehouseId: 'wh-1',
        requestedById: 'emp-1',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.projectId).toBe('proj-1');
  });
});

describe('useUpdateMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('updates an existing MR', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateMr(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'mr-1',
        notes: 'Updated MR notes',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.notes).toBe('Updated MR notes');
  });
});

describe('useSubmitMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to submitted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitMr(), { wrapper });

    act(() => {
      result.current.mutate('mr-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('submitted');
  });
});

describe('useReviewMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to reviewed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReviewMr(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mr-1', notes: 'Reviewed' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('reviewed');
  });
});

describe('useApproveMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveMr(), { wrapper });

    act(() => {
      result.current.mutate('mr-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('approved');
  });
});

describe('useCheckStockMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to stock_checked status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCheckStockMr(), { wrapper });

    act(() => {
      result.current.mutate('mr-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('stock_checked');
  });
});

describe('useConvertMiMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to converted_mi status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useConvertMiMr(), { wrapper });

    act(() => {
      result.current.mutate('mr-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('converted_mi');
  });

  it('invalidates both mr and mi queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useConvertMiMr(), { wrapper });

    act(() => {
      result.current.mutate('mr-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mr']);
    expect(invalidatedKeys).toContainEqual(['mi']);

    invalidateSpy.mockRestore();
  });
});

describe('useConvertMrToImsf', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to converted_imsf status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useConvertMrToImsf(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mr-1', receiverProjectId: 'proj-2' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('converted_imsf');
  });

  it('invalidates both mr and imsf queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useConvertMrToImsf(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mr-1', receiverProjectId: 'proj-2' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['mr']);
    expect(invalidatedKeys).toContainEqual(['imsf']);

    invalidateSpy.mockRestore();
  });
});

describe('useFulfillMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to fulfilled status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFulfillMr(), { wrapper });

    act(() => {
      result.current.mutate('mr-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('fulfilled');
  });
});

describe('useRejectMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to rejected status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRejectMr(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mr-1', reason: 'Insufficient budget' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('rejected');
  });
});

describe('useCancelMr', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions MR to cancelled status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelMr(), { wrapper });

    act(() => {
      result.current.mutate('mr-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mr-1');
    expect(data.data.status).toBe('cancelled');
  });
});
