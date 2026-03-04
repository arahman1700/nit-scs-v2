import React, { memo } from 'react';

import { toHijri } from '@/utils/hijri';

interface HijriDateProps {
  /** The date to display. Accepts a Date object, ISO string, null, or undefined. */
  date: string | Date | null | undefined;
  /** When true (default), show both Gregorian and Hijri. When false, show Hijri only. */
  showGregorian?: boolean;
  /** Additional CSS classes applied to the outer `<span>`. */
  className?: string;
}

/**
 * Displays a date with its Hijri (Islamic Um Al-Qura) calendar equivalent.
 *
 * - Gregorian + Hijri (default): `03 Mar 2026 (09/08/1447 هـ)`
 * - Hijri only: `09/08/1447 هـ`
 */
export const HijriDate: React.FC<HijriDateProps> = memo(({ date, showGregorian = true, className }) => {
  if (date == null) return null;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  if (!showGregorian) {
    return (
      <span className={className}>
        <span className="text-sm text-gray-400">{toHijri(d)}</span>
      </span>
    );
  }

  const gregorian = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);

  const hijri = toHijri(d);

  return (
    <span className={className}>
      <span className="text-sm text-white">{gregorian}</span> <span className="text-sm text-gray-400">({hijri})</span>
    </span>
  );
});
