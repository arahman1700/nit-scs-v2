import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDocumentApprovalGroups,
  usePendingApprovals,
  useCreateParallelApproval,
  useRespondToApproval,
} from './useParallelApprovals';

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

const mockGroups = [
  {
    id: 'grp-1',
    documentType: 'grn',
    documentId: 'grn-1',
    approvalLevel: 1,
    mode: 'all',
    status: 'pending',
    createdAt: '2026-02-20T10:00:00Z',
    completedAt: null,
    responses: [
      {
        id: 'resp-1',
        approverId: 'user-1',
        decision: 'approved',
        comments: 'Looks good',
        decidedAt: '2026-02-20T11:00:00Z',
        approver: { id: 'user-1', fullName: 'Ahmed Admin', email: 'admin@nit.sa', role: 'admin' },
      },
    ],
  },
  {
    id: 'grp-2',
    documentType: 'grn',
    documentId: 'grn-1',
    approvalLevel: 2,
    mode: 'any',
    status: 'pending',
    createdAt: '2026-02-20T12:00:00Z',
    completedAt: null,
    responses: [],
  },
];

const mockPending = [
  {
    id: 'grp-3',
    documentType: 'mi',
    documentId: 'mi-5',
    approvalLevel: 1,
    mode: 'all',
    status: 'pending',
    createdAt: '2026-02-21T08:00:00Z',
    completedAt: null,
    responses: [],
  },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${API}/parallel-approvals`, () => HttpResponse.json({ success: true, data: mockGroups })),
    http.get(`${API}/parallel-approvals/pending`, () => HttpResponse.json({ success: true, data: mockPending })),
    http.post(`${API}/parallel-approvals`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        success: true,
        data: {
          id: 'grp-new',
          ...(body as object),
          status: 'pending',
          createdAt: '2026-02-22T10:00:00Z',
          completedAt: null,
          responses: [],
        },
      });
    }),
    http.post(`${API}/parallel-approvals/:groupId/respond`, async ({ request, params }) => {
      const body = (await request.json()) as { decision: string; comments?: string };
      return HttpResponse.json({
        success: true,
        data: {
          id: params.groupId,
          documentType: 'grn',
          documentId: 'grn-1',
          approvalLevel: 1,
          mode: 'all',
          status: body.decision === 'approved' ? 'approved' : 'rejected',
          createdAt: '2026-02-20T10:00:00Z',
          completedAt: '2026-02-22T10:30:00Z',
          responses: [
            {
              id: 'resp-new',
              approverId: 'user-1',
              decision: body.decision,
              comments: body.comments ?? null,
              decidedAt: '2026-02-22T10:30:00Z',
              approver: { id: 'user-1', fullName: 'Ahmed Admin', email: 'admin@nit.sa', role: 'admin' },
            },
          ],
        },
      });
    }),
  );
});

// ── Document Approval Groups Tests ──────────────────────────────────────────

describe('useDocumentApprovalGroups', () => {
  it('fetches approval groups for a document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentApprovalGroups('grn', 'grn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].mode).toBe('all');
    expect(result.current.data?.data[0].approvalLevel).toBe(1);
    expect(result.current.data?.data[0].responses).toHaveLength(1);
    expect(result.current.data?.data[1].mode).toBe('any');
  });

  it('does not fetch when documentType or documentId is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentApprovalGroups(undefined, 'grn-1'), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Pending Approvals Tests ─────────────────────────────────────────────────

describe('usePendingApprovals', () => {
  it('fetches pending approvals for current user', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePendingApprovals(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].documentType).toBe('mi');
    expect(result.current.data?.data[0].status).toBe('pending');
  });
});

// ── Create Parallel Approval Tests ──────────────────────────────────────────

describe('useCreateParallelApproval', () => {
  it('creates a parallel approval group', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateParallelApproval(), { wrapper });

    act(() => {
      result.current.mutate({
        documentType: 'grn',
        documentId: 'grn-2',
        level: 1,
        mode: 'all' as const,
        approverIds: ['user-1', 'user-2'],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('grp-new');
    expect(result.current.data?.data.status).toBe('pending');
    expect(result.current.data?.data.documentType).toBe('grn');
  });
});

// ── Respond to Approval Tests ───────────────────────────────────────────────

describe('useRespondToApproval', () => {
  it('submits an approval decision with comments', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRespondToApproval(), { wrapper });

    act(() => {
      result.current.mutate({
        groupId: 'grp-1',
        decision: 'approved' as const,
        comments: 'LGTM',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('grp-1');
    expect(result.current.data?.data.status).toBe('approved');
    expect(result.current.data?.data.completedAt).toBeTruthy();
  });

  it('submits a rejection decision without comments', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRespondToApproval(), { wrapper });

    act(() => {
      result.current.mutate({
        groupId: 'grp-2',
        decision: 'rejected' as const,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('grp-2');
    expect(result.current.data?.data.status).toBe('rejected');
  });
});
