import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useGeneratorMaintenanceList,
  useGeneratorMaintenance,
  useCreateGeneratorMaintenance,
  useUpdateGeneratorMaintenance,
  useStartGeneratorMaintenance,
  useCompleteGeneratorMaintenance,
  useMarkOverdueGeneratorMaintenance,
} from './useGeneratorMaintenance';

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

describe('useGeneratorMaintenanceList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches generator maintenance list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeneratorMaintenanceList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('gm-1');
    expect(data.data[0].type).toBe('preventive');
    expect(data.data[0].status).toBe('scheduled');
    expect(data.data[1].id).toBe('gm-2');
    expect(data.data[1].status).toBe('in_progress');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeneratorMaintenanceList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

describe('useGeneratorMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('fetches a single generator maintenance record by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeneratorMaintenance('gm-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('gm-1');
    expect(data.data.generatorId).toBe('gen-1');
    expect(data.data.type).toBe('preventive');
    expect(data.data.status).toBe('scheduled');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGeneratorMaintenance(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreateGeneratorMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('creates a new generator maintenance record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateGeneratorMaintenance(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        generatorId: 'gen-1',
        type: 'preventive',
        scheduledDate: '2026-03-01',
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('gm-new');
      expect(response.data.status).toBe('scheduled');
      expect(response.data.generatorId).toBe('gen-1');
    });
  });
});

describe('useUpdateGeneratorMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('updates an existing generator maintenance record', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateGeneratorMaintenance(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        id: 'gm-1',
        notes: 'Updated maintenance notes',
      });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('gm-1');
      expect(response.data.notes).toBe('Updated maintenance notes');
    });
  });
});

describe('useStartGeneratorMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions maintenance to in_progress status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useStartGeneratorMaintenance(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('gm-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('gm-1');
      expect(response.data.status).toBe('in_progress');
    });
  });
});

describe('useCompleteGeneratorMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions maintenance to completed status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteGeneratorMaintenance(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('gm-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('gm-1');
      expect(response.data.status).toBe('completed');
    });
  });
});

describe('useMarkOverdueGeneratorMaintenance', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('transitions maintenance to overdue status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMarkOverdueGeneratorMaintenance(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync('gm-1');

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data.id).toBe('gm-1');
      expect(response.data.status).toBe('overdue');
    });
  });

  it('invalidates generator-maintenance queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useMarkOverdueGeneratorMaintenance(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('gm-1');
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['generator-maintenance']);

    invalidateSpy.mockRestore();
  });
});
