import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useWorkflowTemplateList, useWorkflowTemplate, useInstallWorkflowTemplate } from './useWorkflowTemplates';

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

const mockTemplates = [
  {
    id: 'wt-1',
    name: 'Auto-approve small GRN',
    description: 'Automatically approve GRNs under 5000 SAR',
    category: 'approval',
    source: 'system',
    template: {
      workflow: { name: 'Auto GRN Approval', entityType: 'grn' },
      rules: [{ name: 'Small GRN auto-approve', triggerEvent: 'grn.submitted', conditions: {}, actions: [] }],
    },
    installCount: 12,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'wt-2',
    name: 'Low stock alert',
    description: 'Send notification when stock drops below threshold',
    category: 'notification',
    source: 'system',
    template: {
      workflow: { name: 'Low Stock Alert', entityType: 'inventory' },
      rules: [{ name: 'Low stock check', triggerEvent: 'inventory.updated', conditions: {}, actions: [] }],
    },
    installCount: 8,
    createdAt: '2026-01-15T00:00:00Z',
  },
];

beforeEach(() => {
  server.use(
    http.get(`${API}/workflow-templates`, () => HttpResponse.json({ success: true, data: mockTemplates })),
    http.get(`${API}/workflow-templates/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockTemplates[0], id: params.id } }),
    ),
    http.post(`${API}/workflow-templates/:id/install`, () =>
      HttpResponse.json({ success: true, data: { workflowId: 'wf-new' } }),
    ),
  );
});

describe('useWorkflowTemplateList', () => {
  it('fetches workflow template list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflowTemplateList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].name).toBe('Auto-approve small GRN');
    expect(result.current.data?.data[1].category).toBe('notification');
  });
});

describe('useWorkflowTemplate', () => {
  it('fetches a single workflow template by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useWorkflowTemplate('wt-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('wt-1');
    expect(result.current.data?.data.name).toBe('Auto-approve small GRN');
  });
});

describe('useInstallWorkflowTemplate', () => {
  it('installs a workflow template and returns new workflow id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInstallWorkflowTemplate(), { wrapper });

    act(() => {
      result.current.mutate('wt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.workflowId).toBe('wf-new');
  });
});
