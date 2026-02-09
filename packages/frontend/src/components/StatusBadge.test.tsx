import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test-utils/render';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="Approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it.each([
    ['Approved', 'emerald'],
    ['Completed', 'emerald'],
    ['Pending', 'amber'],
    ['In Progress', 'amber'],
    ['Rejected', 'red'],
    ['Cancelled', 'red'],
    ['Issued', 'blue'],
    ['Draft', 'gray'],
  ])('applies correct color for %s status', (status, color) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(status);
    expect(badge.className).toContain(color);
  });

  it('applies default gray for unknown status', () => {
    render(<StatusBadge status="SomeUnknownStatus" />);
    const badge = screen.getByText('SomeUnknownStatus');
    expect(badge.className).toContain('gray');
  });
});
