import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useAssetList,
  useAsset,
  useAssetSummary,
  useCreateAsset,
  useUpdateAsset,
  useTransferAsset,
  useRetireAsset,
  useDisposeAsset,
} from './useAssets';

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
// LIST
// ############################################################################

describe('useAssetList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/assets`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'asset-1', name: 'Forklift', status: 'active' },
            { id: 'asset-2', name: 'Crane', status: 'maintenance' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches asset list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAssetList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].name).toBe('Forklift');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAssetList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useAsset', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/assets/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, name: 'Forklift', status: 'active' },
        }),
      ),
    );
  });

  it('fetches a single asset by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsset('asset-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('asset-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsset(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// SUMMARY
// ############################################################################

describe('useAssetSummary', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/assets/summary`, () =>
        HttpResponse.json({
          success: true,
          data: { totalAssets: 150, activeAssets: 120, retiredAssets: 20, disposedAssets: 10 },
        }),
      ),
    );
  });

  it('fetches asset summary stats', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAssetSummary(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.totalAssets).toBe(150);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateAsset', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/assets`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'asset-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new asset', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateAsset(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'New Forklift', serialNumber: 'FL-001' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('asset-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateAsset', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/assets/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates an existing asset', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateAsset(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'asset-1', name: 'Updated Forklift' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('asset-1');
  });
});

// ############################################################################
// TRANSFER
// ############################################################################

describe('useTransferAsset', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/assets/:id/transfer`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'transferred' },
        }),
      ),
    );
  });

  it('transfers an asset', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTransferAsset(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'asset-1', toWarehouseId: 'wh-2', reason: 'Relocation' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('transferred');
  });
});

// ############################################################################
// RETIRE
// ############################################################################

describe('useRetireAsset', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/assets/:id/retire`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'retired' },
        }),
      ),
    );
  });

  it('retires an asset', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRetireAsset(), { wrapper });

    act(() => {
      result.current.mutate('asset-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('retired');
  });
});

// ############################################################################
// DISPOSE
// ############################################################################

describe('useDisposeAsset', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/assets/:id/dispose`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, status: 'disposed' },
        }),
      ),
    );
  });

  it('disposes an asset with disposal value', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDisposeAsset(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'asset-1', disposalValue: 5000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('disposed');
  });
});
