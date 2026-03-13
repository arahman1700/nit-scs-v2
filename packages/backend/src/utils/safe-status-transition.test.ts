import { describe, it, expect, vi } from 'vitest';
import { safeStatusUpdate, safeStatusUpdateTx } from './safe-status-transition.js';
import { ConflictError } from '@nit-scs-v2/shared';

function createMockDelegate(count: number) {
  return {
    updateMany: vi.fn().mockResolvedValue({ count }),
  };
}

describe('safeStatusUpdate', () => {
  it('updates successfully when status matches (count=1)', async () => {
    const delegate = createMockDelegate(1);

    const result = await safeStatusUpdate(delegate, 'rec-1', 'draft', {
      status: 'submitted',
    });

    expect(result).toEqual({ count: 1, newVersion: undefined });
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec-1', status: 'draft' },
      data: { status: 'submitted' },
    });
  });

  it('throws ConflictError when status has changed (count=0)', async () => {
    const delegate = createMockDelegate(0);

    await expect(safeStatusUpdate(delegate, 'rec-1', 'draft', { status: 'submitted' })).rejects.toThrow(ConflictError);

    await expect(safeStatusUpdate(delegate, 'rec-1', 'draft', { status: 'submitted' })).rejects.toThrow(
      /Status transition conflict/,
    );
  });

  it('includes expected status in error message', async () => {
    const delegate = createMockDelegate(0);

    await expect(safeStatusUpdate(delegate, 'rec-1', 'pending_qc', { status: 'approved' })).rejects.toThrow(
      /Expected status 'pending_qc'/,
    );
  });

  it('passes all data fields to updateMany', async () => {
    const delegate = createMockDelegate(1);

    await safeStatusUpdate(delegate, 'rec-1', 'draft', {
      status: 'submitted',
      submittedAt: '2026-01-01',
      submittedById: 'user-1',
    });

    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec-1', status: 'draft' },
      data: {
        status: 'submitted',
        submittedAt: '2026-01-01',
        submittedById: 'user-1',
      },
    });
  });

  it('WHERE clause always includes both id and status', async () => {
    const delegate = createMockDelegate(1);

    await safeStatusUpdate(delegate, 'abc-123', 'approved', { status: 'completed' });

    const callArgs = delegate.updateMany.mock.calls[0][0];
    expect(callArgs.where).toHaveProperty('id', 'abc-123');
    expect(callArgs.where).toHaveProperty('status', 'approved');
  });

  // --- Optimistic locking (version) tests ---

  it('includes version in WHERE and increments in data when expectedVersion provided', async () => {
    const delegate = createMockDelegate(1);

    const result = await safeStatusUpdate(delegate, 'rec-1', 'draft', { status: 'submitted' }, 3);

    expect(result).toEqual({ count: 1, newVersion: 4 });
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec-1', status: 'draft', version: 3 },
      data: { status: 'submitted', version: 4 },
    });
  });

  it('returns newVersion as undefined when expectedVersion is not provided', async () => {
    const delegate = createMockDelegate(1);

    const result = await safeStatusUpdate(delegate, 'rec-1', 'draft', { status: 'submitted' });

    expect(result.newVersion).toBeUndefined();
  });

  it('throws version-specific ConflictError when expectedVersion provided and count=0', async () => {
    const delegate = createMockDelegate(0);

    await expect(safeStatusUpdate(delegate, 'rec-1', 'draft', { status: 'submitted' }, 2)).rejects.toThrow(
      ConflictError,
    );

    await expect(safeStatusUpdate(delegate, 'rec-1', 'draft', { status: 'submitted' }, 2)).rejects.toThrow(
      /Document was modified by another user/,
    );
  });

  it('handles expectedVersion of 0 correctly', async () => {
    const delegate = createMockDelegate(1);

    const result = await safeStatusUpdate(delegate, 'rec-1', 'draft', { status: 'submitted' }, 0);

    expect(result).toEqual({ count: 1, newVersion: 1 });
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec-1', status: 'draft', version: 0 },
      data: { status: 'submitted', version: 1 },
    });
  });
});

describe('safeStatusUpdateTx', () => {
  it('delegates to safeStatusUpdate with the same args', async () => {
    const txDelegate = createMockDelegate(1);

    const result = await safeStatusUpdateTx(txDelegate, 'rec-1', 'draft', {
      status: 'submitted',
    });

    expect(result).toEqual({ count: 1, newVersion: undefined });
    expect(txDelegate.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec-1', status: 'draft' },
      data: { status: 'submitted' },
    });
  });

  it('throws ConflictError on concurrent modification in transaction', async () => {
    const txDelegate = createMockDelegate(0);

    await expect(safeStatusUpdateTx(txDelegate, 'rec-1', 'draft', { status: 'submitted' })).rejects.toThrow(
      ConflictError,
    );
  });

  it('supports version-based optimistic locking in transactions', async () => {
    const txDelegate = createMockDelegate(1);

    const result = await safeStatusUpdateTx(txDelegate, 'rec-1', 'draft', { status: 'submitted' }, 5);

    expect(result).toEqual({ count: 1, newVersion: 6 });
    expect(txDelegate.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec-1', status: 'draft', version: 5 },
      data: { status: 'submitted', version: 6 },
    });
  });
});
