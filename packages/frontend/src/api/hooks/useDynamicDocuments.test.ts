import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDynamicDocumentList,
  useDynamicDocument,
  useCreateDynamicDocument,
  useUpdateDynamicDocument,
  useTransitionDynamicDocument,
  useDynamicDocumentHistory,
} from './useDynamicDocuments';

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
const TYPE_CODE = 'CUSTOM';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const mockDynDoc = {
  id: 'dd-1',
  documentTypeId: 'dt-1',
  documentNumber: 'CUSTOM-2026-001',
  status: 'draft',
  data: { title: 'Test' },
  version: 1,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

const mockHistory = [
  {
    id: 'hist-1',
    fromStatus: null,
    toStatus: 'draft',
    performedAt: '2026-02-01T00:00:00Z',
    comment: 'Created',
    performedBy: { fullName: 'Ahmed Admin' },
  },
  {
    id: 'hist-2',
    fromStatus: 'draft',
    toStatus: 'submitted',
    performedAt: '2026-02-02T00:00:00Z',
    comment: 'Submitted for review',
    performedBy: { fullName: 'Ahmed Admin' },
  },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/dynamic/${TYPE_CODE}`, () =>
      HttpResponse.json({
        success: true,
        data: [mockDynDoc],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    http.get(`${API}/dynamic/${TYPE_CODE}/:id/history`, () => HttpResponse.json({ success: true, data: mockHistory })),
    http.get(`${API}/dynamic/${TYPE_CODE}/:id`, () => HttpResponse.json({ success: true, data: mockDynDoc })),
    http.post(`${API}/dynamic/${TYPE_CODE}/:id/transition`, async ({ request, params }) => {
      const body = (await request.json()) as { targetStatus: string; comment?: string };
      return HttpResponse.json({
        success: true,
        data: { ...mockDynDoc, id: params.id, status: body.targetStatus },
      });
    }),
    http.post(`${API}/dynamic/${TYPE_CODE}`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: {
          ...mockDynDoc,
          id: 'dd-new',
          documentNumber: 'CUSTOM-2026-002',
          ...(body as object),
        },
      });
    }),
    http.put(`${API}/dynamic/${TYPE_CODE}/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: { ...mockDynDoc, id: params.id, ...(body as object) },
      });
    }),
  );
});

// ── Hook Tests ──────────────────────────────────────────────────────────────

describe('useDynamicDocumentList', () => {
  it('fetches dynamic document list by type code', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDynamicDocumentList(TYPE_CODE), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].documentNumber).toBe('CUSTOM-2026-001');
    expect(result.current.data?.data[0].status).toBe('draft');
  });
});

describe('useDynamicDocument', () => {
  it('fetches a single dynamic document by type code and id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDynamicDocument(TYPE_CODE, 'dd-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('dd-1');
    expect(result.current.data?.data.data).toEqual({ title: 'Test' });
    expect(result.current.data?.data.version).toBe(1);
  });
});

describe('useCreateDynamicDocument', () => {
  it('creates a new dynamic document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateDynamicDocument(TYPE_CODE), { wrapper });

    act(() => {
      result.current.mutate({ data: { title: 'New Doc' }, projectId: 'proj-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('dd-new');
    expect(result.current.data?.data.documentNumber).toBe('CUSTOM-2026-002');
  });
});

describe('useUpdateDynamicDocument', () => {
  it('updates an existing dynamic document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateDynamicDocument(TYPE_CODE), { wrapper });

    act(() => {
      result.current.mutate({ id: 'dd-1', data: { title: 'Updated' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.data).toEqual({ title: 'Updated' });
  });
});

describe('useTransitionDynamicDocument', () => {
  it('transitions a dynamic document to a new status', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTransitionDynamicDocument(TYPE_CODE), { wrapper });

    act(() => {
      result.current.mutate({ id: 'dd-1', targetStatus: 'submitted', comment: 'Ready for review' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe('submitted');
  });
});

describe('useDynamicDocumentHistory', () => {
  it('fetches status history for a dynamic document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDynamicDocumentHistory(TYPE_CODE, 'dd-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].toStatus).toBe('draft');
    expect(result.current.data?.data[0].fromStatus).toBeNull();
    expect(result.current.data?.data[1].toStatus).toBe('submitted');
    expect(result.current.data?.data[1].performedBy?.fullName).toBe('Ahmed Admin');
  });
});
