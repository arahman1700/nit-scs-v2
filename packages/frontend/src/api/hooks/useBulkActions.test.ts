import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useBulkActions, useExecuteBulkAction } from './useBulkActions';

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

beforeEach(() => {
  server.use(
    http.get(`${API}/bulk/actions/:documentType`, ({ params }) =>
      HttpResponse.json({
        success: true,
        data: { documentType: params.documentType, actions: ['submit', 'approve'] },
      }),
    ),
    http.post(`${API}/bulk/execute`, async ({ request }) => {
      const body = (await request.json()) as { documentType: string; ids: string[]; action: string };
      return HttpResponse.json({
        success: true,
        data: {
          documentType: body.documentType,
          action: body.action,
          total: body.ids.length,
          succeeded: body.ids.length,
          failed: 0,
          results: [],
        },
      });
    }),
  );
});

describe('useBulkActions', () => {
  it('fetches available bulk actions for a document type', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBulkActions('grn'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.documentType).toBe('grn');
    expect(result.current.data?.data.actions).toContain('submit');
    expect(result.current.data?.data.actions).toContain('approve');
  });
});

describe('useExecuteBulkAction', () => {
  it('executes a bulk action and returns results', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExecuteBulkAction(), { wrapper });

    act(() => {
      result.current.mutate({ documentType: 'grn', ids: ['grn-1', 'grn-2'], action: 'submit' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.total).toBe(2);
    expect(result.current.data?.data.succeeded).toBe(2);
    expect(result.current.data?.data.failed).toBe(0);
  });
});
