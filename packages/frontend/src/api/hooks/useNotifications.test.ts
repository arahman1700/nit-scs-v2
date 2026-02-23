import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  useMarkRead,
  useDeleteNotification,
} from './useNotifications';

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

const mockNotifications = [
  {
    id: 'notif-1',
    type: 'approval_request',
    title: 'GRN Approval Required',
    message: 'GRN-2026-00010 needs your approval',
    documentId: 'mrrv-10',
    documentType: 'mrrv',
    severity: 'warning',
    read: false,
    createdAt: '2026-02-20T10:00:00Z',
    actionUrl: '/grn/mrrv-10',
  },
  {
    id: 'notif-2',
    type: 'status_change',
    title: 'MI Approved',
    message: 'MI-2026-00005 has been approved',
    documentId: 'mirv-5',
    documentType: 'mirv',
    severity: 'success',
    read: true,
    createdAt: '2026-02-19T15:00:00Z',
  },
];

const mockUpdatedNotification = {
  ...mockNotifications[0],
  read: true,
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/notifications`, () =>
      HttpResponse.json({
        success: true,
        data: mockNotifications,
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      }),
    ),
    http.get(`${API}/notifications/unread-count`, () => HttpResponse.json({ success: true, data: 1 })),
    http.put(`${API}/notifications/read-all`, () => HttpResponse.json({ success: true, data: null })),
    http.put(`${API}/notifications/:id/read`, () =>
      HttpResponse.json({ success: true, data: mockUpdatedNotification }),
    ),
    http.delete(`${API}/notifications/:id`, () => HttpResponse.json({ success: true, data: null })),
  );
});

// ── Hook Tests ──────────────────────────────────────────────────────────────

describe('useNotifications', () => {
  it('fetches notification list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].title).toBe('GRN Approval Required');
    expect(result.current.data?.data[0].read).toBe(false);
    expect(result.current.data?.data[1].type).toBe('status_change');
    expect(result.current.data?.data[1].severity).toBe('success');
  });
});

describe('useUnreadCount', () => {
  it('fetches unread count', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUnreadCount(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toBe(1);
  });
});

describe('useMarkAllRead', () => {
  it('marks all notifications as read and invalidates queries', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMarkAllRead(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ success: true, data: null });
  });
});

describe('useMarkRead', () => {
  it('marks a single notification as read and invalidates queries', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useMarkRead(), { wrapper });

    act(() => {
      result.current.mutate('notif-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.read).toBe(true);
  });
});

describe('useDeleteNotification', () => {
  it('deletes a notification and invalidates queries', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteNotification(), { wrapper });

    act(() => {
      result.current.mutate('notif-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
