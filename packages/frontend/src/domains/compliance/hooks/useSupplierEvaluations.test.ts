import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useSupplierEvaluationList,
  useSupplierEvaluation,
  useCreateSupplierEvaluation,
  useUpdateSupplierEvaluation,
  useCompleteSupplierEvaluation,
} from './useSupplierEvaluations';

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
// LIST
// ############################################################################

describe('useSupplierEvaluationList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/supplier-evaluations`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'eval-1', evaluationNumber: 'EVAL-001', status: 'draft', overallScore: null },
            { id: 'eval-2', evaluationNumber: 'EVAL-002', status: 'completed', overallScore: 88 },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches supplier evaluation list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSupplierEvaluationList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].evaluationNumber).toBe('EVAL-001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSupplierEvaluationList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useSupplierEvaluation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/supplier-evaluations/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, evaluationNumber: 'EVAL-001', status: 'draft', overallScore: null },
        }),
      ),
    );
  });

  it('fetches a single evaluation by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSupplierEvaluation('eval-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('eval-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSupplierEvaluation(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateSupplierEvaluation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/supplier-evaluations`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'eval-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new supplier evaluation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateSupplierEvaluation(), { wrapper });

    act(() => {
      result.current.mutate({ supplierId: 'sup-1', periodStart: '2026-01-01', periodEnd: '2026-03-31' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('eval-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateSupplierEvaluation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/supplier-evaluations/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an existing supplier evaluation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateSupplierEvaluation(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'eval-1', notes: 'Updated notes' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('eval-1');
    expect(result.current.data!.data.notes).toBe('Updated notes');
  });
});

// ############################################################################
// COMPLETE
// ############################################################################

describe('useCompleteSupplierEvaluation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/supplier-evaluations/:id/complete`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'completed', overallScore: 90 },
        }),
      ),
    );
  });

  it('completes a supplier evaluation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteSupplierEvaluation(), { wrapper });

    act(() => {
      result.current.mutate('eval-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('completed');
    expect(result.current.data!.data.overallScore).toBe(90);
  });

  it('invalidates supplier-evaluations queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCompleteSupplierEvaluation(), { wrapper });

    act(() => {
      result.current.mutate('eval-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['supplier-evaluations']);

    invalidateSpy.mockRestore();
  });
});
