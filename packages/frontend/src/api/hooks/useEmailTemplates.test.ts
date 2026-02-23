import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useEmailTemplates,
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  usePreviewEmailTemplate,
  useEmailLogs,
  useEmailLogStats,
} from './useEmailTemplates';

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

const mockTemplates = [
  {
    id: 'tpl-1',
    name: 'Approval Request',
    subject: 'Approval Needed: {{documentNumber}}',
    bodyHtml: '<p>Please approve</p>',
    isActive: true,
  },
  {
    id: 'tpl-2',
    name: 'Status Update',
    subject: 'Status Changed: {{documentNumber}}',
    bodyHtml: '<p>Status updated</p>',
    isActive: false,
  },
];

const mockLogs = [
  { id: 'log-1', templateId: 'tpl-1', to: 'user@example.com', status: 'sent', sentAt: '2026-02-20T10:00:00Z' },
  { id: 'log-2', templateId: 'tpl-1', to: 'admin@example.com', status: 'failed', sentAt: '2026-02-20T11:00:00Z' },
];

const mockStats = {
  totalSent: 150,
  totalFailed: 5,
  totalPending: 3,
  byTemplate: [
    { templateId: 'tpl-1', name: 'Approval Request', sent: 100, failed: 3 },
    { templateId: 'tpl-2', name: 'Status Update', sent: 50, failed: 2 },
  ],
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    // Template CRUD
    http.get(`${API}/email-templates`, () => HttpResponse.json({ success: true, data: mockTemplates })),
    http.get(`${API}/email-templates/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockTemplates[0], id: params.id } }),
    ),
    http.post(`${API}/email-templates`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'tpl-new', ...(body as object) } });
    }),
    http.put(`${API}/email-templates/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/email-templates/:id`, () => new HttpResponse(null, { status: 204 })),
    // Preview
    http.post(`${API}/email-templates/:id/preview`, () =>
      HttpResponse.json({
        success: true,
        data: { subject: 'Approval Needed: GRN-001', html: '<p>Please approve GRN-001</p>' },
      }),
    ),
    // Logs
    http.get(`${API}/email-logs`, () => HttpResponse.json({ success: true, data: mockLogs })),
    http.get(`${API}/email-logs/stats`, () => HttpResponse.json({ success: true, data: mockStats })),
  );
});

// ── Template Query Tests ─────────────────────────────────────────────────────

describe('useEmailTemplates', () => {
  it('fetches email template list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailTemplates(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].name).toBe('Approval Request');
    expect(result.current.data?.data[1].isActive).toBe(false);
  });
});

describe('useEmailTemplate', () => {
  it('fetches a single template by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailTemplate('tpl-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('tpl-1');
    expect(result.current.data?.data.name).toBe('Approval Request');
  });

  it('does not fetch when id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailTemplate(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Template Mutation Tests ──────────────────────────────────────────────────

describe('useCreateEmailTemplate', () => {
  it('creates a new email template', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateEmailTemplate(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'Welcome Email', subject: 'Welcome!', bodyHtml: '<p>Welcome</p>' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.name).toBe('Welcome Email');
  });
});

describe('useUpdateEmailTemplate', () => {
  it('updates an existing email template', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateEmailTemplate(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'tpl-1', name: 'Updated Template', subject: 'Updated Subject' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('tpl-1');
    expect(result.current.data?.data.name).toBe('Updated Template');
  });
});

describe('useDeleteEmailTemplate', () => {
  it('deletes an email template (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteEmailTemplate(), { wrapper });

    act(() => {
      result.current.mutate('tpl-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('usePreviewEmailTemplate', () => {
  it('previews a template with variables', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePreviewEmailTemplate(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'tpl-1', variables: { documentNumber: 'GRN-001', userName: 'Ahmed' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.subject).toBe('Approval Needed: GRN-001');
    expect(result.current.data?.data.html).toContain('GRN-001');
  });
});

// ── Email Logs Tests ─────────────────────────────────────────────────────────

describe('useEmailLogs', () => {
  it('fetches email logs', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailLogs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].status).toBe('sent');
    expect(result.current.data?.data[1].status).toBe('failed');
  });

  it('fetches email logs with filter params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailLogs({ status: 'sent', page: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
  });
});

describe('useEmailLogStats', () => {
  it('fetches email log statistics', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailLogStats(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.totalSent).toBe(150);
    expect(result.current.data?.data.totalFailed).toBe(5);
    expect(result.current.data?.data.byTemplate).toHaveLength(2);
  });
});
