import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../test-utils/render';
import { KpiDashboard } from './KpiDashboard';

// Mock the useKpis hook at module level
const mockUseKpis = vi.fn();
vi.mock('@/domains/reporting/hooks/useKpis', () => ({
  useKpis: () => mockUseKpis(),
}));

// Mock toRecord to pass through data
vi.mock('@/utils/type-helpers', () => ({
  toRecord: (val: unknown) => val ?? {},
}));

const mockKpiData = {
  success: true,
  data: {
    inventory: {
      inventoryTurnover: { value: 4.2, trend: 5.1, label: 'Inventory Turnover', unit: 'x' },
      stockAccuracy: { value: 97.5, trend: 1.2, label: 'Stock Accuracy', unit: '%' },
    },
    procurement: {
      grnProcessingTime: { value: 2.5, trend: -3.0, label: 'GRN Processing Time', unit: 'days' },
    },
    logistics: {},
    quality: {},
    financial: {},
  },
};

describe('KpiDashboard', () => {
  it('renders without crashing', () => {
    mockUseKpis.mockReturnValue({ data: mockKpiData, isLoading: false, isError: false });

    render(<KpiDashboard />);

    expect(screen.getByText('KPI Dashboard')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading is true', () => {
    mockUseKpis.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    const { container } = render(<KpiDashboard />);

    // Skeleton cards have animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders KPI cards with data', async () => {
    mockUseKpis.mockReturnValue({ data: mockKpiData, isLoading: false, isError: false });

    render(<KpiDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Inventory Turnover')).toBeInTheDocument();
      expect(screen.getByText('Stock Accuracy')).toBeInTheDocument();
      expect(screen.getByText('GRN Processing Time')).toBeInTheDocument();
    });
  });

  it('shows error state when isError is true', () => {
    mockUseKpis.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<KpiDashboard />);

    expect(screen.getByText(/failed to load kpi data/i)).toBeInTheDocument();
  });

  it('displays category filter tabs', () => {
    mockUseKpis.mockReturnValue({ data: mockKpiData, isLoading: false, isError: false });

    render(<KpiDashboard />);

    // "All" tab button
    expect(screen.getByText('All')).toBeInTheDocument();
    // Category labels appear in both filter tabs and KPI card badges,
    // so use getAllByText and verify at least one match each.
    expect(screen.getAllByText('Inventory').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Procurement').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Logistics').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Quality').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Financial').length).toBeGreaterThanOrEqual(1);
  });
});
