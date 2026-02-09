import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCurrency,
  formatCurrencyShort,
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatPercent,
  truncateText,
  getStatusColor,
  getStatusBgColor,
} from './formatters.js';

// ── formatCurrency ──────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats with default SAR currency', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.5 SAR');
  });

  it('formats with custom currency', () => {
    expect(formatCurrency(1000, 'USD')).toBe('1,000 USD');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('0 SAR');
  });

  it('formats large numbers with commas', () => {
    expect(formatCurrency(1234567.89)).toBe('1,234,567.89 SAR');
  });

  it('truncates beyond 2 decimal places', () => {
    const result = formatCurrency(1234.567);
    // maximumFractionDigits: 2 means it rounds to 2 decimals
    expect(result).toBe('1,234.57 SAR');
  });

  it('formats whole numbers without trailing decimals', () => {
    // minimumFractionDigits: 0 means no forced decimals
    expect(formatCurrency(1000)).toBe('1,000 SAR');
  });
});

// ── formatCurrencyShort ─────────────────────────────────────────────────

describe('formatCurrencyShort', () => {
  it('formats millions', () => {
    expect(formatCurrencyShort(1_500_000)).toBe('1.5M SAR');
  });

  it('formats exactly 1 million', () => {
    expect(formatCurrencyShort(1_000_000)).toBe('1.0M SAR');
  });

  it('formats thousands', () => {
    expect(formatCurrencyShort(45_000)).toBe('45K SAR');
  });

  it('formats exactly 1 thousand', () => {
    expect(formatCurrencyShort(1_000)).toBe('1K SAR');
  });

  it('formats values below 1000 as-is', () => {
    expect(formatCurrencyShort(500)).toBe('500 SAR');
  });

  it('formats zero', () => {
    expect(formatCurrencyShort(0)).toBe('0 SAR');
  });
});

// ── formatDate ──────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a valid date string', () => {
    const result = formatDate('2025-01-15');
    // en-GB: "15 Jan 2025"
    expect(result).toBe('15 Jan 2025');
  });

  it('returns "-" for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('returns "-" for empty string (falsy)', () => {
    expect(formatDate('')).toBe('-');
  });
});

// ── formatRelativeTime ──────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for <1 minute ago', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('Just now');
  });

  it('returns minutes ago', () => {
    vi.useFakeTimers();
    const base = Date.now();
    vi.setSystemTime(base);
    const fiveMinAgo = new Date(base - 5 * 60_000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    vi.useFakeTimers();
    const base = Date.now();
    vi.setSystemTime(base);
    const threeHoursAgo = new Date(base - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago for < 7 days', () => {
    vi.useFakeTimers();
    const base = Date.now();
    vi.setSystemTime(base);
    const twoDaysAgo = new Date(base - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });

  it('falls back to formatDate for >= 7 days', () => {
    vi.useFakeTimers();
    const base = Date.now();
    vi.setSystemTime(base);
    const tenDaysAgo = new Date(base - 10 * 24 * 60 * 60_000).toISOString();
    const result = formatRelativeTime(tenDaysAgo);
    // Should return a formatted date like "30 Jan 2026", not a relative string
    expect(result).not.toContain('ago');
    expect(result).not.toBe('Just now');
  });
});

// ── formatNumber ────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats with thousand separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats small numbers without separator', () => {
    expect(formatNumber(999)).toBe('999');
  });
});

// ── formatPercent ───────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('formats with default 1 decimal', () => {
    expect(formatPercent(75.123)).toBe('75.1%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercent(75.123, 2)).toBe('75.12%');
  });

  it('formats with 0 decimals', () => {
    expect(formatPercent(75.6, 0)).toBe('76%');
  });

  it('formats 100%', () => {
    expect(formatPercent(100)).toBe('100.0%');
  });

  it('formats 0%', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });
});

// ── truncateText ────────────────────────────────────────────────────────

describe('truncateText', () => {
  it('returns short text unchanged', () => {
    expect(truncateText('Hello', 10)).toBe('Hello');
  });

  it('returns text at exact maxLen unchanged', () => {
    expect(truncateText('12345', 5)).toBe('12345');
  });

  it('truncates long text with ellipsis', () => {
    expect(truncateText('Hello, World!', 5)).toBe('Hello...');
  });

  it('handles empty string', () => {
    expect(truncateText('', 10)).toBe('');
  });
});

// ── getStatusColor ──────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('maps Approved to emerald', () => {
    expect(getStatusColor('Approved')).toContain('emerald');
  });

  it('maps Completed to emerald', () => {
    expect(getStatusColor('Completed')).toContain('emerald');
  });

  it('maps Pending to amber', () => {
    expect(getStatusColor('Pending')).toContain('amber');
  });

  it('maps In Progress to amber', () => {
    expect(getStatusColor('In Progress')).toContain('amber');
  });

  it('maps Rejected to red', () => {
    expect(getStatusColor('Rejected')).toContain('red');
  });

  it('maps Cancelled to red', () => {
    expect(getStatusColor('Cancelled')).toContain('red');
  });

  it('maps Draft to gray', () => {
    expect(getStatusColor('Draft')).toContain('gray');
  });

  it('maps Issued to blue', () => {
    expect(getStatusColor('Issued')).toContain('blue');
  });

  it('returns gray for unknown status', () => {
    expect(getStatusColor('SomeRandomStatus')).toContain('gray');
  });
});

// ── getStatusBgColor ────────────────────────────────────────────────────

describe('getStatusBgColor', () => {
  it('maps Approved to emerald bg', () => {
    expect(getStatusBgColor('Approved')).toContain('emerald');
  });

  it('maps Pending to amber bg', () => {
    expect(getStatusBgColor('Pending')).toContain('amber');
  });

  it('maps Rejected to red bg', () => {
    expect(getStatusBgColor('Rejected')).toContain('red');
  });

  it('maps Draft to gray bg', () => {
    expect(getStatusBgColor('Draft')).toContain('gray');
  });

  it('maps Issued to blue bg', () => {
    expect(getStatusBgColor('Issued')).toContain('blue');
  });

  it('returns gray bg for unknown status', () => {
    expect(getStatusBgColor('Unknown')).toContain('gray');
  });

  it('includes both bg and border classes', () => {
    const result = getStatusBgColor('Approved');
    expect(result).toContain('bg-');
    expect(result).toContain('border-');
  });
});
