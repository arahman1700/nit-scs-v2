import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useBinCardList,
  useBinCard,
  useCreateBinCard,
  useUpdateBinCard,
  useBinCardTransactionList,
  useCreateBinCardTransaction,
} from './useBinCards';

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

const mockBinCards = [
  {
    id: 'bc-1',
    itemId: 'item-1',
    warehouseId: 'wh-1',
    binLocation: 'A-01-01',
    currentQty: 100,
    minQty: 10,
    maxQty: 500,
  },
  {
    id: 'bc-2',
    itemId: 'item-2',
    warehouseId: 'wh-1',
    binLocation: 'A-01-02',
    currentQty: 50,
    minQty: 5,
    maxQty: 200,
  },
];

const mockTransactions = [
  {
    id: 'bct-1',
    binCardId: 'bc-1',
    transactionType: 'receipt',
    qty: 25,
    referenceDoc: 'GRN-2026-00001',
    createdAt: '2026-02-10T10:00:00Z',
  },
  {
    id: 'bct-2',
    binCardId: 'bc-1',
    transactionType: 'issue',
    qty: -10,
    referenceDoc: 'MI-2026-00001',
    createdAt: '2026-02-12T10:00:00Z',
  },
];

// ── Setup MSW Handlers ──────────────────────────────────────────────────────

beforeEach(() => {
  server.use(
    // Transaction endpoints must be registered BEFORE the parameterized :id route
    http.get(`${API}/bin-cards/transactions`, () => HttpResponse.json({ success: true, data: mockTransactions })),
    http.post(`${API}/bin-cards/transactions`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'bct-new', ...(body as object) } });
    }),
    http.get(`${API}/bin-cards`, () => HttpResponse.json({ success: true, data: mockBinCards })),
    http.get(`${API}/bin-cards/:id`, ({ params }) =>
      HttpResponse.json({ success: true, data: { ...mockBinCards[0], id: params.id } }),
    ),
    http.post(`${API}/bin-cards`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: 'bc-new', ...(body as object) } });
    }),
    http.put(`${API}/bin-cards/:id`, async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
    }),
  );
});

// ── Query Tests ─────────────────────────────────────────────────────────────

describe('useBinCardList', () => {
  it('fetches the list of bin cards', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBinCardList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].binLocation).toBe('A-01-01');
    expect(result.current.data?.data[1].currentQty).toBe(50);
  });
});

describe('useBinCard', () => {
  it('fetches a single bin card by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBinCard('bc-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.id).toBe('bc-1');
    expect(result.current.data?.data.binLocation).toBe('A-01-01');
    expect(result.current.data?.data.currentQty).toBe(100);
  });

  it('does not fetch when id is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBinCard(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── Mutation Tests ──────────────────────────────────────────────────────────

describe('useCreateBinCard', () => {
  it('creates a new bin card', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateBinCard(), { wrapper });

    act(() => {
      result.current.mutate({
        itemId: 'item-3',
        warehouseId: 'wh-1',
        binLocation: 'B-02-01',
        currentQty: 0,
        minQty: 20,
        maxQty: 300,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('bc-new');
    expect(result.current.data?.data.binLocation).toBe('B-02-01');
  });
});

describe('useUpdateBinCard', () => {
  it('updates an existing bin card', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateBinCard(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'bc-1', minQty: 15, maxQty: 600 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('bc-1');
    expect(result.current.data?.data.minQty).toBe(15);
    expect(result.current.data?.data.maxQty).toBe(600);
  });
});

// ── Transaction Tests ───────────────────────────────────────────────────────

describe('useBinCardTransactionList', () => {
  it('fetches the list of bin card transactions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBinCardTransactionList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].transactionType).toBe('receipt');
    expect(result.current.data?.data[1].qty).toBe(-10);
  });
});

describe('useCreateBinCardTransaction', () => {
  it('creates a new bin card transaction', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateBinCardTransaction(), { wrapper });

    act(() => {
      result.current.mutate({
        binCardId: 'bc-1',
        transactionType: 'receipt',
        qty: 50,
        referenceDoc: 'GRN-2026-00010',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.id).toBe('bct-new');
    expect(result.current.data?.data.qty).toBe(50);
    expect(result.current.data?.data.referenceDoc).toBe('GRN-2026-00010');
  });
});
