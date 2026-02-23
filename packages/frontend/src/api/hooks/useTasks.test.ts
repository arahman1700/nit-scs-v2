import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useTaskList,
  useTask,
  useCreateTask,
  useUpdateTask,
  useAssignTask,
  useChangeTaskStatus,
  useAddTaskComment,
  useDeleteTask,
} from './useTasks';

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

const mockTask = {
  id: 'task-1',
  title: 'Fix GRN bug',
  description: 'Investigate',
  status: 'open',
  priority: 'high',
  assigneeId: 'emp-1',
  projectId: 'proj-1',
  createdAt: '2026-02-20T10:00:00Z',
};

const mockComment = {
  id: 'cmt-1',
  body: 'Working on it',
  createdAt: '2026-02-20T11:00:00Z',
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/tasks`, () =>
      HttpResponse.json({
        success: true,
        data: [mockTask],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    http.get(`${API}/tasks/:id`, () => HttpResponse.json({ success: true, data: mockTask })),
    http.post(`${API}/tasks`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'task-new', ...(body as object), status: 'open' } });
    }),
    http.put(`${API}/tasks/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.put(`${API}/tasks/:id/assign`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { ...mockTask, id: params.id, ...(body as object) } });
    }),
    http.put(`${API}/tasks/:id/status`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { ...mockTask, id: params.id, ...(body as object) } });
    }),
    http.post(`${API}/tasks/:id/comments`, () => HttpResponse.json({ success: true, data: mockComment })),
    http.delete(`${API}/tasks/:id`, () => new HttpResponse(null, { status: 204 })),
  );
});

// ── Hook Tests ──────────────────────────────────────────────────────────────

describe('useTaskList', () => {
  it('fetches task list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTaskList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].title).toBe('Fix GRN bug');
    expect(result.current.data?.data[0].status).toBe('open');
  });
});

describe('useTask', () => {
  it('fetches a single task by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTask('task-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('task-1');
    expect(result.current.data?.data.priority).toBe('high');
  });
});

describe('useCreateTask', () => {
  it('creates a new task', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateTask(), { wrapper });

    act(() => {
      result.current.mutate({ title: 'New task', description: 'Desc', priority: 'medium' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.title).toBe('New task');
    expect(result.current.data?.data.status).toBe('open');
  });
});

describe('useUpdateTask', () => {
  it('updates an existing task', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateTask(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'task-1', title: 'Updated title' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.title).toBe('Updated title');
  });
});

describe('useAssignTask', () => {
  it('assigns a task to a user', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAssignTask(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'task-1', assigneeId: 'emp-2' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.assigneeId).toBe('emp-2');
  });
});

describe('useChangeTaskStatus', () => {
  it('changes task status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChangeTaskStatus(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'task-1', status: 'in_progress' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe('in_progress');
  });
});

describe('useAddTaskComment', () => {
  it('adds a comment to a task', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddTaskComment(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'task-1', body: 'Working on it' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.body).toBe('Working on it');
  });
});

describe('useDeleteTask', () => {
  it('deletes a task', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteTask(), { wrapper });

    act(() => {
      result.current.mutate('task-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
