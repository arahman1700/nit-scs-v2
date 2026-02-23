import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useLaborStandards, useUpsertLaborStandard, useLaborPerformance } from './useLabor';

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

const mockStandards = [
  {
    id: 'ls-1',
    taskType: 'picking',
    description: 'Pick items',
    standardMinutes: 15,
    unitOfMeasure: 'order',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ls-2',
    taskType: 'receiving',
    description: 'Receive GRN',
    standardMinutes: 30,
    unitOfMeasure: 'grn',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockPerformance = {
  period: { days: 30, since: '2026-01-24T00:00:00Z' },
  standards: [{ taskType: 'picking', standardMinutes: 15, unit: 'order' }],
  workers: [
    {
      employeeId: 'emp-1',
      employeeName: 'Ahmed',
      totalTasks: 100,
      totalStandardMinutes: 1500,
      efficiency: 92,
      taskBreakdown: [{ taskType: 'picking', count: 100, standardMinutes: 1500 }],
    },
  ],
};

beforeEach(() => {
  server.use(
    http.get(`${API}/labor/standards`, () => HttpResponse.json({ success: true, data: mockStandards })),
    http.put(`${API}/labor/standards/:taskType`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: {
          id: 'ls-upserted',
          taskType: params.taskType,
          ...(body as object),
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-02-01T00:00:00Z',
        },
      });
    }),
    http.get(`${API}/labor/performance`, () => HttpResponse.json({ success: true, data: mockPerformance })),
  );
});

describe('useLaborStandards', () => {
  it('fetches labor standards list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLaborStandards(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].taskType).toBe('picking');
    expect(result.current.data?.data[1].standardMinutes).toBe(30);
  });
});

describe('useUpsertLaborStandard', () => {
  it('upserts a labor standard', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpsertLaborStandard(), { wrapper });

    act(() => {
      result.current.mutate({ taskType: 'packing', standardMinutes: 20, description: 'Pack items' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.taskType).toBe('packing');
    expect(result.current.data?.data.standardMinutes).toBe(20);
  });
});

describe('useLaborPerformance', () => {
  it('fetches labor performance report', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useLaborPerformance(30), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.period.days).toBe(30);
    expect(result.current.data?.data.workers).toHaveLength(1);
    expect(result.current.data?.data.workers[0].efficiency).toBe(92);
  });
});
