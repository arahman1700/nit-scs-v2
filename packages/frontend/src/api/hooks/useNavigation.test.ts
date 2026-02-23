import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useNavigation } from './useNavigation';

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

const mockNavItems = [
  { id: 'nav-1', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', order: 1 },
  { id: 'nav-2', label: 'Inventory', path: '/inventory', icon: 'Package', order: 2, children: [] },
];

beforeEach(() => {
  server.use(http.get(`${API}/navigation`, () => HttpResponse.json({ data: mockNavItems })));
});

describe('useNavigation', () => {
  it('fetches navigation items and unwraps correctly', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNavigation(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].label).toBe('Dashboard');
    expect(result.current.data![1].label).toBe('Inventory');
  });
});
