import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  usePermissions,
  useRolePermissions,
  useUpdateRolePermissions,
  useUpdatePermission,
  useResetPermissions,
} from './usePermissions';

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

const mockMatrix = {
  admin: { grn: ['create', 'read', 'update', 'delete'], mi: ['create', 'read'] },
  manager: { grn: ['read', 'approve'], mi: ['read'] },
};

const mockRolePerms = { grn: ['read', 'approve'], mi: ['read'] };

beforeEach(() => {
  server.use(
    http.get(`${API}/permissions`, () => HttpResponse.json({ success: true, data: mockMatrix })),
    http.get(`${API}/permissions/:role`, () => HttpResponse.json({ success: true, data: mockRolePerms })),
    http.put(`${API}/permissions/:role`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: body as object });
    }),
    http.put(`${API}/permissions/:role/:resource`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: body as object });
    }),
    http.post(`${API}/permissions/reset`, () => HttpResponse.json({ success: true, data: mockMatrix })),
  );
});

describe('usePermissions', () => {
  it('fetches full permission matrix', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePermissions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveProperty('admin');
    expect(result.current.data?.data.admin.grn).toContain('create');
  });
});

describe('useRolePermissions', () => {
  it('fetches permissions for a specific role', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRolePermissions('manager'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.grn).toContain('approve');
  });
});

describe('useUpdateRolePermissions', () => {
  it('bulk updates permissions for a role', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateRolePermissions(), { wrapper });

    act(() => {
      result.current.mutate({ role: 'manager', permissions: { grn: ['read', 'approve', 'create'] } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdatePermission', () => {
  it('updates a single permission entry', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdatePermission(), { wrapper });

    act(() => {
      result.current.mutate({ role: 'manager', resource: 'grn', actions: ['read', 'approve', 'update'] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useResetPermissions', () => {
  it('resets permissions to defaults', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useResetPermissions(), { wrapper });

    act(() => {
      result.current.mutate('manager');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveProperty('admin');
  });
});
