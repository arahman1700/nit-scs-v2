import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useSettings, useUpdateSettings } from './useSettings';

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

const mockSettings = {
  vatRate: 15,
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  dateFormat: 'YYYY-MM-DD',
  overDeliveryTolerance: 10,
  backdateLimit: 7,
};

beforeEach(() => {
  server.use(
    http.get(`${API}/settings`, () => HttpResponse.json({ success: true, data: mockSettings })),
    http.put(`${API}/settings`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: body as object });
    }),
  );
});

describe('useSettings', () => {
  it('fetches settings and unwraps data.data', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // useSettings returns data.data (unwrapped one level)
    expect(result.current.data?.vatRate).toBe(15);
    expect(result.current.data?.currency).toBe('SAR');
    expect(result.current.data?.timezone).toBe('Asia/Riyadh');
  });
});

describe('useUpdateSettings', () => {
  it('updates settings and returns updated values', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => {
      result.current.mutate({ ...mockSettings, vatRate: 18 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.vatRate).toBe(18);
  });
});
