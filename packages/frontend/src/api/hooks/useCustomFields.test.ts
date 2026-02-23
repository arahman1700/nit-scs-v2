import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useCustomFieldDefinitions,
  useCustomFieldDefinition,
  useCreateCustomFieldDefinition,
  useUpdateCustomFieldDefinition,
  useDeleteCustomFieldDefinition,
  useCustomFieldValues,
  useSaveCustomFieldValues,
} from './useCustomFields';

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

const mockDefinitions = [
  {
    id: 'cfd-1',
    entityType: 'grn',
    fieldKey: 'custom_notes',
    label: 'Custom Notes',
    fieldType: 'textarea',
    isRequired: false,
    showInGrid: true,
    sortOrder: 0,
  },
  {
    id: 'cfd-2',
    entityType: 'grn',
    fieldKey: 'priority_level',
    label: 'Priority Level',
    fieldType: 'select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' },
    ],
    isRequired: true,
    showInGrid: true,
    sortOrder: 1,
  },
];

const mockValues = {
  custom_notes: 'Urgent delivery',
  priority_level: 'high',
};

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    // Definitions CRUD
    http.get(`${API}/custom-fields/definitions`, () => HttpResponse.json({ success: true, data: mockDefinitions })),
    http.get(`${API}/custom-fields/definitions/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockDefinitions[0], id: params.id } }),
    ),
    http.post(`${API}/custom-fields/definitions`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'cfd-new', ...(body as object) } });
    }),
    http.put(`${API}/custom-fields/definitions/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
    http.delete(`${API}/custom-fields/definitions/:id`, () => new HttpResponse(null, { status: 204 })),
    // Values
    http.get(`${API}/custom-fields/values/:entityType/:entityId`, () =>
      HttpResponse.json({ success: true, data: mockValues }),
    ),
    http.put(`${API}/custom-fields/values/:entityType/:entityId`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: body });
    }),
  );
});

// ── Definition Query Tests ──────────────────────────────────────────────────

describe('useCustomFieldDefinitions', () => {
  it('fetches all custom field definitions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomFieldDefinitions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].fieldKey).toBe('custom_notes');
    expect(result.current.data?.data[1].fieldType).toBe('select');
  });

  it('accepts optional entityType filter', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomFieldDefinitions('grn'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
  });
});

describe('useCustomFieldDefinition', () => {
  it('fetches a single definition by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomFieldDefinition('cfd-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('cfd-1');
    expect(result.current.data?.data.label).toBe('Custom Notes');
  });

  it('does not fetch when id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomFieldDefinition(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Definition Mutation Tests ───────────────────────────────────────────────

describe('useCreateCustomFieldDefinition', () => {
  it('creates a new field definition', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateCustomFieldDefinition(), { wrapper });

    act(() => {
      result.current.mutate({
        entityType: 'mi',
        fieldKey: 'delivery_note',
        label: 'Delivery Note',
        fieldType: 'text',
        isRequired: false,
        showInGrid: false,
        sortOrder: 0,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('cfd-new');
    expect(result.current.data?.data.label).toBe('Delivery Note');
  });
});

describe('useUpdateCustomFieldDefinition', () => {
  it('updates an existing field definition', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCustomFieldDefinition(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'cfd-1', label: 'Updated Notes' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('cfd-1');
    expect(result.current.data?.data.label).toBe('Updated Notes');
  });
});

describe('useDeleteCustomFieldDefinition', () => {
  it('deletes a field definition (void return)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteCustomFieldDefinition(), { wrapper });

    act(() => {
      result.current.mutate('cfd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ── Values Tests ────────────────────────────────────────────────────────────

describe('useCustomFieldValues', () => {
  it('fetches custom field values for an entity', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomFieldValues('grn', 'grn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.custom_notes).toBe('Urgent delivery');
    expect(result.current.data?.data.priority_level).toBe('high');
  });

  it('does not fetch when entityId is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomFieldValues('grn', undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useSaveCustomFieldValues', () => {
  it('saves custom field values for an entity', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSaveCustomFieldValues(), { wrapper });

    act(() => {
      result.current.mutate({
        entityType: 'grn',
        entityId: 'grn-1',
        values: { custom_notes: 'Updated notes', priority_level: 'low' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.custom_notes).toBe('Updated notes');
    expect(result.current.data?.data.priority_level).toBe('low');
  });
});
