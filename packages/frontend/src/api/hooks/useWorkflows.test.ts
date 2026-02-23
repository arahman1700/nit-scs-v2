import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useActivateWorkflow,
  useDeactivateWorkflow,
  useWorkflowRules,
  useWorkflowRule,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useTestRule,
  useRuleLogs,
} from './useWorkflows';

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

const mockWorkflows = [
  { id: 'wf-1', name: 'Approval Flow', status: 'active', triggerEvent: 'grn.submitted' },
  { id: 'wf-2', name: 'Notification Flow', status: 'inactive', triggerEvent: 'mi.approved' },
];

const mockRules = [
  { id: 'rule-1', name: 'Auto Approve', priority: 1, condition: '{}', action: 'approve' },
  { id: 'rule-2', name: 'Send Email', priority: 2, condition: '{}', action: 'email' },
];

const mockLogs = [
  { id: 'log-1', ruleId: 'rule-1', status: 'success', executedAt: '2026-02-20T10:00:00Z' },
  { id: 'log-2', ruleId: 'rule-1', status: 'error', executedAt: '2026-02-20T11:00:00Z' },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    // Workflow CRUD
    http.get(`${API}/workflows`, () => HttpResponse.json({ success: true, data: mockWorkflows })),
    http.get(`${API}/workflows/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockWorkflows[0], id: params.id } }),
    ),
    http.post(`${API}/workflows`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'wf-new', ...(body as object) } });
    }),
    http.put(`${API}/workflows/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/workflows/:id`, () => new HttpResponse(null, { status: 204 })),
    // Activate / Deactivate
    http.put(`${API}/workflows/:id/activate`, ({ params }) =>
      HttpResponse.json({ success: true, data: { id: params.id, status: 'active' } }),
    ),
    http.put(`${API}/workflows/:id/deactivate`, ({ params }) =>
      HttpResponse.json({ success: true, data: { id: params.id, status: 'inactive' } }),
    ),
    // Rules CRUD
    http.get(`${API}/workflows/:wfId/rules`, () => HttpResponse.json({ success: true, data: mockRules })),
    http.get(`${API}/workflows/:wfId/rules/:ruleId`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockRules[0], id: params.ruleId } }),
    ),
    http.post(`${API}/workflows/:wfId/rules`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'rule-new', ...(body as object) } });
    }),
    http.put(`${API}/workflows/:wfId/rules/:ruleId`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.ruleId, ...(body as object) } });
    }),
    http.delete(`${API}/workflows/:wfId/rules/:ruleId`, () => new HttpResponse(null, { status: 204 })),
    // Test rule
    http.post(`${API}/workflows/:wfId/rules/:ruleId/test`, () =>
      HttpResponse.json({ success: true, data: { matched: true, actions: ['approve'] } }),
    ),
    // Rule logs
    http.get(`${API}/workflows/:wfId/rules/:ruleId/logs`, () => HttpResponse.json({ success: true, data: mockLogs })),
  );
});

// ── Workflow Query Tests ─────────────────────────────────────────────────────

describe('useWorkflows', () => {
  it('fetches workflow list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].name).toBe('Approval Flow');
    expect(result.current.data?.data[1].status).toBe('inactive');
  });
});

describe('useWorkflow', () => {
  it('fetches single workflow by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflow('wf-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('wf-1');
    expect(result.current.data?.data.name).toBe('Approval Flow');
  });

  it('does not fetch when id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflow(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Workflow Mutation Tests ──────────────────────────────────────────────────

describe('useCreateWorkflow', () => {
  it('creates a workflow and returns data', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateWorkflow(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'New Flow', triggerEvent: 'grn.created' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.name).toBe('New Flow');
  });
});

describe('useUpdateWorkflow', () => {
  it('updates a workflow by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'wf-1', name: 'Updated Flow' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('wf-1');
    expect(result.current.data?.data.name).toBe('Updated Flow');
  });
});

describe('useDeleteWorkflow', () => {
  it('deletes a workflow (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteWorkflow(), { wrapper });

    act(() => {
      result.current.mutate('wf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useActivateWorkflow', () => {
  it('activates a workflow via PUT', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useActivateWorkflow(), { wrapper });

    act(() => {
      result.current.mutate('wf-2');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe('active');
  });
});

describe('useDeactivateWorkflow', () => {
  it('deactivates a workflow via PUT', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeactivateWorkflow(), { wrapper });

    act(() => {
      result.current.mutate('wf-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe('inactive');
  });
});

// ── Rule Query Tests ─────────────────────────────────────────────────────────

describe('useWorkflowRules', () => {
  it('fetches rules for a workflow', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflowRules('wf-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].name).toBe('Auto Approve');
    expect(result.current.data?.data[1].priority).toBe(2);
  });

  it('does not fetch when workflowId is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflowRules(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useWorkflowRule', () => {
  it('fetches a single rule', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflowRule('wf-1', 'rule-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('rule-1');
  });

  it('does not fetch when either id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflowRule(undefined, 'rule-1'), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Rule Mutation Tests ──────────────────────────────────────────────────────

describe('useCreateRule', () => {
  it('creates a rule under a workflow', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateRule(), { wrapper });

    act(() => {
      result.current.mutate({ workflowId: 'wf-1', name: 'New Rule', condition: '{}' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.name).toBe('New Rule');
  });
});

describe('useUpdateRule', () => {
  it('updates an existing rule', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateRule(), { wrapper });

    act(() => {
      result.current.mutate({ workflowId: 'wf-1', id: 'rule-1', name: 'Updated Rule' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('rule-1');
    expect(result.current.data?.data.name).toBe('Updated Rule');
  });
});

describe('useDeleteRule', () => {
  it('deletes a rule (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteRule(), { wrapper });

    act(() => {
      result.current.mutate({ workflowId: 'wf-1', id: 'rule-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useTestRule', () => {
  it('tests a rule with event payload', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTestRule(), { wrapper });

    act(() => {
      result.current.mutate({
        workflowId: 'wf-1',
        id: 'rule-1',
        event: { type: 'grn.submitted', documentId: 'grn-1' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.matched).toBe(true);
  });
});

describe('useRuleLogs', () => {
  it('fetches logs for a rule', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRuleLogs('wf-1', 'rule-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].status).toBe('success');
    expect(result.current.data?.data[1].status).toBe('error');
  });

  it('does not fetch when ids are undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRuleLogs(undefined, undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
