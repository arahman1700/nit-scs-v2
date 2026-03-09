import { describe, it, expect } from 'vitest';
import { toRows, extractRows, toRecord } from './type-helpers';

// ── toRows ──────────────────────────────────────────────────────────────

describe('toRows', () => {
  it('returns the array as-is when given a valid array', () => {
    const data = [{ id: 1 }, { id: 2 }];
    expect(toRows(data)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns empty array for null', () => {
    expect(toRows(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(toRows(undefined)).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(toRows([])).toEqual([]);
  });

  it('preserves the original array reference', () => {
    const data = [{ a: 1 }];
    const result = toRows(data);
    expect(result).toBe(data);
  });

  it('works with generic type parameter', () => {
    interface Custom {
      name: string;
    }
    const data = [{ name: 'test' }];
    const result = toRows<Custom>(data);
    expect(result[0].name).toBe('test');
  });

  it('handles arrays with mixed types', () => {
    const data = [1, 'two', { three: 3 }];
    const result = toRows(data);
    expect(result).toHaveLength(3);
  });

  it('handles array of strings', () => {
    const data = ['a', 'b', 'c'];
    expect(toRows(data)).toEqual(['a', 'b', 'c']);
  });
});

// ── extractRows ─────────────────────────────────────────────────────────

describe('extractRows', () => {
  it('extracts .data from a query response', () => {
    const queryData = { data: [{ id: 1 }, { id: 2 }] };
    expect(extractRows(queryData)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns empty array when queryData is null', () => {
    expect(extractRows(null)).toEqual([]);
  });

  it('returns empty array when queryData is undefined', () => {
    expect(extractRows(undefined)).toEqual([]);
  });

  it('returns empty array when .data is undefined', () => {
    const queryData = {} as { data?: unknown[] };
    expect(extractRows(queryData)).toEqual([]);
  });

  it('returns empty array when .data is null-ish in the response', () => {
    const queryData = { data: undefined };
    expect(extractRows(queryData)).toEqual([]);
  });

  it('returns empty array for empty .data array', () => {
    const queryData = { data: [] };
    expect(extractRows(queryData)).toEqual([]);
  });

  it('works with generic type parameter', () => {
    interface Item {
      name: string;
      qty: number;
    }
    const queryData = { data: [{ name: 'Pipe', qty: 10 }] };
    const result = extractRows<Item>(queryData);
    expect(result[0].name).toBe('Pipe');
    expect(result[0].qty).toBe(10);
  });

  it('preserves extra properties on the query response', () => {
    const queryData = { data: [{ id: 1 }], total: 100 };
    expect(extractRows(queryData)).toEqual([{ id: 1 }]);
  });
});

// ── toRecord ────────────────────────────────────────────────────────────

describe('toRecord', () => {
  it('converts a typed object to Record<string, unknown>', () => {
    const obj = { name: 'Test', count: 5 };
    const result = toRecord(obj);
    expect(result.name).toBe('Test');
    expect(result.count).toBe(5);
  });

  it('returns empty object for null', () => {
    expect(toRecord(null)).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(toRecord(undefined)).toEqual({});
  });

  it('returns empty object for a string', () => {
    expect(toRecord('hello')).toEqual({});
  });

  it('returns empty object for a number', () => {
    expect(toRecord(42)).toEqual({});
  });

  it('returns empty object for a boolean', () => {
    expect(toRecord(true)).toEqual({});
  });

  it('returns empty object for zero', () => {
    expect(toRecord(0)).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(toRecord('')).toEqual({});
  });

  it('preserves the original object reference', () => {
    const obj = { key: 'value' };
    const result = toRecord(obj);
    expect(result).toBe(obj);
  });

  it('handles deeply nested objects', () => {
    const obj = { a: { b: { c: 'deep' } } };
    const result = toRecord(obj);
    expect(result.a as Record<string, unknown>).toEqual({ b: { c: 'deep' } });
  });

  it('handles arrays (arrays are objects)', () => {
    const arr = [1, 2, 3];
    const result = toRecord(arr);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
  });
});
