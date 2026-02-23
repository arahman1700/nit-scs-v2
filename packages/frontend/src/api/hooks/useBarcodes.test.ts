import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import { useBarcodeLookup, usePrintLabels, useGrnLabels, useBinQrLabels, useBinLookup } from './useBarcodes';

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

const mockLookupResult = { itemId: 'item-1', itemCode: 'ITM-001', itemDescription: 'Steel Pipe', lotId: 'lot-1' };
const mockBinResult = { binCardId: 'bin-1', binCode: 'A-01-01', warehouseId: 'wh-1', zoneId: 'zone-1' };

beforeEach(() => {
  server.use(
    http.get(`${API}/barcodes/lookup/:code`, () => HttpResponse.json({ success: true, data: mockLookupResult })),
    http.post(`${API}/barcodes/print-labels`, () => HttpResponse.text('<svg>label</svg>')),
    http.post(`${API}/barcodes/print-labels/grn/:grnId`, () => HttpResponse.text('<svg>grn-label</svg>')),
    http.post(`${API}/barcodes/print-labels/bins`, () => HttpResponse.text('<svg>bin-label</svg>')),
    http.get(`${API}/barcodes/lookup/bin/:code`, () => HttpResponse.json({ success: true, data: mockBinResult })),
  );
});

describe('useBarcodeLookup', () => {
  it('looks up an item by barcode', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBarcodeLookup('ITM-001'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.itemCode).toBe('ITM-001');
    expect(result.current.data?.data.itemDescription).toBe('Steel Pipe');
  });
});

describe('usePrintLabels', () => {
  it('prints item labels and returns SVG text', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePrintLabels(), { wrapper });

    act(() => {
      result.current.mutate(['item-1', 'item-2']);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toContain('<svg>');
  });
});

describe('useGrnLabels', () => {
  it('prints GRN labels and returns SVG text', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGrnLabels(), { wrapper });

    act(() => {
      result.current.mutate('grn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toContain('<svg>');
  });
});

describe('useBinQrLabels', () => {
  it('prints bin QR labels and returns SVG text', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBinQrLabels(), { wrapper });

    act(() => {
      result.current.mutate({ warehouseId: 'wh-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toContain('<svg>');
  });
});

describe('useBinLookup', () => {
  it('looks up a bin by scanned QR code', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBinLookup('A-01-01'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.binCode).toBe('A-01-01');
    expect(result.current.data?.data.warehouseId).toBe('wh-1');
  });
});
