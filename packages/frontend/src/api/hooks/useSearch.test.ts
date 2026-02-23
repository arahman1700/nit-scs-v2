import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useGlobalSearch } from './useSearch';

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

const mockResults = [
  {
    type: 'grn',
    id: 'grn-1',
    number: 'GRN-2026-00001',
    status: 'draft',
    summary: 'GRN from supplier A',
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    type: 'mi',
    id: 'mi-1',
    number: 'MI-2026-00001',
    status: 'submitted',
    summary: 'Material issue for project',
    createdAt: '2026-02-02T10:00:00Z',
  },
];

beforeEach(() => {
  server.use(http.get(`${API}/search`, () => HttpResponse.json({ data: mockResults })));
});

describe('useGlobalSearch', () => {
  it('searches and returns results when query length >= 2', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGlobalSearch('test'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].type).toBe('grn');
    expect(result.current.data![1].number).toBe('MI-2026-00001');
  });
});
