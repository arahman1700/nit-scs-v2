import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDocumentList,
  useDocument,
  useDocumentCategories,
  useUploadDocument,
  useUpdateDocument,
  useDeleteDocument,
} from './useDocuments';

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

const mockDocument = {
  id: 'doc-1',
  title: 'Safety Manual',
  fileName: 'safety-manual.pdf',
  mimeType: 'application/pdf',
  size: 204800,
  category: 'safety',
  url: '/uploads/safety-manual.pdf',
  uploadedById: 'emp-1',
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

const mockCategories = [
  { category: 'safety', count: 5 },
  { category: 'procurement', count: 12 },
  { category: 'operations', count: 8 },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/documents/categories`, () => HttpResponse.json({ success: true, data: mockCategories })),
    http.get(`${API}/documents/:id`, () => HttpResponse.json({ success: true, data: mockDocument })),
    http.get(`${API}/documents`, () =>
      HttpResponse.json({
        success: true,
        data: [mockDocument],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    http.post(`${API}/documents`, () =>
      HttpResponse.json({
        success: true,
        data: { ...mockDocument, id: 'doc-new', title: 'Uploaded Doc' },
      }),
    ),
    http.put(`${API}/documents/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { ...mockDocument, id: params.id, ...(body as object) },
      });
    }),
    http.delete(`${API}/documents/:id`, () => new HttpResponse(null, { status: 204 })),
  );
});

// ── Hook Tests ──────────────────────────────────────────────────────────────

describe('useDocumentList', () => {
  it('fetches document list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].title).toBe('Safety Manual');
    expect(result.current.data?.data[0].category).toBe('safety');
  });
});

describe('useDocument', () => {
  it('fetches a single document by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocument('doc-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('doc-1');
    expect(result.current.data?.data.fileName).toBe('safety-manual.pdf');
    expect(result.current.data?.data.mimeType).toBe('application/pdf');
  });
});

describe('useDocumentCategories', () => {
  it('fetches document categories with counts', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentCategories(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(3);
    expect(result.current.data?.data[0]).toEqual({ category: 'safety', count: 5 });
    expect(result.current.data?.data[1]).toEqual({ category: 'procurement', count: 12 });
  });
});

describe('useUploadDocument', () => {
  it('uploads a new document via FormData', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUploadDocument(), { wrapper });

    const formData = new FormData();
    formData.append('title', 'Uploaded Doc');
    formData.append('category', 'operations');

    act(() => {
      result.current.mutate(formData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.title).toBe('Uploaded Doc');
  });
});

describe('useUpdateDocument', () => {
  it('updates document metadata', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateDocument(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'doc-1', title: 'Updated Safety Manual', category: 'compliance' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.title).toBe('Updated Safety Manual');
    expect(result.current.data?.data.category).toBe('compliance');
  });
});

describe('useDeleteDocument', () => {
  it('deletes a document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteDocument(), { wrapper });

    act(() => {
      result.current.mutate('doc-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
