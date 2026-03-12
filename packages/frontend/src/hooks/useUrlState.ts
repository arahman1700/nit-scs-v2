import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Widen literal types to their base type so that
 * `useUrlState('page', 1)` infers `number` not `1`.
 */
type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;

/**
 * Drop-in replacement for useState that syncs state with URL search params.
 * Preserves back-button, bookmarking, and deep-linking behavior.
 *
 * @example
 * // Before:  const [tab, setTab] = useState('overview');
 * // After:   const [tab, setTab] = useUrlState('tab', 'overview');
 */
export function useUrlState<T extends string | number | boolean>(
  key: string,
  defaultValue: T,
): [Widen<T>, (value: Widen<T> | ((prev: Widen<T>) => Widen<T>)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawValue = searchParams.get(key);
  const value = (rawValue !== null ? deserialize(rawValue, defaultValue) : defaultValue) as Widen<T>;

  const setValue = useCallback(
    (nextValue: Widen<T> | ((prev: Widen<T>) => Widen<T>)) => {
      setSearchParams(
        prev => {
          const currentRaw = prev.get(key);
          const currentVal = (currentRaw !== null ? deserialize(currentRaw, defaultValue) : defaultValue) as Widen<T>;
          const resolved =
            typeof nextValue === 'function' ? (nextValue as (prev: Widen<T>) => Widen<T>)(currentVal) : nextValue;

          const next = new URLSearchParams(prev);
          // Remove param when value equals default (keeps URL clean)
          if (resolved === (defaultValue as unknown)) {
            next.delete(key);
          } else {
            next.set(key, String(resolved));
          }
          return next;
        },
        { replace: true },
      );
    },
    [key, defaultValue, setSearchParams],
  );

  return [value, setValue];
}

function deserialize<T extends string | number | boolean>(raw: string, defaultValue: T): string | number | boolean {
  if (typeof defaultValue === 'number') return Number(raw) || 0;
  if (typeof defaultValue === 'boolean') return raw === 'true';
  return raw;
}
