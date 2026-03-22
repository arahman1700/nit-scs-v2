import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { DirectionProvider, useDirection } from './DirectionContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <DirectionProvider>{children}</DirectionProvider>;
}

// Create a working localStorage mock for jsdom
function createLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) delete store[key];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
  };
}

describe('DirectionContext', () => {
  let storageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    // Reset document dir
    document.documentElement.setAttribute('dir', '');
    document.documentElement.setAttribute('lang', '');

    // Install fresh localStorage mock
    storageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to ltr direction', () => {
    const { result } = renderHook(() => useDirection(), { wrapper });
    expect(result.current.dir).toBe('ltr');
    expect(result.current.isRTL).toBe(false);
  });

  it('toggleDirection switches from ltr to rtl', () => {
    const { result } = renderHook(() => useDirection(), { wrapper });
    expect(result.current.dir).toBe('ltr');

    act(() => {
      result.current.toggleDirection();
    });

    expect(result.current.dir).toBe('rtl');
    expect(result.current.isRTL).toBe(true);
  });

  it('toggleDirection switches back from rtl to ltr', () => {
    const { result } = renderHook(() => useDirection(), { wrapper });

    act(() => {
      result.current.toggleDirection(); // ltr -> rtl
    });
    expect(result.current.dir).toBe('rtl');

    act(() => {
      result.current.toggleDirection(); // rtl -> ltr
    });
    expect(result.current.dir).toBe('ltr');
    expect(result.current.isRTL).toBe(false);
  });

  it('setDirection("rtl") sets dir to rtl and isRTL to true', () => {
    const { result } = renderHook(() => useDirection(), { wrapper });

    act(() => {
      result.current.setDirection('rtl');
    });

    expect(result.current.dir).toBe('rtl');
    expect(result.current.isRTL).toBe(true);
  });

  it('updates document.documentElement dir attribute on direction change', () => {
    const { result } = renderHook(() => useDirection(), { wrapper });

    // After initial render, should be ltr
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');

    act(() => {
      result.current.toggleDirection();
    });

    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('persists direction preference to localStorage under "nit-scs-direction"', () => {
    const { result } = renderHook(() => useDirection(), { wrapper });

    act(() => {
      result.current.setDirection('rtl');
    });

    expect(storageMock.setItem).toHaveBeenCalledWith('nit-scs-direction', 'rtl');
    expect(storageMock.getItem('nit-scs-direction')).toBe('rtl');

    act(() => {
      result.current.setDirection('ltr');
    });

    expect(storageMock.setItem).toHaveBeenCalledWith('nit-scs-direction', 'ltr');
    expect(storageMock.getItem('nit-scs-direction')).toBe('ltr');
  });

  it('reads initial direction from localStorage', () => {
    // Set localStorage BEFORE rendering the provider
    storageMock._store['nit-scs-direction'] = 'rtl';

    const { result } = renderHook(() => useDirection(), { wrapper });

    expect(result.current.dir).toBe('rtl');
    expect(result.current.isRTL).toBe(true);
  });
});
