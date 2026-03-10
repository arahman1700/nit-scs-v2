import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test-utils/render';
import { InventoryDashboard } from './InventoryDashboard';

// Mock the domain hooks
vi.mock('@/domains/master-data/hooks/useMasterData', () => ({
  useInventory: () => ({
    data: {
      success: true,
      data: [
        {
          id: 'inv-1',
          qtyOnHand: 100,
          qtyReserved: 10,
          minLevel: 20,
          reorderPoint: 30,
          lastMovementDate: null,
          item: { itemCode: 'IT-001', itemDescription: 'Steel Bars', category: 'Structural', uom: { uomCode: 'EA' } },
          warehouse: { id: 'wh-1', warehouseName: 'Main Warehouse', warehouseCode: 'WH-01' },
          warehouseId: 'wh-1',
        },
      ],
      meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useWarehouses: () => ({
    data: {
      success: true,
      data: [{ id: 'wh-1', warehouseName: 'Main Warehouse' }],
      meta: { total: 1 },
    },
    isLoading: false,
  }),
}));

vi.mock('@/domains/reporting/hooks/useDashboard', () => ({
  useInventorySummary: () => ({
    data: {
      data: {
        totalItems: 100,
        totalQty: 5000,
        lowStock: 5,
        outOfStock: 2,
        totalValue: 250000,
      },
    },
    isLoading: false,
  }),
}));

vi.mock('@/components/ExportButton', () => ({
  ExportButton: ({ onExportExcel }: { onExportExcel: () => void }) => <button onClick={onExportExcel}>Export</button>,
}));

vi.mock('@/lib/excelExport', () => ({
  exportToExcel: vi.fn(),
}));

vi.mock('@/utils/displayStr', () => ({
  displayStr: (val: unknown) => String(val ?? ''),
}));

vi.mock('@/utils/type-helpers', () => ({
  extractRows: (data: unknown) => {
    if (!data) return [];
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data)) return d.data;
    return [];
  },
  toRows: (data: unknown) => data,
}));

describe('InventoryDashboard', () => {
  it('renders without crashing', () => {
    render(<InventoryDashboard />);

    expect(screen.getByText('Inventory Levels')).toBeInTheDocument();
  });

  it('displays stats cards', () => {
    render(<InventoryDashboard />);

    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('Total Qty on Hand')).toBeInTheDocument();
    // "In Stock" appears both in the stats card label and in the table row status badge,
    // so use getAllByText to allow multiple matches.
    expect(screen.getAllByText('In Stock').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Low Stock')).toBeInTheDocument();
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });

  it('shows Table and Grid view toggle buttons and can switch', () => {
    render(<InventoryDashboard />);

    const tableBtn = screen.getByText('Table');
    const gridBtn = screen.getByText('Grid');

    expect(tableBtn).toBeInTheDocument();
    expect(gridBtn).toBeInTheDocument();

    // Switch to grid view
    fireEvent.click(gridBtn);

    // Grid view should render item descriptions
    expect(screen.getByText('Steel Bars')).toBeInTheDocument();
  });
});
