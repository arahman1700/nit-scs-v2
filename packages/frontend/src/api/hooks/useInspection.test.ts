import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useAqlCalculation,
  useAqlTable,
  useChecklistList,
  useChecklist,
  useCreateChecklist,
  useUpdateChecklist,
  useDeleteChecklist,
  useAddChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useReorderChecklistItems,
} from './useInspection';

const API = '/api/v1';

// Ensure localStorage works in the jsdom environment
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
// AQL CALCULATION
// ############################################################################

describe('useAqlCalculation', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/inspections/aql/calculate`, () =>
        HttpResponse.json({
          success: true,
          data: {
            lotSize: 500,
            inspectionLevel: 'II',
            aqlPercent: 1.5,
            sampleSize: 50,
            acceptNumber: 1,
            rejectNumber: 2,
          },
        }),
      ),
    );
  });

  it('fetches AQL calculation when lotSize and aql are provided', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAqlCalculation(500, 'II', 1.5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.lotSize).toBe(500);
    expect(data.data.inspectionLevel).toBe('II');
    expect(data.data.aqlPercent).toBe(1.5);
    expect(data.data.sampleSize).toBe(50);
    expect(data.data.acceptNumber).toBe(1);
    expect(data.data.rejectNumber).toBe(2);
  });

  it('does not fetch when lotSize is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAqlCalculation(undefined, 'II', 1.5), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch when aql is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAqlCalculation(500, 'II', undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// AQL TABLE
// ############################################################################

describe('useAqlTable', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/inspections/aql/table`, () =>
        HttpResponse.json({
          success: true,
          data: {
            rows: [
              {
                lotSizeMin: 2,
                lotSizeMax: 8,
                lotSizeLabel: '2 to 8',
                sampleSizeLevelI: 2,
                sampleSizeLevelII: 2,
                sampleSizeLevelIII: 3,
              },
              {
                lotSizeMin: 9,
                lotSizeMax: 15,
                lotSizeLabel: '9 to 15',
                sampleSizeLevelI: 2,
                sampleSizeLevelII: 3,
                sampleSizeLevelIII: 5,
              },
            ],
            aqlValues: [0.065, 0.1, 0.15, 0.25, 0.4, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5],
          },
        }),
      ),
    );
  });

  it('fetches AQL table (always enabled, staleTime Infinity)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAqlTable(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.rows).toBeInstanceOf(Array);
    expect(data.data.rows.length).toBe(2);
    expect(data.data.rows[0].lotSizeMin).toBe(2);
    expect(data.data.rows[0].lotSizeMax).toBe(8);
    expect(data.data.aqlValues).toBeInstanceOf(Array);
    expect(data.data.aqlValues.length).toBe(11);
  });
});

// ############################################################################
// CHECKLIST LIST
// ############################################################################

describe('useChecklistList', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/inspections/checklists`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 'cl-1',
              name: 'Incoming Inspection',
              category: 'receiving',
              isActive: true,
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
              _count: { items: 5 },
            },
            {
              id: 'cl-2',
              name: 'Quality Audit',
              category: 'quality',
              isActive: true,
              createdAt: '2026-01-16T10:00:00Z',
              updatedAt: '2026-01-16T10:00:00Z',
              _count: { items: 8 },
            },
          ],
        }),
      ),
    );
  });

  it('fetches checklist list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChecklistList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(2);
    expect(data.data[0].id).toBe('cl-1');
    expect(data.data[0].name).toBe('Incoming Inspection');
    expect(data.data[0].category).toBe('receiving');
    expect(data.data[1].id).toBe('cl-2');
    expect(data.data[1].name).toBe('Quality Audit');
  });

  it('accepts optional filter params', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChecklistList({ category: 'receiving', isActive: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data).toBeInstanceOf(Array);
  });
});

// ############################################################################
// CHECKLIST DETAIL
// ############################################################################

describe('useChecklist', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/inspections/checklists/:id`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            name: 'Incoming Inspection',
            category: 'receiving',
            isActive: true,
            createdAt: '2026-01-15T10:00:00Z',
            updatedAt: '2026-01-15T10:00:00Z',
            items: [
              {
                id: 'item-1',
                checklistId: params.id,
                itemOrder: 1,
                description: 'Check packaging',
                isMandatory: true,
                inspectionType: 'visual',
              },
            ],
          },
        }),
      ),
    );
  });

  it('fetches a single checklist by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChecklist('cl-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cl-1');
    expect(data.data.name).toBe('Incoming Inspection');
    expect(data.data.items).toBeInstanceOf(Array);
    expect(data.data.items!.length).toBe(1);
    expect(data.data.items![0].description).toBe('Check packaging');
  });

  it('does not fetch when id is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useChecklist(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// CREATE CHECKLIST
// ############################################################################

describe('useCreateChecklist', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/inspections/checklists`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            id: 'cl-new',
            ...(body as object),
            createdAt: '2026-02-23T10:00:00Z',
            updatedAt: '2026-02-23T10:00:00Z',
          },
        });
      }),
    );
  });

  it('creates a new checklist', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateChecklist(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'New Checklist', category: 'receiving', isActive: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cl-new');
    expect(data.data.name).toBe('New Checklist');
    expect(data.data.category).toBe('receiving');
  });
});

// ############################################################################
// UPDATE CHECKLIST
// ############################################################################

describe('useUpdateChecklist', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/inspections/checklists/:id`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.id, ...(body as object), updatedAt: '2026-02-23T11:00:00Z' },
        });
      }),
    );
  });

  it('updates an existing checklist', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateChecklist(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'cl-1', name: 'Updated Checklist', isActive: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('cl-1');
    expect(data.data.name).toBe('Updated Checklist');
    expect(data.data.isActive).toBe(false);
  });
});

// ############################################################################
// DELETE CHECKLIST
// ############################################################################

describe('useDeleteChecklist', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(http.delete(`${API}/inspections/checklists/:id`, () => new HttpResponse(null, { status: 204 })));
  });

  it('deletes a checklist by id', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteChecklist(), { wrapper });

    act(() => {
      result.current.mutate('cl-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('invalidates checklist queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useDeleteChecklist(), { wrapper });

    act(() => {
      result.current.mutate('cl-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['inspections', 'checklists']);

    invalidateSpy.mockRestore();
  });
});

// ############################################################################
// ADD CHECKLIST ITEM
// ############################################################################

describe('useAddChecklistItem', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/inspections/checklists/:checklistId/items`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'item-new', checklistId: params.checklistId, ...(body as object) },
        });
      }),
    );
  });

  it('adds an item to a checklist', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddChecklistItem(), { wrapper });

    act(() => {
      result.current.mutate({
        checklistId: 'cl-1',
        description: 'Check labels',
        itemOrder: 2,
        isMandatory: true,
        inspectionType: 'visual',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('item-new');
    expect(data.data.checklistId).toBe('cl-1');
    expect(data.data.description).toBe('Check labels');
    expect(data.data.itemOrder).toBe(2);
    expect(data.data.isMandatory).toBe(true);
  });
});

// ############################################################################
// UPDATE CHECKLIST ITEM
// ############################################################################

describe('useUpdateChecklistItem', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.put(`${API}/inspections/checklists/:checklistId/items/:itemId`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: params.itemId, checklistId: params.checklistId, ...(body as object) },
        });
      }),
    );
  });

  it('updates a checklist item', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateChecklistItem(), { wrapper });

    act(() => {
      result.current.mutate({
        checklistId: 'cl-1',
        itemId: 'item-1',
        description: 'Updated description',
        isMandatory: false,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('item-1');
    expect(data.data.checklistId).toBe('cl-1');
    expect(data.data.description).toBe('Updated description');
    expect(data.data.isMandatory).toBe(false);
  });
});

// ############################################################################
// DELETE CHECKLIST ITEM
// ############################################################################

describe('useDeleteChecklistItem', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.delete(
        `${API}/inspections/checklists/:checklistId/items/:itemId`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
  });

  it('deletes a checklist item', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteChecklistItem(), { wrapper });

    act(() => {
      result.current.mutate({ checklistId: 'cl-1', itemId: 'item-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ############################################################################
// REORDER CHECKLIST ITEMS
// ############################################################################

describe('useReorderChecklistItems', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/inspections/checklists/:checklistId/items/reorder`, async ({ request, params }) => {
        const body = (await request.json()) as { itemIds: string[] };
        return HttpResponse.json({
          success: true,
          data: body.itemIds.map((itemId, idx) => ({
            id: itemId,
            checklistId: params.checklistId,
            itemOrder: idx + 1,
            description: `Item ${idx + 1}`,
            isMandatory: true,
            inspectionType: 'visual',
          })),
        });
      }),
    );
  });

  it('reorders checklist items and returns updated list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReorderChecklistItems(), { wrapper });

    act(() => {
      result.current.mutate({ checklistId: 'cl-1', itemIds: ['item-3', 'item-1', 'item-2'] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(3);
    expect(data.data[0].id).toBe('item-3');
    expect(data.data[0].itemOrder).toBe(1);
    expect(data.data[1].id).toBe('item-1');
    expect(data.data[1].itemOrder).toBe(2);
    expect(data.data[2].id).toBe('item-2');
    expect(data.data[2].itemOrder).toBe(3);
  });
});
