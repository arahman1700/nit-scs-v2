import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

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

// Mock apiClient to avoid FormData + jsdom XMLHttpRequest issues
vi.mock('../client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from '../client';
import { useUpload } from './useUpload';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useUpload', () => {
  it('uploads a file and returns upload response', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: { url: '/uploads/file-123.pdf', originalName: 'report.pdf', size: 2048, mimeType: 'application/pdf' },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpload(), { wrapper });

    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.mutate(file);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.url).toBe('/uploads/file-123.pdf');
    expect(result.current.data?.originalName).toBe('report.pdf');
    expect(result.current.data?.size).toBe(2048);
    expect(result.current.data?.mimeType).toBe('application/pdf');
  });
});
