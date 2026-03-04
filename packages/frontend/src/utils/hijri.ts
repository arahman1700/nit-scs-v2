/**
 * Hijri (Islamic Um Al-Qura) calendar utilities.
 *
 * Uses the built-in `Intl.DateTimeFormat` with `calendar: 'islamic-umalqura'`
 * — no external dependencies required.
 */

/**
 * Convert a Gregorian date to a Hijri date string.
 *
 * @param date - A `Date` object or an ISO date string.
 * @returns Formatted Hijri date, e.g. `"09/08/1447 هـ"`, or `""` if the input is nullish / invalid.
 */
export function toHijri(date: Date | string | null | undefined): string {
  if (date == null) return '';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const parts = formatter.formatToParts(d);

  const day = parts.find(p => p.type === 'day')?.value ?? '';
  const month = parts.find(p => p.type === 'month')?.value ?? '';
  const year = parts.find(p => p.type === 'year')?.value ?? '';

  return `${day}/${month}/${year} هـ`;
}

/**
 * Format a date showing both Gregorian and Hijri representations.
 *
 * @param date - A `Date` object or an ISO date string.
 * @returns E.g. `"04 Mar 2026 (09/08/1447 هـ)"`, or `""` if the input is nullish / invalid.
 */
export function formatDateWithHijri(date: Date | string | null | undefined): string {
  if (date == null) return '';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';

  const gregorian = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);

  const hijri = toHijri(d);

  return `${gregorian} (${hijri})`;
}
