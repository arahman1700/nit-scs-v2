import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useExpiringLots } from './useExpiryAlerts';

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
// EXPIRING LOTS
// ############################################################################

describe('useExpiringLots', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/inventory/expiring`, () =>
        HttpResponse.json({
          data: [
            {
              item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'Cement', category: 'Building' },
              lots: [
                {
                  id: 'lot-1',
                  lotNumber: 'LOT-001',
                  expiryDate: '2026-04-01',
                  availableQty: 50,
                  binLocation: 'A-01',
                  warehouse: { id: 'wh-1', warehouseName: 'Main', warehouseCode: 'WH-001' },
                },
              ],
              totalQty: 50,
            },
            {
              item: { id: 'item-2', itemCode: 'ITM-002', itemDescription: 'Paint', category: 'Finishing' },
              lots: [
                {
                  id: 'lot-2',
                  lotNumber: 'LOT-002',
                  expiryDate: '2026-03-20',
                  availableQty: 20,
                  binLocation: 'B-05',
                  warehouse: { id: 'wh-1', warehouseName: 'Main', warehouseCode: 'WH-001' },
                },
              ],
              totalQty: 20,
            },
          ],
          meta: { daysAhead: 30, totalItems: 2, totalLots: 2, asOf: '2026-03-09T00:00:00Z' },
        }),
      ),
    );
  });

  it('fetches expiring lots data', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExpiringLots(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.data).toHaveLength(2);
    expect(data.meta.totalItems).toBe(2);
    expect(data.meta.totalLots).toBe(2);
    expect(data.data[0].item.itemCode).toBe('ITM-001');
    expect(data.data[0].lots[0].lotNumber).toBe('LOT-001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExpiringLots(), { wrapper });
    expect(result.current).toBeDefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('accepts optional daysAhead parameter', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExpiringLots(60), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });

  it('fetches with default daysAhead when not provided', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExpiringLots(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.meta.daysAhead).toBe(30);
  });

  it('returns lot details including warehouse info', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExpiringLots(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstLot = result.current.data!.data[0].lots[0];
    expect(firstLot.warehouse.warehouseCode).toBe('WH-001');
    expect(firstLot.binLocation).toBe('A-01');
    expect(firstLot.availableQty).toBe(50);
  });

  it('returns totalQty for each item group', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useExpiringLots(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data[0].totalQty).toBe(50);
    expect(result.current.data!.data[1].totalQty).toBe(20);
  });
});
