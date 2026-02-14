import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils/render';

// Mock the master data hooks to avoid real API calls
vi.mock('@/api/hooks/useMasterData', () => ({
  useItems: () => ({
    data: {
      data: [
        {
          id: 'item-1',
          code: 'MAT-001',
          name: 'Steel Pipe',
          unit: 'Meter',
          category: 'Pipes',
          unitPrice: 50,
        },
        {
          id: 'item-2',
          code: 'MAT-002',
          name: 'Cement Bag',
          unit: 'Bag',
          category: 'Cement',
          unitPrice: 25,
        },
      ],
    },
    isLoading: false,
  }),
  useUoms: () => ({
    data: { data: [{ name: 'Meter' }, { name: 'Bag' }, { name: 'Piece' }] },
    isLoading: false,
  }),
  useInventory: () => ({
    data: {
      data: [
        { item: { code: 'MAT-001' }, qtyOnHand: 100, qtyReserved: 10 },
        { item: { code: 'MAT-002' }, qtyOnHand: 5, qtyReserved: 0 },
      ],
    },
    isLoading: false,
  }),
}));

// Mock BarcodeScanner lazy import
vi.mock('@/components/BarcodeScanner', () => ({
  default: () => <div data-testid="barcode-scanner">Scanner</div>,
}));

import { LineItemsTable } from './LineItemsTable';

describe('LineItemsTable', () => {
  const mockOnChange = vi.fn();
  const baseItem = {
    id: 'line-1',
    itemCode: 'MAT-001',
    itemName: 'Steel Pipe',
    unit: 'Meter',
    quantity: 5,
    unitPrice: 50,
    totalPrice: 250,
    condition: 'New' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders items and shows count', () => {
    render(<LineItemsTable items={[baseItem]} onItemsChange={mockOnChange} />);

    expect(screen.getByText(/1 item/)).toBeInTheDocument();
    // In edit mode, item name is in an input, not plain text
    expect(screen.getByDisplayValue('Steel Pipe')).toBeInTheDocument();
  });

  it('shows total value summary', () => {
    const items = [
      baseItem,
      {
        ...baseItem,
        id: 'line-2',
        itemCode: 'MAT-002',
        itemName: 'Cement Bag',
        totalPrice: 100,
        quantity: 4,
        unitPrice: 25,
      },
    ];
    render(<LineItemsTable items={items} onItemsChange={mockOnChange} />);

    // Total should be 250 + 100 = 350 (toLocaleString may add formatting)
    expect(screen.getByText(/350/)).toBeInTheDocument();
  });

  it('adds a blank item when Add Manual button is clicked', async () => {
    const user = userEvent.setup();
    render(<LineItemsTable items={[]} onItemsChange={mockOnChange} />);

    const addButton = screen.getByRole('button', { name: /add manual/i });
    await user.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ itemCode: '', quantity: 1, unitPrice: 0 })]),
    );
  });

  it('does not show action buttons in readOnly mode', () => {
    render(<LineItemsTable items={[baseItem]} onItemsChange={mockOnChange} readOnly />);

    expect(screen.queryByRole('button', { name: /add manual/i })).not.toBeInTheDocument();
  });

  it('shows stock availability numbers when enabled', () => {
    render(<LineItemsTable items={[baseItem]} onItemsChange={mockOnChange} showStockAvailability />);

    // MAT-001 has 100 on hand, 10 reserved = 90 available
    // The component renders the number, and "Available" column header
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
  });

  it('shows condition column when enabled', () => {
    render(<LineItemsTable items={[baseItem]} onItemsChange={mockOnChange} showCondition />);

    expect(screen.getByText('Condition')).toBeInTheDocument();
  });

  it('renders empty state gracefully', () => {
    render(<LineItemsTable items={[]} onItemsChange={mockOnChange} />);

    expect(screen.getByText(/0 items/)).toBeInTheDocument();
  });
});
