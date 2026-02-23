import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  usePutAwayRules,
  usePutAwayRule,
  useCreatePutAwayRule,
  useUpdatePutAwayRule,
  useDeletePutAwayRule,
  usePutAwaySuggestion,
} from './usePutAwayRules';

const API = '/api/v1';

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

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockRule = {
  id: 'par-1',
  name: 'Heavy items → Zone A',
  priority: 1,
  warehouseId: 'wh-1',
  targetZoneId: 'z-1',
  itemCategory: 'heavy',
  isHazardous: false,
  maxWeight: 500,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockSuggestion = {
  zoneId: 'z-1',
  zoneName: 'Zone A',
  zoneCode: 'ZA',
  reason: 'Heavy items rule match',
  confidence: 'high',
};

// ############################################################################
// LIST
// ############################################################################

describe('usePutAwayRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.get(`${API}/putaway-rules`, () => HttpResponse.json({ success: true, data: [mockRule] })));
  });

  it('fetches put-away rules list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePutAwayRules('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].id).toBe('par-1');
    expect(data.data[0].name).toBe('Heavy items → Zone A');
    expect(data.data[0].priority).toBe(1);
    expect(data.data[0].warehouseId).toBe('wh-1');
    expect(data.data[0].isActive).toBe(true);
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('usePutAwayRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/putaway-rules/:id`, ({ params }) =>
        HttpResponse.json({ success: true, data: { ...mockRule, id: params.id } }),
      ),
    );
  });

  it('fetches a single put-away rule by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePutAwayRule('par-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('par-1');
    expect(data.data.name).toBe('Heavy items → Zone A');
    expect(data.data.targetZoneId).toBe('z-1');
    expect(data.data.maxWeight).toBe(500);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreatePutAwayRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/putaway-rules`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'par-new', ...(body as object) },
        });
      }),
    );
  });

  it('creates a new put-away rule', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreatePutAwayRule(), { wrapper });

    act(() => {
      result.current.mutate({
        name: 'Fragile → Zone B',
        priority: 2,
        warehouseId: 'wh-1',
        targetZoneId: 'z-2',
        itemCategory: 'fragile',
        isHazardous: false,
        isActive: true,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('par-new');
    expect(data.data.name).toBe('Fragile → Zone B');
    expect(data.data.priority).toBe(2);
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdatePutAwayRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/putaway-rules/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object) },
        });
      }),
    );
  });

  it('updates an existing put-away rule', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdatePutAwayRule(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'par-1', name: 'Updated rule', priority: 5 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('par-1');
    expect(data.data.name).toBe('Updated rule');
    expect(data.data.priority).toBe(5);
  });
});

// ############################################################################
// DELETE
// ############################################################################

describe('useDeletePutAwayRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.delete(`${API}/putaway-rules/:id`, () => new HttpResponse(null, { status: 204 })));
  });

  it('deletes a put-away rule', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeletePutAwayRule(), { wrapper });

    act(() => {
      result.current.mutate('par-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ############################################################################
// SUGGESTIONS
// ############################################################################

describe('usePutAwaySuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/putaway-rules/suggest`, () => HttpResponse.json({ success: true, data: [mockSuggestion] })),
    );
  });

  it('fetches put-away suggestions for an item and warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePutAwaySuggestion('item-1', 'wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].zoneId).toBe('z-1');
    expect(data.data[0].zoneName).toBe('Zone A');
    expect(data.data[0].reason).toBe('Heavy items rule match');
    expect(data.data[0].confidence).toBe('high');
  });
});
