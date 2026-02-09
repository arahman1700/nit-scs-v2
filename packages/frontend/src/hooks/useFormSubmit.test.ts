import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useFormSubmit } from './useFormSubmit';

describe('useFormSubmit', () => {
  const baseOptions = { documentType: 'MRRV' };

  it('starts with idle state', () => {
    const { result } = renderHook(() => useFormSubmit(baseOptions));
    expect(result.current.submitting).toBe(false);
    expect(result.current.submitted).toBe(false);
    expect(result.current.errors).toEqual([]);
    expect(result.current.warnings).toEqual([]);
    expect(result.current.documentNumber).toBeNull();
  });

  it('runs validation and blocks on errors', async () => {
    const validator = vi.fn().mockReturnValue({
      valid: false,
      errors: [{ field: 'warehouseId', rule: 'required', message: 'Warehouse is required' }],
      warnings: [],
    });

    const { result } = renderHook(() => useFormSubmit({ ...baseOptions, validator }));

    let success: boolean;
    await act(async () => {
      success = await result.current.submit({});
    });

    expect(success!).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].field).toBe('warehouseId');
    expect(result.current.submitted).toBe(false);
  });

  it('passes validation warnings through', async () => {
    const validator = vi.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: [{ field: 'notes', rule: 'optional', message: 'Consider adding notes' }],
    });

    const { result } = renderHook(() => useFormSubmit({ ...baseOptions, validator }));

    await act(async () => {
      await result.current.submit({});
    });

    expect(result.current.warnings).toHaveLength(1);
    expect(result.current.submitted).toBe(true);
  });

  it('calls service.create and sets submitted on success', async () => {
    const service = {
      create: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'mrrv-1', formNumber: 'MRRV-2026-00001' },
      }),
    };

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useFormSubmit({ ...baseOptions, service, onSuccess }));

    await act(async () => {
      await result.current.submit({ warehouseId: 'wh-1' }, []);
    });

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseId: 'wh-1', lineItems: [], totalValue: 0 }),
    );
    expect(result.current.submitted).toBe(true);
    expect(result.current.documentNumber).toBe('MRRV-2026-00001');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('handles service error (success: false)', async () => {
    const service = {
      create: vi.fn().mockResolvedValue({
        success: false,
        message: 'Duplicate form number',
      }),
    };

    const { result } = renderHook(() => useFormSubmit({ ...baseOptions, service }));

    await act(async () => {
      await result.current.submit({});
    });

    expect(result.current.submitted).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].message).toBe('Duplicate form number');
  });

  it('handles network error (rejected promise)', async () => {
    const service = {
      create: vi.fn().mockRejectedValue(new Error('Network Error')),
    };

    const { result } = renderHook(() => useFormSubmit({ ...baseOptions, service }));

    await act(async () => {
      await result.current.submit({});
    });

    expect(result.current.submitted).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].rule).toBe('ERROR');
  });

  it('calculates totalValue from lineItems', async () => {
    const service = {
      create: vi.fn().mockResolvedValue({ success: true, data: { id: '1' } }),
    };

    const { result } = renderHook(() => useFormSubmit({ ...baseOptions, service }));

    const lineItems = [
      { itemId: 'i1', qty: 2, unitPrice: 10, totalPrice: 20, description: '' },
      { itemId: 'i2', qty: 1, unitPrice: 50, totalPrice: 50, description: '' },
    ] as any[];

    await act(async () => {
      await result.current.submit({}, lineItems);
    });

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ totalValue: 70 }));
  });

  it('resets state correctly', async () => {
    const service = {
      create: vi.fn().mockResolvedValue({ success: true, data: { id: '1', formNumber: 'X-001' } }),
    };

    const { result } = renderHook(() => useFormSubmit({ ...baseOptions, service }));

    await act(async () => {
      await result.current.submit({});
    });
    expect(result.current.submitted).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.submitted).toBe(false);
    expect(result.current.documentNumber).toBeNull();
    expect(result.current.errors).toEqual([]);
  });
});
