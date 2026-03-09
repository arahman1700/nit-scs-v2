import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import { useDocumentSignatures, useCreateSignature } from './useDigitalSignatures';

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
// DOCUMENT SIGNATURES (LIST)
// ############################################################################

describe('useDocumentSignatures', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/signatures`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'sig-1',
              documentType: 'mrrv',
              documentId: 'mrrv-1',
              signedById: 'emp-1',
              signatureData: 'base64data...',
              signedAt: '2026-03-01T10:00:00Z',
              ipAddress: '10.0.0.1',
              purpose: 'approval',
              notes: null,
              signedBy: {
                id: 'emp-1',
                fullName: 'Ahmed Admin',
                email: 'admin@nit.sa',
                department: 'admin',
                role: 'System Administrator',
              },
            },
            {
              id: 'sig-2',
              documentType: 'mrrv',
              documentId: 'mrrv-1',
              signedById: 'emp-2',
              signatureData: 'base64data2...',
              signedAt: '2026-03-01T11:00:00Z',
              ipAddress: '10.0.0.2',
              purpose: 'receipt',
              notes: 'Received in good condition',
              signedBy: {
                id: 'emp-2',
                fullName: 'Omar Receiver',
                email: 'omar@nit.sa',
                department: 'warehouse',
                role: 'Warehouse Staff',
              },
            },
          ],
        }),
      ),
    );
  });

  it('fetches signatures for a document', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentSignatures('mrrv', 'mrrv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data).toHaveLength(2);
    expect(data[0].purpose).toBe('approval');
    expect(data[0].signedBy.fullName).toBe('Ahmed Admin');
    expect(data[1].purpose).toBe('receipt');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentSignatures('mrrv', 'mrrv-1'), { wrapper });
    expect(result.current).toBeDefined();
  });

  it('does not fetch when documentType is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentSignatures(undefined, 'mrrv-1'), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch when documentId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentSignatures('mrrv', undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE SIGNATURE
// ############################################################################

describe('useCreateSignature', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/signatures`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            id: 'sig-new',
            ...(body as object),
            signedById: 'emp-1',
            signedAt: '2026-03-09T10:00:00Z',
            ipAddress: '10.0.0.1',
            signedBy: {
              id: 'emp-1',
              fullName: 'Ahmed Admin',
              email: 'admin@nit.sa',
              department: 'admin',
              role: 'System Administrator',
            },
          },
        });
      }),
    );
  });

  it('creates a new digital signature', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateSignature(), { wrapper });

    act(() => {
      result.current.mutate({
        documentType: 'mrrv',
        documentId: 'mrrv-1',
        signatureData: 'base64signaturedata...',
        purpose: 'approval',
        notes: 'Approved for receiving',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!.data;
    expect(data.id).toBe('sig-new');
    expect(data.documentType).toBe('mrrv');
    expect(data.purpose).toBe('approval');
  });

  it('creates a signature with delivery_confirmation purpose', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateSignature(), { wrapper });

    act(() => {
      result.current.mutate({
        documentType: 'mirv',
        documentId: 'mirv-1',
        signatureData: 'base64data...',
        purpose: 'delivery_confirmation',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.purpose).toBe('delivery_confirmation');
  });

  it('invalidates signatures queries with correct document params on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useCreateSignature(), { wrapper });

    act(() => {
      result.current.mutate({
        documentType: 'mrrv',
        documentId: 'mrrv-1',
        signatureData: 'base64data...',
        purpose: 'approval',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['signatures', 'mrrv', 'mrrv-1']);

    invalidateSpy.mockRestore();
  });

  it('creates a signature with inspection purpose', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateSignature(), { wrapper });

    act(() => {
      result.current.mutate({
        documentType: 'rfim',
        documentId: 'rfim-1',
        signatureData: 'base64data...',
        purpose: 'inspection',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.purpose).toBe('inspection');
  });
});
