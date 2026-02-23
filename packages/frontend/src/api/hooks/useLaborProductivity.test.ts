import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useLaborProductivity } from './useLaborProductivity';

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

const mockProductivity = {
  period: { from: '2026-01-24T00:00:00Z', to: '2026-02-23T00:00:00Z' },
  totals: { grnsProcessed: 120, misIssued: 85, wtsTransferred: 40, tasksCompleted: 310 },
  workers: [
    {
      employeeId: 'emp-1',
      fullName: 'Ahmed Worker',
      role: 'warehouse_clerk',
      metrics: { grnsProcessed: 30, misIssued: 20, wtsTransferred: 10, tasksCompleted: 80, avgTaskDurationMinutes: 12 },
    },
  ],
  dailyThroughput: [{ date: '2026-02-22', grns: 5, mis: 3, wts: 2, tasks: 15 }],
};

beforeEach(() => {
  server.use(
    http.get(`${API}/dashboard/labor-productivity`, () => HttpResponse.json({ success: true, data: mockProductivity })),
  );
});

describe('useLaborProductivity', () => {
  it('fetches labor productivity summary', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLaborProductivity(30), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.totals.grnsProcessed).toBe(120);
    expect(result.current.data?.data.workers).toHaveLength(1);
    expect(result.current.data?.data.dailyThroughput).toHaveLength(1);
  });
});
