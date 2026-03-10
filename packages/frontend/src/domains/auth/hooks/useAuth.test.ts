import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import React from 'react';
import { useLogin, useCurrentUser, useLogout } from './useAuth';

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

describe('useLogin', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('stores tokens on successful login', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ email: 'admin@nit.sa', password: 'password' });
    });

    expect(mockStorage.setItem).toHaveBeenCalledWith('nit_scs_token', 'mock-access-token');
    // Refresh token is now set as httpOnly cookie by server, not in localStorage
    expect(mockStorage.setItem).not.toHaveBeenCalledWith('nit_scs_refresh_token', expect.anything());
  });

  it('rejects with 401 on wrong password', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(act(() => result.current.mutateAsync({ email: 'admin@nit.sa', password: 'wrong' }))).rejects.toThrow();
  });
});

describe('useCurrentUser', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('does not fetch when no token is present', async () => {
    // useCurrentUser has `enabled: !!localStorage.getItem(...)` which returns
    // false here, meaning the query stays disabled and doesn't fire
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    // Wait a bit to ensure no network call happens
    await new Promise(r => setTimeout(r, 50));

    // The query should exist but not have fetched
    if (result.current) {
      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();
    }
    // If result.current is null, that's OK — the hook's enabled:false
    // prevents any fetch, which is the behavior we're testing
  });

  it('fetches user when token is present', async () => {
    mockStorage.setItem('nit_scs_token', 'valid-token');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.email).toBe('admin@nit.sa');
  });
});

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.setItem('nit_scs_token', 'token');
  });

  it('clears access token on logout (refresh token cookie cleared by server)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockStorage.removeItem).toHaveBeenCalledWith('nit_scs_token');
    expect(mockStorage.removeItem).not.toHaveBeenCalledWith('nit_scs_refresh_token');
  });
});

// ── Error Path Tests ──────────────────────────────────────────────────────

describe('useLogin – error paths', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('handles 401 on wrong credentials and does not store tokens', async () => {
    // Override both login (returns 401) and refresh (also fails) so the
    // apiClient's 401-interceptor doesn't accidentally recover.
    server.use(
      http.post('/api/v1/auth/login', () =>
        HttpResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 }),
      ),
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({ success: false, message: 'No session' }, { status: 401 }),
      ),
    );

    const wrapper = createWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(
      act(() => result.current.mutateAsync({ email: 'admin@nit.sa', password: 'wrong-password' })),
    ).rejects.toThrow();

    // React state may need a tick to flush after the rejection
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockStorage.setItem).not.toHaveBeenCalledWith('nit_scs_token', expect.anything());
  });

  it('handles token refresh failure with 401', async () => {
    // Both /auth/me and /auth/refresh return 401 so the interceptor
    // cannot recover and the query settles into an error state.
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }),
      ),
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({ success: false, message: 'Token expired' }, { status: 401 }),
      ),
    );

    mockStorage.setItem('nit_scs_token', 'expired-token');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
