import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDelegationList,
  useDelegation,
  useCreateDelegation,
  useUpdateDelegation,
  useToggleDelegation,
  useDeleteDelegation,
} from './useDelegations';

// Mock localStorage for axios request interceptor (client.ts reads token)
const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(),
    get length() {
      return Object.keys(storage).length;
    },
    key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
  },
  writable: true,
});

const API = '/api/v1';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const mockDelegation = {
  id: 'del-1',
  delegatorId: 'emp-1',
  delegateId: 'emp-2',
  startDate: '2026-02-01',
  endDate: '2026-03-01',
  scope: 'all',
  isActive: true,
  notes: null,
  createdAt: '2026-02-01T00:00:00Z',
  delegator: { id: 'emp-1', fullName: 'John', email: 'john@test.com', department: 'Warehouse' },
  delegate: { id: 'emp-2', fullName: 'Jane', email: 'jane@test.com', department: 'Procurement' },
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/delegations`, () =>
      HttpResponse.json({
        success: true,
        data: [mockDelegation],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    http.get(`${API}/delegations/:id`, () => HttpResponse.json({ success: true, data: mockDelegation })),
    http.post(`${API}/delegations/:id/toggle`, ({ params }) =>
      HttpResponse.json({
        success: true,
        data: { ...mockDelegation, id: params.id, isActive: !mockDelegation.isActive },
      }),
    ),
    http.post(`${API}/delegations`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { ...mockDelegation, id: 'del-new', ...(body as object) },
      });
    }),
    http.put(`${API}/delegations/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { ...mockDelegation, id: params.id, ...(body as object) },
      });
    }),
    http.delete(`${API}/delegations/:id`, () => new HttpResponse(null, { status: 204 })),
  );
});

// ── Hook Tests ──────────────────────────────────────────────────────────────

describe('useDelegationList', () => {
  it('fetches delegation list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDelegationList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].delegator.fullName).toBe('John');
    expect(result.current.data?.data[0].delegate.fullName).toBe('Jane');
    expect(result.current.data?.data[0].isActive).toBe(true);
  });
});

describe('useDelegation', () => {
  it('fetches a single delegation by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDelegation('del-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('del-1');
    expect(result.current.data?.data.scope).toBe('all');
    expect(result.current.data?.data.startDate).toBe('2026-02-01');
  });
});

describe('useCreateDelegation', () => {
  it('creates a new delegation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateDelegation(), { wrapper });

    act(() => {
      result.current.mutate({
        delegateId: 'emp-3',
        startDate: '2026-03-01',
        endDate: '2026-04-01',
        scope: 'approvals',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.delegateId).toBe('emp-3');
    expect(result.current.data?.data.scope).toBe('approvals');
  });
});

describe('useUpdateDelegation', () => {
  it('updates an existing delegation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateDelegation(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'del-1', endDate: '2026-06-01', notes: 'Extended' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.endDate).toBe('2026-06-01');
    expect(result.current.data?.data.notes).toBe('Extended');
  });
});

describe('useToggleDelegation', () => {
  it('toggles delegation active state', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useToggleDelegation(), { wrapper });

    act(() => {
      result.current.mutate('del-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.isActive).toBe(false);
  });
});

describe('useDeleteDelegation', () => {
  it('deletes a delegation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteDelegation(), { wrapper });

    act(() => {
      result.current.mutate('del-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
