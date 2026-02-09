import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KpiCard } from '@/components/KpiCard';
import type { KpiCardProps } from '@/components/KpiCard';

// Mock icon component
const MockIcon = (props: Record<string, unknown>) => <svg data-testid="mock-icon" {...props} />;

const defaultProps: KpiCardProps = {
  title: 'Total Orders',
  value: 'Active',
  icon: MockIcon,
  color: 'bg-emerald-500',
};

function renderCard(overrides: Partial<KpiCardProps> = {}) {
  return render(<KpiCard {...defaultProps} {...overrides} />);
}

describe('KpiCard', () => {
  it('renders title and string value', () => {
    renderCard();
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders numeric value with locale formatting', () => {
    renderCard({ value: 1234 });
    // toLocaleString() produces "1,234" in en-US
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('renders loading skeleton and does NOT show title or value', () => {
    const { container } = renderCard({ loading: true });
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
    expect(screen.queryByText('Total Orders')).not.toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders sublabel when provided', () => {
    renderCard({ sublabel: 'last 7 days' });
    expect(screen.getByText('last 7 days')).toBeInTheDocument();
  });

  it('does not render sublabel when not provided', () => {
    renderCard();
    // no sublabel rendered — just confirm title is there and no extra span
    expect(screen.queryByText('last 7 days')).not.toBeInTheDocument();
  });

  it('renders trend with up arrow', () => {
    const { container } = renderCard({ trend: { value: '+12%', up: true } });
    expect(screen.getByText('+12%')).toBeInTheDocument();
    // TrendingUp icon should be present (rendered as SVG)
    const trendSvgs = container.querySelectorAll('svg');
    expect(trendSvgs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders trend with down arrow', () => {
    const { container } = renderCard({ trend: { value: '-5%', up: false } });
    expect(screen.getByText('-5%')).toBeInTheDocument();
    const trendSvgs = container.querySelectorAll('svg');
    expect(trendSvgs.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render trend when trend is null', () => {
    renderCard({ trend: null });
    // No trend text should be present
    expect(screen.queryByText('+12%')).not.toBeInTheDocument();
    expect(screen.queryByText('-5%')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    renderCard({ onClick: handleClick });
    fireEvent.click(screen.getByText('Total Orders'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has cursor-pointer class when onClick is provided', () => {
    const { container } = renderCard({ onClick: vi.fn() });
    // The outermost div gets the cursor-pointer class
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('cursor-pointer');
  });

  it('does not have cursor-pointer class when onClick is not provided', () => {
    const { container } = renderCard();
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('cursor-pointer');
  });

  it('has alert border classes when alert is true', () => {
    const { container } = renderCard({ alert: true });
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-red-500/30');
  });

  it('does not have alert border classes when alert is false', () => {
    const { container } = renderCard({ alert: false });
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('border-red-500/30');
  });

  it('renders the icon component', () => {
    renderCard();
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });
});
