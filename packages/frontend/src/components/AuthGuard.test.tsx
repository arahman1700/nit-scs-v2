import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test-utils/msw-server';
import { render } from '@/test-utils/render';

// Mock localStorage
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

// Mock dependencies that pull in heavy modules
vi.mock('@/socket/client', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

vi.mock('@/routes', () => ({
  AppRouteDefinitions: () => <div data-testid="app-routes">Routes loaded</div>,
}));

vi.mock('@/layouts/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock('@/pages/LoginPage', () => ({
  LoginPage: ({ onLogin }: { onLogin: (role: string) => void }) => (
    <div data-testid="login-page">
      <button onClick={() => onLogin('admin')}>Login</button>
    </div>
  ),
}));

import React from 'react';
import { AuthGuard } from './AuthGuard';

describe('AuthGuard', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  it('shows login page when no token is present', async () => {
    render(<AuthGuard />);

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('shows main layout when token is valid and /auth/me succeeds', async () => {
    mockStorage.setItem('nit_scs_token', 'valid-token');

    render(<AuthGuard />);

    await waitFor(() => {
      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    });
  });

  it('falls back to login when /auth/me returns 401', async () => {
    mockStorage.setItem('nit_scs_token', 'expired-token');

    server.use(
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json({ success: false, message: 'Token expired' }, { status: 401 });
      }),
      http.post('/api/v1/auth/refresh', () => {
        return HttpResponse.json({ success: false, message: 'Invalid refresh token' }, { status: 401 });
      }),
    );

    render(<AuthGuard />);

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });
});
