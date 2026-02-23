import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useDynamicTypeList,
  useActiveDynamicTypes,
  useDynamicType,
  useCreateDynamicType,
  useUpdateDynamicType,
  useDeleteDynamicType,
  useAddField,
  useUpdateField,
  useDeleteField,
  useReorderFields,
} from './useDynamicDocumentTypes';

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

const mockType = {
  id: 'dt-1',
  code: 'CUSTOM_DOC',
  name: 'Custom Document',
  description: 'Test',
  category: 'operations',
  isActive: true,
  version: 1,
  statusFlow: {
    initialStatus: 'draft',
    statuses: [{ key: 'draft', label: 'Draft', color: 'gray' }],
    transitions: { draft: ['submitted'] },
  },
  settings: {},
  visibleToRoles: ['ADMIN'],
  createdAt: '2026-01-01T00:00:00Z',
  fields: [
    {
      id: 'f-1',
      documentTypeId: 'dt-1',
      fieldKey: 'title',
      label: 'Title',
      fieldType: 'text',
      isRequired: true,
      showInGrid: true,
      showInForm: true,
      sortOrder: 0,
      colSpan: 2,
      isLineItem: false,
      isReadOnly: false,
    },
  ],
  _count: { fields: 1, documents: 5 },
};

const mockField = {
  id: 'f-2',
  documentTypeId: 'dt-1',
  fieldKey: 'amount',
  label: 'Amount',
  fieldType: 'number',
  isRequired: false,
  showInGrid: true,
  showInForm: true,
  sortOrder: 1,
  colSpan: 1,
  isLineItem: false,
  isReadOnly: false,
};

const mockActiveTypes = [
  { code: 'CUSTOM_DOC', name: 'Custom Document', icon: 'file', category: 'operations' },
  { code: 'CHECKLIST', name: 'Checklist', category: 'quality' },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    // Dynamic type CRUD
    http.get(`${API}/dynamic-types`, () => HttpResponse.json({ success: true, data: [mockType] })),
    http.get(`${API}/dynamic-types/active`, () => HttpResponse.json({ success: true, data: mockActiveTypes })),
    http.get(`${API}/dynamic-types/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockType, id: params.id } }),
    ),
    http.post(`${API}/dynamic-types`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'dt-new', ...(body as object) } });
    }),
    http.put(`${API}/dynamic-types/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/dynamic-types/:id`, () => new HttpResponse(null, { status: 204 })),
    // Field management
    http.post(`${API}/dynamic-types/:typeId/fields`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'f-new', ...(body as object) } });
    }),
    http.put(`${API}/dynamic-types/:typeId/fields/:fieldId`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.fieldId, ...(body as object) } });
    }),
    http.delete(`${API}/dynamic-types/:typeId/fields/:fieldId`, () => new HttpResponse(null, { status: 204 })),
    http.post(`${API}/dynamic-types/:typeId/fields/reorder`, () => HttpResponse.json({ success: true, data: null })),
  );
});

// ── Query Tests ─────────────────────────────────────────────────────────────

describe('useDynamicTypeList', () => {
  it('fetches the list of dynamic document types', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDynamicTypeList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].code).toBe('CUSTOM_DOC');
    expect(result.current.data?.data[0]._count?.fields).toBe(1);
  });
});

describe('useActiveDynamicTypes', () => {
  it('fetches active types for navigation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useActiveDynamicTypes(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].code).toBe('CUSTOM_DOC');
    expect(result.current.data?.data[1].code).toBe('CHECKLIST');
  });
});

describe('useDynamicType', () => {
  it('fetches a single dynamic type by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDynamicType('dt-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('dt-1');
    expect(result.current.data?.data.name).toBe('Custom Document');
    expect(result.current.data?.data.fields).toHaveLength(1);
  });

  it('does not fetch when id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDynamicType(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Mutation Tests ──────────────────────────────────────────────────────────

describe('useCreateDynamicType', () => {
  it('creates a new dynamic type', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateDynamicType(), { wrapper });

    act(() => {
      result.current.mutate({ code: 'NEW_TYPE', name: 'New Type', category: 'logistics' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('dt-new');
    expect(result.current.data?.data.name).toBe('New Type');
  });
});

describe('useUpdateDynamicType', () => {
  it('updates an existing dynamic type', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateDynamicType(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'dt-1', name: 'Updated Document' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('dt-1');
    expect(result.current.data?.data.name).toBe('Updated Document');
  });
});

describe('useDeleteDynamicType', () => {
  it('deletes a dynamic type (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteDynamicType(), { wrapper });

    act(() => {
      result.current.mutate('dt-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ── Field Management Tests ──────────────────────────────────────────────────

describe('useAddField', () => {
  it('adds a field to a dynamic type', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddField(), { wrapper });

    act(() => {
      result.current.mutate({
        typeId: 'dt-1',
        fieldKey: 'amount',
        label: 'Amount',
        fieldType: 'number',
        isRequired: false,
        showInGrid: true,
        showInForm: true,
        sortOrder: 1,
        colSpan: 1,
        isLineItem: false,
        isReadOnly: false,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('f-new');
    expect(result.current.data?.data.label).toBe('Amount');
  });
});

describe('useUpdateField', () => {
  it('updates a field on a dynamic type', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateField(), { wrapper });

    act(() => {
      result.current.mutate({ typeId: 'dt-1', fieldId: 'f-1', label: 'Updated Title' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('f-1');
    expect(result.current.data?.data.label).toBe('Updated Title');
  });
});

describe('useDeleteField', () => {
  it('deletes a field from a dynamic type (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteField(), { wrapper });

    act(() => {
      result.current.mutate({ typeId: 'dt-1', fieldId: 'f-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useReorderFields', () => {
  it('reorders fields on a dynamic type (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReorderFields(), { wrapper });

    act(() => {
      result.current.mutate({ typeId: 'dt-1', fieldIds: ['f-2', 'f-1'] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
