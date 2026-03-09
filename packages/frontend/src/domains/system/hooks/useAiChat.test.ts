import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useAiConversations, useAiConversation, useAiChat, useDeleteAiConversation } from './useAiChat';

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
// CONVERSATIONS LIST
// ############################################################################

describe('useAiConversations', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/ai/conversations`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'conv-1',
              title: 'Inventory Query',
              createdAt: '2026-03-01T10:00:00Z',
              updatedAt: '2026-03-01T10:30:00Z',
              _count: { messages: 5 },
            },
            {
              id: 'conv-2',
              title: 'Supplier Analysis',
              createdAt: '2026-03-02T10:00:00Z',
              updatedAt: '2026-03-02T11:00:00Z',
              _count: { messages: 3 },
            },
          ],
        }),
      ),
    );
  });

  it('fetches AI conversation list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiConversations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].title).toBe('Inventory Query');
    expect(result.current.data!.data[0]._count?.messages).toBe(5);
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiConversations(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// CONVERSATION DETAIL
// ############################################################################

describe('useAiConversation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/ai/conversations/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            title: 'Inventory Query',
            createdAt: '2026-03-01T10:00:00Z',
            updatedAt: '2026-03-01T10:30:00Z',
            messages: [
              { id: 'msg-1', role: 'user', content: 'How much cement do we have?', createdAt: '2026-03-01T10:00:00Z' },
              { id: 'msg-2', role: 'assistant', content: '150 bags in WH-001', createdAt: '2026-03-01T10:00:05Z' },
            ],
          },
        }),
      ),
    );
  });

  it('fetches a single conversation with messages', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiConversation('conv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data.id).toBe('conv-1');
    expect(data.messages).toHaveLength(2);
    expect(data.messages[0].role).toBe('user');
    expect(data.messages[1].role).toBe('assistant');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiConversation(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CHAT (SEND MESSAGE)
// ############################################################################

describe('useAiChat', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/ai/chat`, async ({ request }) => {
        const body = (await request.json()) as { message: string; conversationId?: string };
        return HttpResponse.json({
          success: true,
          data: {
            conversationId: body.conversationId || 'conv-new',
            message: {
              id: 'msg-new',
              role: 'assistant',
              content: 'Here is the answer to your question.',
              createdAt: '2026-03-09T10:00:00Z',
            },
          },
        });
      }),
    );
  });

  it('sends a chat message and receives response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.mutate({ message: 'What is the stock level?' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data.conversationId).toBe('conv-new');
    expect(data.message.role).toBe('assistant');
    expect(data.message.content).toBe('Here is the answer to your question.');
  });

  it('sends a message to an existing conversation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.mutate({ conversationId: 'conv-1', message: 'Follow up question' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.conversationId).toBe('conv-1');
  });

  it('invalidates ai queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useAiChat(), { wrapper });

    act(() => {
      result.current.mutate({ message: 'Test' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['ai']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// DELETE CONVERSATION
// ############################################################################

describe('useDeleteAiConversation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(http.delete(`${API}/ai/conversations/:id`, () => HttpResponse.json({ success: true, data: null })));
  });

  it('deletes a conversation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteAiConversation(), { wrapper });

    act(() => {
      result.current.mutate('conv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('invalidates ai conversations queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useDeleteAiConversation(), { wrapper });

    act(() => {
      result.current.mutate('conv-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['ai', 'conversations']);

    invalidateSpy.mockRestore();
  });
});
