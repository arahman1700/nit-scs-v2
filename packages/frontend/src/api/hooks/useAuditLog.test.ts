import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useAuditLogs, useAuditLogEntry } from './useAuditLog';

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

const mockLogs = [
  {
    id: 'audit-1',
    tableName: 'mrrv',
    action: 'CREATE',
    recordId: 'grn-1',
    performedById: 'user-1',
    performedAt: '2026-02-20T10:00:00Z',
    changes: {},
  },
  {
    id: 'audit-2',
    tableName: 'mirv',
    action: 'UPDATE',
    recordId: 'mi-1',
    performedById: 'user-2',
    performedAt: '2026-02-20T11:00:00Z',
    changes: { status: { old: 'draft', new: 'submitted' } },
  },
];

beforeEach(() => {
  server.use(
    http.get(`${API}/audit`, () => HttpResponse.json({ success: true, data: mockLogs })),
    http.get(`${API}/audit/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockLogs[0], id: params.id } }),
    ),
  );
});

describe('useAuditLogs', () => {
  it('fetches audit log list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuditLogs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].action).toBe('CREATE');
    expect(result.current.data?.data[1].tableName).toBe('mirv');
  });
});

describe('useAuditLogEntry', () => {
  it('fetches a single audit log entry by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuditLogEntry('audit-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('audit-1');
    expect(result.current.data?.data.action).toBe('CREATE');
  });
});
