import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../test-utils/render';
import { MaterialSectionPage } from './MaterialSectionPage';

// Mock all the domain hooks used by MaterialSectionPage
const mockListResponse = (data: unknown[] = [], total = 0) => ({
  data: { success: true, data, meta: { page: 1, limit: 20, total, totalPages: 1 } },
  isLoading: false,
  isError: false,
});

vi.mock('@/api/hooks', () => ({
  useGrnList: () => mockListResponse([{ id: 'grn-1', status: 'draft', formNumber: 'GRN-001' }], 1),
  useQciList: () => mockListResponse([], 0),
  useDrList: () => mockListResponse([], 0),
  useMiList: () => mockListResponse([], 0),
  useMrnList: () => mockListResponse([], 0),
  useMrList: () => mockListResponse([], 0),
  useComputedBinCards: () => mockListResponse([], 0),
  useImsfList: () => mockListResponse([], 0),
  useWtList: () => mockListResponse([], 0),
}));

vi.mock('@/domains/master-data/hooks/useMasterData', () => ({
  useInventory: () => mockListResponse([], 0),
}));

vi.mock('@/utils/type-helpers', () => ({
  extractRows: (data: unknown) => {
    if (!data) return [];
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data)) return d.data;
    return [];
  },
}));

vi.mock('@/components/SectionLandingPage', () => ({
  SectionLandingPage: ({
    title,
    subtitle,
    kpis,
  }: {
    title: string;
    subtitle: string;
    kpis: Array<{ title: string; value: number }>;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div data-testid="kpi-cards">
        {kpis.map(kpi => (
          <div key={kpi.title} data-testid={`kpi-${kpi.title}`}>
            <span>{kpi.title}</span>
            <span>{kpi.value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}));

vi.mock('@/components/DocumentListPanel', () => ({
  DocumentListPanel: () => <div>DocumentListPanel</div>,
}));

vi.mock('@/components/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock('@/config/resourceColumns', () => ({
  RESOURCE_COLUMNS: new Proxy(
    {},
    {
      get: () => ({ columns: [] }),
    },
  ),
}));

describe('MaterialSectionPage', () => {
  it('renders with correct title', () => {
    render(<MaterialSectionPage />);

    expect(screen.getByText('Warehouses & Stores')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<MaterialSectionPage />);

    expect(screen.getByText('Goods receipt, issuance, returns, quality inspection, and inventory')).toBeInTheDocument();
  });

  it('displays KPI cards', () => {
    render(<MaterialSectionPage />);

    expect(screen.getByText('Pending GRN')).toBeInTheDocument();
    expect(screen.getByText('Total Receipts')).toBeInTheDocument();
    expect(screen.getByText('Pending QCI')).toBeInTheDocument();
  });
});
