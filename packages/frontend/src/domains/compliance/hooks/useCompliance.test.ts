import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useChecklistList,
  useChecklist,
  useCreateChecklist,
  useUpdateChecklist,
  useAuditList,
  useAudit,
  useCreateAudit,
  useSubmitAuditResponses,
  useCompleteAudit,
} from './useCompliance';

const API = '/api/v1';

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
// CHECKLIST LIST
// ############################################################################

describe('useChecklistList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/compliance/checklists`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'cl-1',
              checklistCode: 'CL-001',
              title: 'Safety Checklist',
              standard: 'ISO 9001',
              category: 'safety',
            },
            {
              id: 'cl-2',
              checklistCode: 'CL-002',
              title: 'Quality Checklist',
              standard: 'ISO 14001',
              category: 'quality',
            },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches checklist list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChecklistList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].title).toBe('Safety Checklist');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChecklistList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// CHECKLIST DETAIL
// ############################################################################

describe('useChecklist', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/compliance/checklists/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            checklistCode: 'CL-001',
            title: 'Safety Checklist',
            standard: 'ISO 9001',
            category: 'safety',
          },
        }),
      ),
    );
  });

  it('fetches a single checklist by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChecklist('cl-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data.id).toBe('cl-1');
    expect(result.current.data!.data.title).toBe('Safety Checklist');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChecklist(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE CHECKLIST
// ############################################################################

describe('useCreateChecklist', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/compliance/checklists`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'cl-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new checklist', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateChecklist(), { wrapper });

    act(() => {
      result.current.mutate({
        checklistCode: 'CL-003',
        title: 'New Checklist',
        standard: 'ISO 9001',
        category: 'safety',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data.id).toBe('cl-new');
    expect(result.current.data!.data.title).toBe('New Checklist');
  });
});

// ############################################################################
// UPDATE CHECKLIST
// ############################################################################

describe('useUpdateChecklist', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/compliance/checklists/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an existing checklist', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateChecklist(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'cl-1', title: 'Updated Safety Checklist' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data.id).toBe('cl-1');
    expect(result.current.data!.data.title).toBe('Updated Safety Checklist');
  });
});

// ############################################################################
// AUDIT LIST
// ############################################################################

describe('useAuditList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/compliance/audits`, () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 'audit-1', auditNumber: 'AUD-001', status: 'draft', overallScore: null }],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches audit list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuditList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(1);
    expect(result.current.data!.data[0].auditNumber).toBe('AUD-001');
  });
});

// ############################################################################
// AUDIT DETAIL
// ############################################################################

describe('useAudit', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/compliance/audits/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, auditNumber: 'AUD-001', status: 'in_progress' },
        }),
      ),
    );
  });

  it('fetches a single audit', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAudit('audit-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('audit-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAudit(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE AUDIT
// ############################################################################

describe('useCreateAudit', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/compliance/audits`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'audit-new', ...(body as object), status: 'draft' } });
      }),
    );
  });

  it('creates a new audit', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateAudit(), { wrapper });

    act(() => {
      result.current.mutate({
        checklistId: 'cl-1',
        warehouseId: 'wh-1',
        auditDate: '2026-03-01',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('audit-new');
  });
});

// ############################################################################
// SUBMIT AUDIT RESPONSES
// ############################################################################

describe('useSubmitAuditResponses', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/compliance/audits/:id/responses`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'in_progress', overallScore: 85 },
        }),
      ),
    );
  });

  it('submits audit responses', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitAuditResponses(), { wrapper });

    act(() => {
      result.current.mutate({
        auditId: 'audit-1',
        responses: [{ checklistItemId: 'item-1', response: 'compliant', score: 10 }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.overallScore).toBe(85);
  });
});

// ############################################################################
// COMPLETE AUDIT
// ############################################################################

describe('useCompleteAudit', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/compliance/audits/:id/complete`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'completed', overallScore: 92 },
        }),
      ),
    );
  });

  it('completes an audit', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCompleteAudit(), { wrapper });

    act(() => {
      result.current.mutate('audit-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('completed');
  });
});
