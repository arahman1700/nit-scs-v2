import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useCustomsDocumentList,
  useCustomsDocument,
  useCreateCustomsDocument,
  useUpdateCustomsDocument,
  useVerifyCustomsDocument,
  useRejectCustomsDocument,
  useDocumentCompleteness,
} from './useCustomsDocuments';

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

describe('useCustomsDocumentList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/customs-documents`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'cd-1', documentType: 'bill_of_lading', documentNumber: 'BL-001', status: 'pending' },
            { id: 'cd-2', documentType: 'certificate_of_origin', documentNumber: 'CO-001', status: 'verified' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches customs document list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomsDocumentList({ shipmentId: 'ship-1' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].documentType).toBe('bill_of_lading');
  });

  it('does not fetch when shipmentId is empty', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomsDocumentList({ shipmentId: '' }), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomsDocumentList({ shipmentId: 'ship-1' }), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DETAIL
// ############################################################################

describe('useCustomsDocument', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/customs-documents/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, documentType: 'bill_of_lading', status: 'pending' },
        }),
      ),
    );
  });

  it('fetches a single customs document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomsDocument('cd-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('cd-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCustomsDocument(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE
// ############################################################################

describe('useCreateCustomsDocument', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/customs-documents`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'cd-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new customs document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateCustomsDocument(), { wrapper });

    act(() => {
      result.current.mutate({ shipmentId: 'ship-1', documentType: 'invoice', documentNumber: 'INV-001' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('cd-new');
  });
});

// ############################################################################
// UPDATE
// ############################################################################

describe('useUpdateCustomsDocument', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/customs-documents/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a customs document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCustomsDocument(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'cd-1', notes: 'Updated notes' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('cd-1');
  });
});

// ############################################################################
// VERIFY
// ############################################################################

describe('useVerifyCustomsDocument', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/customs-documents/:id/verify`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'verified' } }),
      ),
    );
  });

  it('verifies a customs document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVerifyCustomsDocument(), { wrapper });

    act(() => {
      result.current.mutate('cd-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('verified');
  });
});

// ############################################################################
// REJECT
// ############################################################################

describe('useRejectCustomsDocument', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/customs-documents/:id/reject`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'rejected' } }),
      ),
    );
  });

  it('rejects a customs document with reason', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRejectCustomsDocument(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'cd-1', reason: 'Expired document' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('rejected');
  });
});

// ############################################################################
// DOCUMENT COMPLETENESS
// ############################################################################

describe('useDocumentCompleteness', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/customs-documents/completeness/:shipmentId`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            shipmentId: params.shipmentId,
            total: 5,
            verified: 3,
            pending: 1,
            received: 1,
            rejected: 0,
            isComplete: false,
            requiredDocuments: [{ type: 'bill_of_lading', label: 'Bill of Lading', present: true, status: 'verified' }],
          },
        }),
      ),
    );
  });

  it('fetches document completeness for a shipment', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentCompleteness('ship-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data.total).toBe(5);
    expect(result.current.data!.data.verified).toBe(3);
    expect(result.current.data!.data.isComplete).toBe(false);
  });

  it('does not fetch when shipmentId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentCompleteness(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});
