import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/msw-server';
import {
  useEquipmentDeliveryNoteList,
  useEquipmentDeliveryNote,
  useCreateEquipmentDeliveryNote,
  useUpdateEquipmentDeliveryNote,
  useConfirmEquipmentDeliveryNote,
  useCancelEquipmentDeliveryNote,
  useEquipmentReturnNoteList,
  useEquipmentReturnNote,
  useCreateEquipmentReturnNote,
  useUpdateEquipmentReturnNote,
  useInspectEquipmentReturnNote,
  useConfirmEquipmentReturnNote,
  useDisputeEquipmentReturnNote,
} from './useEquipmentNotes';

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
// DELIVERY NOTE LIST
// ############################################################################

describe('useEquipmentDeliveryNoteList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/equipment-notes/delivery`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 'dn-1', noteNumber: 'DN-001', status: 'draft' },
            { id: 'dn-2', noteNumber: 'DN-002', status: 'confirmed' },
          ],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches delivery note list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEquipmentDeliveryNoteList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.data).toHaveLength(2);
    expect(result.current.data!.data[0].noteNumber).toBe('DN-001');
  });

  it('renders without crashing', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEquipmentDeliveryNoteList(), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ############################################################################
// DELIVERY NOTE DETAIL
// ############################################################################

describe('useEquipmentDeliveryNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/equipment-notes/delivery/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: { id: params.id, noteNumber: 'DN-001', status: 'draft' },
        }),
      ),
    );
  });

  it('fetches a single delivery note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEquipmentDeliveryNote('dn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('dn-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEquipmentDeliveryNote(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE DELIVERY NOTE
// ############################################################################

describe('useCreateEquipmentDeliveryNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/equipment-notes/delivery`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'dn-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new delivery note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateEquipmentDeliveryNote(), { wrapper });

    act(() => {
      result.current.mutate({ equipmentId: 'eq-1', destination: 'Warehouse A' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('dn-new');
  });
});

// ############################################################################
// UPDATE DELIVERY NOTE
// ############################################################################

describe('useUpdateEquipmentDeliveryNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/equipment-notes/delivery/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a delivery note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateEquipmentDeliveryNote(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'dn-1', destination: 'Updated Destination' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('dn-1');
  });
});

// ############################################################################
// CONFIRM DELIVERY NOTE
// ############################################################################

describe('useConfirmEquipmentDeliveryNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/equipment-notes/delivery/:id/confirm`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'confirmed' } }),
      ),
    );
  });

  it('confirms a delivery note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useConfirmEquipmentDeliveryNote(), { wrapper });

    act(() => {
      result.current.mutate('dn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('confirmed');
  });
});

// ############################################################################
// CANCEL DELIVERY NOTE
// ############################################################################

describe('useCancelEquipmentDeliveryNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/equipment-notes/delivery/:id/cancel`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'cancelled' } }),
      ),
    );
  });

  it('cancels a delivery note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCancelEquipmentDeliveryNote(), { wrapper });

    act(() => {
      result.current.mutate('dn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('cancelled');
  });
});

// ############################################################################
// RETURN NOTE LIST
// ############################################################################

describe('useEquipmentReturnNoteList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/equipment-notes/return`, () =>
        HttpResponse.json({
          success: true,
          data: [{ id: 'rn-1', noteNumber: 'RN-001', status: 'draft' }],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      ),
    );
  });

  it('fetches return note list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEquipmentReturnNoteList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toHaveLength(1);
  });
});

// ############################################################################
// RETURN NOTE DETAIL
// ############################################################################

describe('useEquipmentReturnNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/equipment-notes/return/:id`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, noteNumber: 'RN-001', status: 'draft' } }),
      ),
    );
  });

  it('fetches a single return note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEquipmentReturnNote('rn-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('rn-1');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEquipmentReturnNote(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isFetching).toBe(false);
  });
});

// ############################################################################
// CREATE RETURN NOTE
// ############################################################################

describe('useCreateEquipmentReturnNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/equipment-notes/return`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: 'rn-new', ...(body as object) } });
      }),
    );
  });

  it('creates a new return note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateEquipmentReturnNote(), { wrapper });

    act(() => {
      result.current.mutate({ equipmentId: 'eq-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('rn-new');
  });
});

// ############################################################################
// UPDATE RETURN NOTE
// ############################################################################

describe('useUpdateEquipmentReturnNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/equipment-notes/return/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: { id: params.id, ...(body as object) } });
      }),
    );
  });

  it('updates a return note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateEquipmentReturnNote(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rn-1', condition: 'good' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.id).toBe('rn-1');
  });
});

// ############################################################################
// INSPECT RETURN NOTE
// ############################################################################

describe('useInspectEquipmentReturnNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/equipment-notes/return/:id/inspect`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'inspected' } }),
      ),
    );
  });

  it('inspects a return note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInspectEquipmentReturnNote(), { wrapper });

    act(() => {
      result.current.mutate('rn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('inspected');
  });
});

// ############################################################################
// CONFIRM RETURN NOTE
// ############################################################################

describe('useConfirmEquipmentReturnNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/equipment-notes/return/:id/confirm`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'confirmed' } }),
      ),
    );
  });

  it('confirms a return note', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useConfirmEquipmentReturnNote(), { wrapper });

    act(() => {
      result.current.mutate('rn-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('confirmed');
  });
});

// ############################################################################
// DISPUTE RETURN NOTE
// ############################################################################

describe('useDisputeEquipmentReturnNote', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/equipment-notes/return/:id/dispute`, ({ params }) =>
        HttpResponse.json({ success: true, data: { id: params.id, status: 'disputed' } }),
      ),
    );
  });

  it('disputes a return note with reason', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDisputeEquipmentReturnNote(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'rn-1', reason: 'Equipment damaged' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.status).toBe('disputed');
  });
});
