import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useJobOrderList,
  useJobOrder,
  useCreateJobOrder,
  useUpdateJobOrder,
  useSubmitJobOrder,
  useApproveJobOrder,
  useRejectJobOrder,
  useAssignJobOrder,
  useStartJobOrder,
  useHoldJobOrder,
  useResumeJobOrder,
  useCompleteJobOrder,
  useInvoiceJobOrder,
  useCancelJobOrder,
} from './useJobOrders';

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

describe('useJobOrderList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches job order list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJobOrderList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('jo-1');
    expect(data.data[0].formNumber).toBe('JO-2026-00001');
    expect(data.data[0].status).toBe('draft');
    expect(data.data[1].id).toBe('jo-2');
    expect(data.data[1].status).toBe('submitted');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJobOrderList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches a single job order by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJobOrder('jo-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.formNumber).toBe('JO-2026-00001');
    expect(data.data.status).toBe('draft');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useJobOrder(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('creates a new job order and returns draft status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateJobOrder(), { wrapper });

    act(() => {
      result.current.mutate({
        projectId: 'proj-1',
        description: 'Transport materials to site',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-new');
    expect(data.data.status).toBe('draft');
    expect(data.data.projectId).toBe('proj-1');
  });
});

describe('useUpdateJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('updates an existing job order', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateJobOrder(), { wrapper });

    act(() => {
      result.current.mutate({
        id: 'jo-1',
        description: 'Updated job description',
      } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.description).toBe('Updated job description');
  });
});

describe('useSubmitJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to submitted status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitJobOrder(), { wrapper });

    act(() => {
      result.current.mutate('jo-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('submitted');
  });
});

describe('useApproveJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to approved status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApproveJobOrder(), { wrapper });

    act(() => {
      result.current.mutate('jo-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('approved');
  });
});

describe('useRejectJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to rejected status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRejectJobOrder(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'jo-1', reason: 'Budget exceeded' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('rejected');
  });
});

describe('useAssignJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to assigned status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAssignJobOrder(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'jo-1', assigneeId: 'emp-5', vehicle: 'TRK-001', driver: 'Driver A' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('assigned');
  });
});

describe('useStartJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to in_progress status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStartJobOrder(), { wrapper });

    act(() => {
      result.current.mutate('jo-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('in_progress');
  });
});

describe('useHoldJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to on_hold status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useHoldJobOrder(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'jo-1', reason: 'Waiting for parts' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('on_hold');
  });
});

describe('useResumeJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order back to in_progress status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useResumeJobOrder(), { wrapper });

    act(() => {
      result.current.mutate('jo-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('in_progress');
  });
});

describe('useCompleteJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to completed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteJobOrder(), { wrapper });

    act(() => {
      result.current.mutate('jo-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('completed');
  });
});

describe('useInvoiceJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to invoiced status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInvoiceJobOrder(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'jo-1', invoiceAmount: 15000, invoiceRef: 'INV-2026-001' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('invoiced');
  });
});

describe('useCancelJobOrder', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions job order to cancelled status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelJobOrder(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'jo-1', reason: 'Project scope change' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('jo-1');
    expect(data.data.status).toBe('cancelled');
  });
});
