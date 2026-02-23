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

const mockAttachments = [
  {
    id: 'att-1',
    fileName: 'invoice.pdf',
    originalName: 'invoice.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    uploadedAt: '2026-02-01T10:00:00Z',
  },
  {
    id: 'att-2',
    fileName: 'photo.jpg',
    originalName: 'photo.jpg',
    fileSize: 2048,
    mimeType: 'image/jpeg',
    uploadedAt: '2026-02-02T10:00:00Z',
  },
];

beforeEach(() => {
  server.use(
    http.get(`${API}/attachments/:entityType/:recordId`, () =>
      HttpResponse.json({ success: true, data: mockAttachments }),
    ),
    http.delete(`${API}/attachments/:id`, () => new HttpResponse(null, { status: 204 })),
  );
});

describe('useAttachments', () => {
  it('fetches attachments for an entity', async () => {
    // Dynamic import to avoid vi.mock hoisting issues
    const { useAttachments } = await import('./useAttachments');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAttachments('grn', 'grn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].fileName).toBe('invoice.pdf');
  });
});

describe('useUploadAttachment', () => {
  it('uploads a file attachment via apiClient.post', async () => {
    // Mock apiClient.post to avoid jsdom FormData/XMLHttpRequest issues
    const clientModule = await import('../client');
    const postSpy = vi.spyOn(clientModule.apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'att-new',
          fileName: 'new-file.pdf',
          originalName: 'new-file.pdf',
          fileSize: 512,
          mimeType: 'application/pdf',
          uploadedAt: '2026-02-03T10:00:00Z',
        },
      },
    });

    const { useUploadAttachment } = await import('./useAttachments');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUploadAttachment(), { wrapper });

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.mutate({ entityType: 'grn', recordId: 'grn-1', file });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('att-new');

    postSpy.mockRestore();
  });
});

describe('useDeleteAttachment', () => {
  it('deletes an attachment', async () => {
    const { useDeleteAttachment } = await import('./useAttachments');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteAttachment(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'att-1', entityType: 'grn', recordId: 'grn-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
