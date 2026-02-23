import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw-server';
import {
  useSlottingAnalysis,
  usePickFrequencies,
  useCoLocation,
  useSeasonalTrends,
  useAiSlottingSummary,
  useApplySlotting,
} from './useSlotting';

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

const mockAnalysis = {
  warehouseId: 'wh-1',
  suggestions: [
    {
      itemId: 'item-1',
      itemCode: 'ITM-001',
      itemName: 'Steel Bolt',
      abcClass: 'A',
      pickFrequency: 120,
      currentBin: 'B-05',
      suggestedBin: 'B-01',
      currentZone: 'Zone C',
      suggestedZone: 'Zone A',
      reason: 'High pick frequency',
      priorityScore: 95,
    },
  ],
  currentEfficiency: 72,
  projectedEfficiency: 88,
  estimatedTimeSavingMinutes: 45,
};

const mockFrequency = {
  itemId: 'item-1',
  itemCode: 'ITM-001',
  itemName: 'Steel Bolt',
  abcClass: 'A',
  pickCount: 200,
  totalQtyIssued: 1500,
  pickFrequency: 120,
};

const mockCoLocation = {
  warehouseId: 'wh-1',
  pairs: [
    {
      itemA: { id: 'item-1', code: 'ITM-001', name: 'Steel Bolt' },
      itemB: { id: 'item-2', code: 'ITM-002', name: 'Steel Nut' },
      coOccurrences: 45,
      itemABin: 'B-01',
      itemBBin: 'B-12',
      binDistance: 8,
      suggestion: 'Move Steel Nut closer to Steel Bolt',
    },
  ],
  potentialTimeSavingMinutes: 30,
};

const mockSeasonal = {
  warehouseId: 'wh-1',
  items: [
    {
      itemId: 'item-3',
      itemCode: 'ITM-003',
      itemName: 'AC Filter',
      currentBin: 'B-20',
      abcClass: 'B',
      monthlyVolumes: { '2026-01': 10, '2026-06': 100, '2026-07': 120 },
      avgMonthlyVolume: 40,
      peakMonth: '2026-07',
      peakVolume: 120,
      seasonalityIndex: 3.0,
      recommendation: 'Move to Zone A during summer months',
    },
  ],
  seasonalAlertCount: 1,
};

const mockAiSummary = {
  warehouseId: 'wh-1',
  standardAnalysis: mockAnalysis,
  coLocation: mockCoLocation,
  seasonal: mockSeasonal,
  aiConfidence: 0.87,
  topRecommendations: ['Move Steel Bolt to B-01', 'Co-locate bolts and nuts'],
};

// ############################################################################
// SLOTTING ANALYSIS
// ############################################################################

describe('useSlottingAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(http.get(`${API}/slotting/analyze`, () => HttpResponse.json({ success: true, data: mockAnalysis })));
  });

  it('fetches slotting analysis for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSlottingAnalysis('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.warehouseId).toBe('wh-1');
    expect(data.data.suggestions).toBeInstanceOf(Array);
    expect(data.data.suggestions.length).toBe(1);
    expect(data.data.suggestions[0].itemCode).toBe('ITM-001');
    expect(data.data.suggestions[0].suggestedBin).toBe('B-01');
    expect(data.data.currentEfficiency).toBe(72);
    expect(data.data.projectedEfficiency).toBe(88);
    expect(data.data.estimatedTimeSavingMinutes).toBe(45);
  });

  it('is disabled when warehouseId is undefined', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSlottingAnalysis(undefined), { wrapper });

    await new Promise(r => setTimeout(r, 50));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ############################################################################
// PICK FREQUENCIES
// ############################################################################

describe('usePickFrequencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/slotting/frequencies`, () => HttpResponse.json({ success: true, data: [mockFrequency] })),
    );
  });

  it('fetches pick frequencies for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePickFrequencies('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBe(1);
    expect(data.data[0].itemId).toBe('item-1');
    expect(data.data[0].abcClass).toBe('A');
    expect(data.data[0].pickCount).toBe(200);
    expect(data.data[0].pickFrequency).toBe(120);
  });
});

// ############################################################################
// CO-LOCATION
// ############################################################################

describe('useCoLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/slotting/:warehouseId/co-location`, () =>
        HttpResponse.json({ success: true, data: mockCoLocation }),
      ),
    );
  });

  it('fetches co-location analysis for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCoLocation('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.warehouseId).toBe('wh-1');
    expect(data.data.pairs).toBeInstanceOf(Array);
    expect(data.data.pairs.length).toBe(1);
    expect(data.data.pairs[0].coOccurrences).toBe(45);
    expect(data.data.pairs[0].binDistance).toBe(8);
    expect(data.data.potentialTimeSavingMinutes).toBe(30);
  });
});

// ############################################################################
// SEASONAL TRENDS
// ############################################################################

describe('useSeasonalTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/slotting/:warehouseId/seasonal`, () => HttpResponse.json({ success: true, data: mockSeasonal })),
    );
  });

  it('fetches seasonal trends for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSeasonalTrends('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.warehouseId).toBe('wh-1');
    expect(data.data.items).toBeInstanceOf(Array);
    expect(data.data.items[0].itemCode).toBe('ITM-003');
    expect(data.data.items[0].seasonalityIndex).toBe(3.0);
    expect(data.data.items[0].peakMonth).toBe('2026-07');
    expect(data.data.seasonalAlertCount).toBe(1);
  });
});

// ############################################################################
// AI SUMMARY
// ############################################################################

describe('useAiSlottingSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get(`${API}/slotting/:warehouseId/ai-summary`, () =>
        HttpResponse.json({ success: true, data: mockAiSummary }),
      ),
    );
  });

  it('fetches AI slotting summary for a warehouse', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAiSlottingSummary('wh-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.warehouseId).toBe('wh-1');
    expect(data.data.aiConfidence).toBe(0.87);
    expect(data.data.topRecommendations).toBeInstanceOf(Array);
    expect(data.data.topRecommendations.length).toBe(2);
    expect(data.data.standardAnalysis.currentEfficiency).toBe(72);
    expect(data.data.coLocation.potentialTimeSavingMinutes).toBe(30);
    expect(data.data.seasonal.seasonalAlertCount).toBe(1);
  });
});

// ############################################################################
// APPLY SLOTTING
// ############################################################################

describe('useApplySlotting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.post(`${API}/slotting/apply`, () =>
        HttpResponse.json({
          success: true,
          data: { success: true, oldBin: 'B-05', newBin: 'B-01' },
        }),
      ),
    );
  });

  it('applies a slotting change', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApplySlotting(), { wrapper });

    act(() => {
      result.current.mutate({ itemId: 'item-1', warehouseId: 'wh-1', newBinNumber: 'B-01' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.success).toBe(true);
    expect(data.data.success).toBe(true);
    expect(data.data.oldBin).toBe('B-05');
    expect(data.data.newBin).toBe('B-01');
  });
});
