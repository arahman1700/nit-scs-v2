import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useToolIssueList,
  useToolIssue,
  useCreateToolIssue,
  useUpdateToolIssue,
  useReturnToolIssue,
} from './useToolIssues';

const API = '/api/v1';

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

// ############################################################################
// LIST
// ############################################################################

describe('useToolIssueList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/tool-issues`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'issue-1', toolId: 'tool-1', issuedTo: 'emp-1', status: 'issued', issuedAt: '2026-02-20T08:00:00Z' },
            { id: 'issue-2', toolId: 'tool-2', issuedTo: 'emp-2', status: 'issued', issuedAt: '2026-02-20T09:00:00Z' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches tool issue list with paginated response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useToolIssueList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('issue-1');
    expect(data.data[0].toolId).toBe('tool-1');
    expect(data.data[0].status).toBe('issued');
    expect(data.data[1].id).toBe('issue-2');
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(2);
    expect(data.meta.totalPages).toBe(1);
  });

  it('accepts optional list params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useToolIssueList({ page: 1, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useToolIssue', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/tool-issues/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            toolId: 'tool-1',
            issuedTo: 'emp-1',
            status: 'issued',
            issuedAt: '2026-02-20T08:00:00Z',
          },
        }),
      ),
    );
  });

  it('fetches a single tool issue by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useToolIssue('issue-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('issue-1');
    expect(data.data.toolId).toBe('tool-1');
    expect(data.data.status).toBe('issued');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useToolIssue(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateToolIssue', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/tool-issues`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'issue-new', ...(body as object), status: 'issued' },
        });
      }),
    );
  });

  it('creates a new tool issue', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateToolIssue(), { wrapper });

    act(() => {
      result.current.mutate({ toolId: 'tool-3', issuedTo: 'emp-5', projectId: 'proj-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('issue-new');
    expect(data.data.toolId).toBe('tool-3');
    expect(data.data.status).toBe('issued');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateToolIssue', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/tool-issues/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object) },
        });
      }),
    );
  });

  it('updates an existing tool issue', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateToolIssue(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'issue-1', notes: 'Extended return date' } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('issue-1');
    expect(data.data.notes).toBe('Extended return date');
  });
});

// ############################################################################
// RETURN
// ############################################################################

describe('useReturnToolIssue', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/tool-issues/:id/return`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'returned' },
        }),
      ),
    );
  });

  it('returns a tool issue and gets returned status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReturnToolIssue(), { wrapper });

    act(() => {
      result.current.mutate('issue-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('issue-1');
    expect(data.data.status).toBe('returned');
  });
});
