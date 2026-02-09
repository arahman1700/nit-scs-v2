import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '@/components/Pagination';

const defaultProps = {
  currentPage: 1,
  totalPages: 5,
  totalItems: 100,
  pageSize: 20,
  onPageChange: vi.fn(),
};

function renderPagination(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, onPageChange: vi.fn(), ...overrides };
  render(<Pagination {...props} />);
  return props;
}

describe('Pagination', () => {
  it('renders correct range text for page 1', () => {
    renderPagination();
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText('1-20')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders "0-0 of 0 records" when totalItems is 0', () => {
    renderPagination({ totalItems: 0, totalPages: 0 });
    expect(screen.getByText('0-0')).toBeInTheDocument();
    expect(screen.getByText('0', { exact: true })).toBeInTheDocument();
  });

  it('renders correct range for a middle page', () => {
    renderPagination({ currentPage: 3 });
    expect(screen.getByText('41-60')).toBeInTheDocument();
  });

  it('disables Previous button on page 1', () => {
    renderPagination({ currentPage: 1 });
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('disables Next button on the last page', () => {
    renderPagination({ currentPage: 5, totalPages: 5 });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onPageChange(currentPage - 1) when Previous is clicked', () => {
    const props = renderPagination({ currentPage: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(props.onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange(currentPage + 1) when Next is clicked', () => {
    const props = renderPagination({ currentPage: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(props.onPageChange).toHaveBeenCalledWith(4);
  });

  it('calls onPageChange with page number when a page button is clicked', () => {
    const props = renderPagination();
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(props.onPageChange).toHaveBeenCalledWith(3);
  });

  it('shows at most 5 page number buttons', () => {
    renderPagination({ totalPages: 10 });
    const pageButtons = screen.getAllByRole('button').filter(btn => {
      const text = btn.textContent ?? '';
      return /^\d+$/.test(text);
    });
    expect(pageButtons).toHaveLength(5);
  });

  it('shows fewer page buttons when totalPages < 5', () => {
    renderPagination({ totalPages: 3 });
    const pageButtons = screen.getAllByRole('button').filter(btn => {
      const text = btn.textContent ?? '';
      return /^\d+$/.test(text);
    });
    expect(pageButtons).toHaveLength(3);
  });
});
