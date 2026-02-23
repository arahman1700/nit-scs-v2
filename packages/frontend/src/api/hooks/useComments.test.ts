import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDocumentComments,
  useCommentCount,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from './useComments';

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

const mockComment = {
  id: 'cmt-1',
  documentType: 'grn',
  documentId: 'grn-1',
  authorId: 'emp-1',
  content: 'Looks good to me',
  createdAt: '2026-02-20T10:00:00Z',
  updatedAt: '2026-02-20T10:00:00Z',
  author: { id: 'emp-1', fullName: 'Ahmed Admin', email: 'ahmed@test.com', department: 'Warehouse' },
};

const mockUpdatedComment = {
  ...mockComment,
  content: 'Updated comment',
  updatedAt: '2026-02-20T11:00:00Z',
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/comments/:documentType/:documentId`, () =>
      HttpResponse.json({
        success: true,
        data: [mockComment],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    http.get(`${API}/comments/:documentType/:documentId/count`, () =>
      HttpResponse.json({ success: true, data: { count: 3 } }),
    ),
    http.post(`${API}/comments/:documentType/:documentId`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { ...mockComment, id: 'cmt-new', ...(body as object) },
      });
    }),
    http.put(`${API}/comments/:documentType/:documentId/:commentId`, () =>
      HttpResponse.json({ success: true, data: mockUpdatedComment }),
    ),
    http.delete(`${API}/comments/:documentType/:documentId/:commentId`, () => new HttpResponse(null, { status: 204 })),
  );
});

// ── Hook Tests ──────────────────────────────────────────────────────────────

describe('useDocumentComments', () => {
  it('fetches comments for a document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentComments('grn', 'grn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].content).toBe('Looks good to me');
    expect(result.current.data?.data[0].author.fullName).toBe('Ahmed Admin');
  });
});

describe('useCommentCount', () => {
  it('fetches comment count for a document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCommentCount('grn', 'grn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.count).toBe(3);
  });
});

describe('useCreateComment', () => {
  it('creates a new comment on a document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateComment(), { wrapper });

    act(() => {
      result.current.mutate({ documentType: 'grn', documentId: 'grn-1', content: 'New comment' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.content).toBe('New comment');
  });
});

describe('useUpdateComment', () => {
  it('updates an existing comment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateComment(), { wrapper });

    act(() => {
      result.current.mutate({
        documentType: 'grn',
        documentId: 'grn-1',
        commentId: 'cmt-1',
        content: 'Updated comment',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.content).toBe('Updated comment');
  });
});

describe('useDeleteComment', () => {
  it('deletes a comment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteComment(), { wrapper });

    act(() => {
      result.current.mutate({ documentType: 'grn', documentId: 'grn-1', commentId: 'cmt-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
