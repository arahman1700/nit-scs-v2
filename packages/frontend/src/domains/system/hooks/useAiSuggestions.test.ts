import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useAiSuggestions, useDismissSuggestion, useApplySuggestion, useTriggerAnalysis } from './useAiSuggestions';

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
// LIST SUGGESTIONS
// ############################################################################

describe('useAiSuggestions', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/ai/suggestions`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'sug-1',
              suggestionType: 'reorder',
              priority: 1,
              title: 'Reorder Cement',
              description: 'Stock below threshold',
              status: 'pending',
              createdAt: '2026-03-01T10:00:00Z',
            },
            {
              id: 'sug-2',
              suggestionType: 'optimization',
              priority: 2,
              title: 'Optimize Warehouse Layout',
              description: 'Based on pick frequency',
              status: 'pending',
              createdAt: '2026-03-02T10:00:00Z',
            },
          ],
        }),
      ),
    );
  });

  it('fetches AI suggestions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiSuggestions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].title).toBe('Reorder Cement');
    expect(result.current.data!.data[0].priority).toBe(1);
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiSuggestions(), { wrapper });
    expect(result.current).toBeDefined();
  });

  it('accepts optional status filter', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiSuggestions('pending'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// DISMISS SUGGESTION
// ############################################################################

describe('useDismissSuggestion', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/ai/suggestions/:id/dismiss`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'dismissed' },
        }),
      ),
    );
  });

  it('dismisses a suggestion', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDismissSuggestion(), { wrapper });

    act(() => {
      result.current.mutate('sug-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('dismissed');
  });

  it('invalidates ai suggestions queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useDismissSuggestion(), { wrapper });

    act(() => {
      result.current.mutate('sug-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['ai', 'suggestions']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// APPLY SUGGESTION
// ############################################################################

describe('useApplySuggestion', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/ai/suggestions/:id/apply`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'applied' },
        }),
      ),
    );
  });

  it('applies a suggestion', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApplySuggestion(), { wrapper });

    act(() => {
      result.current.mutate('sug-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('applied');
  });
});

// ############################################################################
// TRIGGER ANALYSIS
// ############################################################################

describe('useTriggerAnalysis', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/ai/suggestions/analyze`, () =>
        HttpResponse.json({
          success: true,
          data: { created: 5 },
        }),
      ),
    );
  });

  it('triggers AI analysis and returns count of created suggestions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTriggerAnalysis(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.created).toBe(5);
  });

  it('invalidates ai suggestions queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useTriggerAnalysis(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['ai', 'suggestions']);

    invalidateSpy.mockRestore();
  });
});
