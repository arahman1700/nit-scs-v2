import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';

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

const mockFields = {
  entity: 'items',
  fields: [
    { dbField: 'itemCode', label: 'Item Code', required: true },
    { dbField: 'itemDescription', label: 'Description', required: true },
    { dbField: 'category', label: 'Category', required: false },
  ],
};

const mockPreview = {
  headers: ['Code', 'Description', 'Category'],
  sampleRows: [{ Code: 'ITM-001', Description: 'Steel Pipe', Category: 'Metal' }],
  totalRows: 50,
  expectedFields: mockFields.fields,
};

const mockImportResult = {
  entity: 'items',
  total: 50,
  succeeded: 48,
  failed: 2,
  results: [
    { row: 12, success: false, error: 'Duplicate item code' },
    { row: 33, success: false, error: 'Missing required field' },
  ],
};

beforeEach(() => {
  server.use(
    http.get(`${API}/import/fields/:entity`, () => HttpResponse.json({ success: true, data: mockFields })),
    http.post(`${API}/import/execute`, () => HttpResponse.json({ success: true, data: mockImportResult })),
  );
});

describe('useImportFields', () => {
  it('fetches expected fields for an entity', async () => {
    const { useImportFields } = await import('./useImport');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useImportFields('items'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.entity).toBe('items');
    expect(result.current.data?.data.fields).toHaveLength(3);
    expect(result.current.data?.data.fields[0].dbField).toBe('itemCode');
  });
});

describe('useImportPreview', () => {
  it('uploads file and returns preview', async () => {
    // Mock apiClient.post for FormData to avoid jsdom XMLHttpRequest issues
    const clientModule = await import('../client');
    const postSpy = vi.spyOn(clientModule.apiClient, 'post').mockResolvedValueOnce({
      data: { success: true, data: mockPreview },
    });

    const { useImportPreview } = await import('./useImport');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useImportPreview(), { wrapper });

    const file = new File(['col1,col2'], 'data.csv', { type: 'text/csv' });

    act(() => {
      result.current.mutate({ file, entity: 'items' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.totalRows).toBe(50);
    expect(result.current.data?.data.headers).toHaveLength(3);

    postSpy.mockRestore();
  });
});

describe('useImportExecute', () => {
  it('executes import with mapping and returns results', async () => {
    const { useImportExecute } = await import('./useImport');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useImportExecute(), { wrapper });

    act(() => {
      result.current.mutate({
        entity: 'items',
        mapping: { Code: 'itemCode', Description: 'itemDescription' },
        rows: [{ Code: 'ITM-001', Description: 'Steel Pipe' }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.succeeded).toBe(48);
    expect(result.current.data?.data.failed).toBe(2);
    expect(result.current.data?.data.results).toHaveLength(2);
  });
});
