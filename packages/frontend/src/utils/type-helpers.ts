/**
 * Centralized type assertion helpers.
 * These replace scattered `as unknown as` casts throughout the codebase.
 *
 * All JavaScript objects are `Record<string, unknown>` at runtime,
 * so these conversions are always safe. The functions exist solely
 * to satisfy TypeScript's structural type system in one place.
 */

/**
 * Convert a typed array to Record<string, unknown>[] (or a custom type via generic).
 * Use when passing hook data to generic table/grid components.
 */
export function toRows<T = Record<string, unknown>>(data: unknown[] | undefined | null): T[] {
  return (data ?? []) as T[];
}

/**
 * Extract `.data` from an API response and convert to Record<string, unknown>[] (or a custom type via generic).
 * Replaces the pattern: `(query.data?.data ?? []) as unknown as Record<string, unknown>[]`
 */
export function extractRows<T = Record<string, unknown>>(queryData: { data?: unknown[] } | undefined | null): T[] {
  return (queryData?.data ?? []) as T[];
}

/**
 * Convert a typed object to Record<string, unknown>.
 * Use when accessing dynamic fields on a typed entity.
 */
export function toRecord(obj: unknown): Record<string, unknown> {
  return (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
}
