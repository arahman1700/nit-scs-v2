import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useUserViews, useSaveView, useUpdateView, useDeleteView } from './useUserViews';

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

const mockViews = [
  {
    id: 'view-1',
    name: 'Default View',
    viewType: 'table',
    config: { sortKey: 'createdAt', sortDir: 'desc' },
    isDefault: true,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'view-2',
    name: 'Compact View',
    viewType: 'grid',
    config: { viewMode: 'compact' },
    isDefault: false,
    createdAt: '2026-02-02T00:00:00Z',
    updatedAt: '2026-02-02T00:00:00Z',
  },
];

beforeEach(() => {
  server.use(
    http.get(`${API}/views/:entityType`, () => HttpResponse.json({ success: true, data: mockViews })),
    http.post(`${API}/views`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: {
          id: 'view-new',
          ...(body as object),
          createdAt: '2026-02-03T00:00:00Z',
          updatedAt: '2026-02-03T00:00:00Z',
        },
      });
    }),
    http.patch(`${API}/views/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/views/:id`, () => new HttpResponse(null, { status: 204 })),
  );
});

describe('useUserViews', () => {
  it('fetches user views for an entity type', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUserViews('grn'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].name).toBe('Default View');
    expect(result.current.data?.data[1].viewType).toBe('grid');
  });
});

describe('useSaveView', () => {
  it('creates a new saved view', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSaveView(), { wrapper });

    act(() => {
      result.current.mutate({
        entityType: 'grn',
        name: 'My Custom View',
        config: { sortKey: 'status', sortDir: 'asc' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('view-new');
    expect(result.current.data?.data.name).toBe('My Custom View');
  });
});

describe('useUpdateView', () => {
  it('updates an existing view via PATCH', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateView(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'view-1', entityType: 'grn', name: 'Updated View' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('view-1');
    expect(result.current.data?.data.name).toBe('Updated View');
  });
});

describe('useDeleteView', () => {
  it('deletes a view', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteView(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'view-1', entityType: 'grn' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
