import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useSecurityDashboard, useLoginHistory } from './useSecurity';

const API = '/api/v1';

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

// ############################################################################
// SECURITY DASHBOARD
// ############################################################################

describe('useSecurityDashboard', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/security/dashboard`, () =>
        HttpResponse.json({
          success: true,
          data: {
            activeUsers24h: 42,
            failedAttempts24h: 3,
            lockedAccounts: 1,
            suspiciousIps: ['192.168.1.100'],
          },
        }),
      ),
    );
  });

  it('fetches security dashboard data', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSecurityDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.activeUsers24h).toBe(42);
    expect(data.data.failedAttempts24h).toBe(3);
    expect(data.data.lockedAccounts).toBe(1);
    expect(data.data.suspiciousIps).toContain('192.168.1.100');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSecurityDashboard(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.isLoading).toBe(true);
  });
});

// ############################################################################
// LOGIN HISTORY
// ############################################################################

describe('useLoginHistory', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/security/login-history/:employeeId`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'lh-1',
              ipAddress: '10.0.0.1',
              userAgent: 'Mozilla/5.0',
              success: true,
              failureReason: null,
              createdAt: '2026-03-01T10:00:00Z',
            },
            {
              id: 'lh-2',
              ipAddress: '10.0.0.2',
              userAgent: null,
              success: false,
              failureReason: 'Invalid password',
              createdAt: '2026-03-01T11:00:00Z',
            },
          ],
        }),
      ),
    );
  });

  it('fetches login history for an employee', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLoginHistory('emp-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].ipAddress).toBe('10.0.0.1');
    expect(data.data[1].success).toBe(false);
    expect(data.data[1].failureReason).toBe('Invalid password');
  });

  it('does not fetch when employeeId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLoginHistory(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('accepts optional pagination params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLoginHistory('emp-1', { page: 1, pageSize: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});
