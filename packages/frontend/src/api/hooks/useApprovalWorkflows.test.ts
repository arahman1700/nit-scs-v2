import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useApprovalWorkflows,
  useApprovalWorkflowsByType,
  useCreateApprovalWorkflow,
  useUpdateApprovalWorkflow,
  useDeleteApprovalWorkflow,
  useApprovalChainPreview,
} from './useApprovalWorkflows';

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

const mockWorkflows = [
  { id: 'aw-1', documentType: 'grn', minAmount: 0, maxAmount: 10000, approverRole: 'manager', slaHours: 24 },
  { id: 'aw-2', documentType: 'grn', minAmount: 10001, maxAmount: null, approverRole: 'director', slaHours: 48 },
];

beforeEach(() => {
  server.use(
    http.get(`${API}/approvals/workflows`, () => HttpResponse.json({ success: true, data: mockWorkflows })),
    http.get(`${API}/approvals/workflows/:documentType`, ({ params }) =>
      HttpResponse.json({
        success: true,
        data: mockWorkflows.filter(w => w.documentType === params.documentType),
      }),
    ),
    http.post(`${API}/approvals/workflows`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'aw-new', ...(body as object) } });
    }),
    http.put(`${API}/approvals/workflows/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/approvals/workflows/:id`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${API}/approvals/chain/:documentType/:amount`, () =>
      HttpResponse.json({
        success: true,
        data: { steps: [{ level: 1, approverRole: 'manager', slaHours: 24 }] },
      }),
    ),
  );
});

describe('useApprovalWorkflows', () => {
  it('fetches all approval workflows', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApprovalWorkflows(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].id).toBe('aw-1');
    expect(result.current.data?.data[1].approverRole).toBe('director');
  });
});

describe('useApprovalWorkflowsByType', () => {
  it('fetches workflows filtered by document type', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApprovalWorkflowsByType('grn'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].documentType).toBe('grn');
  });
});

describe('useCreateApprovalWorkflow', () => {
  it('creates a new approval workflow', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateApprovalWorkflow(), { wrapper });

    act(() => {
      result.current.mutate({
        documentType: 'mi',
        minAmount: 0,
        maxAmount: 5000,
        approverRole: 'supervisor',
        slaHours: 12,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('aw-new');
    expect(result.current.data?.data.documentType).toBe('mi');
  });
});

describe('useUpdateApprovalWorkflow', () => {
  it('updates an existing approval workflow', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateApprovalWorkflow(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'aw-1', slaHours: 36 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('aw-1');
    expect(result.current.data?.data.slaHours).toBe(36);
  });
});

describe('useDeleteApprovalWorkflow', () => {
  it('deletes an approval workflow', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteApprovalWorkflow(), { wrapper });

    act(() => {
      result.current.mutate('aw-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useApprovalChainPreview', () => {
  it('fetches chain preview for a document type and amount', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApprovalChainPreview('grn', 5000), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.steps).toHaveLength(1);
    expect(result.current.data?.data.steps[0].approverRole).toBe('manager');
  });
});
