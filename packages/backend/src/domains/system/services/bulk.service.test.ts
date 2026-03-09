import { describe, it, expect, vi, beforeEach } from 'vitest';

import { type PrismaMock as _PrismaMock } from '../../../test-utils/prisma-mock.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../inbound/services/grn.service.js', () => ({
  submit: vi.fn(),
  approveQc: vi.fn(),
  receive: vi.fn(),
  store: vi.fn(),
}));
vi.mock('../../outbound/services/mi.service.js', () => ({
  submit: vi.fn(),
  issue: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('../../outbound/services/mrn.service.js', () => ({
  submit: vi.fn(),
  receive: vi.fn(),
  complete: vi.fn(),
}));
vi.mock('../../inbound/services/qci.service.js', () => ({ start: vi.fn() }));
vi.mock('../../inbound/services/dr.service.js', () => ({ sendClaim: vi.fn() }));
vi.mock('../../job-orders/services/job-order.service.js', () => ({
  submit: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('../../logistics/services/gate-pass.service.js', () => ({
  submit: vi.fn(),
  approve: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('../../transfers/services/stock-transfer.service.js', () => ({
  submit: vi.fn(),
  approve: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('../../outbound/services/mr.service.js', () => ({ submit: vi.fn(), cancel: vi.fn() }));
vi.mock('../../logistics/services/shipment.service.js', () => ({ deliver: vi.fn(), cancel: vi.fn() }));

import * as grnService from '../../inbound/services/grn.service.js';
import * as miService from '../../outbound/services/mi.service.js';
import * as mrnService from '../../outbound/services/mrn.service.js';
import * as qciService from '../../inbound/services/qci.service.js';
import * as drService from '../../inbound/services/dr.service.js';
import * as joService from '../../job-orders/services/job-order.service.js';
import * as gatePassService from '../../logistics/services/gate-pass.service.js';
import * as stService from '../../transfers/services/stock-transfer.service.js';
import * as mrService from '../../outbound/services/mr.service.js';
import * as shipmentService from '../../logistics/services/shipment.service.js';

import { executeBulkAction, getAvailableBulkActions } from './bulk.service.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('bulk.service', () => {
  const userId = 'user-001';
  const mockIo = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // executeBulkAction
  // ---------------------------------------------------------------------------
  describe('executeBulkAction', () => {
    it('calls grn submit handler for grn/submit', async () => {
      vi.mocked(grnService.submit).mockResolvedValue(undefined);

      await executeBulkAction('grn', ['id-1'], 'submit', userId);

      expect(grnService.submit).toHaveBeenCalledWith('id-1');
    });

    it('calls grn submit handler for V1 alias mrrv/submit', async () => {
      vi.mocked(grnService.submit).mockResolvedValue(undefined);

      await executeBulkAction('mrrv', ['id-1'], 'submit', userId);

      expect(grnService.submit).toHaveBeenCalledWith('id-1');
    });

    it('calls mi submit handler with userId and io', async () => {
      vi.mocked(miService.submit).mockResolvedValue(undefined);

      await executeBulkAction('mi', ['id-1'], 'submit', userId, mockIo);

      expect(miService.submit).toHaveBeenCalledWith('id-1', userId, mockIo);
    });

    it('calls mi submit handler via V1 alias mirv', async () => {
      vi.mocked(miService.submit).mockResolvedValue(undefined);

      await executeBulkAction('mirv', ['id-1'], 'submit', userId, mockIo);

      expect(miService.submit).toHaveBeenCalledWith('id-1', userId, mockIo);
    });

    it('passes userId to handlers that require it (grn/approve-qc)', async () => {
      vi.mocked(grnService.approveQc).mockResolvedValue(undefined);

      await executeBulkAction('grn', ['id-1'], 'approve-qc', userId);

      expect(grnService.approveQc).toHaveBeenCalledWith('id-1', userId);
    });

    it('passes userId to handlers via V1 alias (mrrv/approve-qc)', async () => {
      vi.mocked(grnService.approveQc).mockResolvedValue(undefined);

      await executeBulkAction('mrrv', ['id-1'], 'approve-qc', userId);

      expect(grnService.approveQc).toHaveBeenCalledWith('id-1', userId);
    });

    it('returns success results when all handlers succeed', async () => {
      vi.mocked(grnService.submit).mockResolvedValue(undefined);

      const results = await executeBulkAction('grn', ['id-1', 'id-2', 'id-3'], 'submit', userId);

      expect(results).toEqual([
        { id: 'id-1', success: true },
        { id: 'id-2', success: true },
        { id: 'id-3', success: true },
      ]);
    });

    it('returns failure results when handlers throw', async () => {
      vi.mocked(grnService.submit).mockRejectedValue(new Error('DB error'));

      const results = await executeBulkAction('grn', ['id-1'], 'submit', userId);

      expect(results).toEqual([{ id: 'id-1', success: false, error: 'DB error' }]);
    });

    it('handles non-Error throws gracefully', async () => {
      vi.mocked(grnService.submit).mockRejectedValue('string-error');

      const results = await executeBulkAction('grn', ['id-1'], 'submit', userId);

      expect(results).toEqual([{ id: 'id-1', success: false, error: 'Unknown error' }]);
    });

    it('handles mix of success and failure across multiple ids', async () => {
      vi.mocked(mrnService.submit)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(undefined);

      const results = await executeBulkAction('mrn', ['a', 'b', 'c'], 'submit', userId);

      expect(results).toEqual([
        { id: 'a', success: true },
        { id: 'b', success: false, error: 'Not found' },
        { id: 'c', success: true },
      ]);
    });

    it('returns error for unsupported action on known document type', async () => {
      const results = await executeBulkAction('grn', ['id-1', 'id-2'], 'nonexistent', userId);

      expect(results).toEqual([
        { id: 'id-1', success: false, error: 'Action "nonexistent" is not supported for bulk operations on "grn"' },
        { id: 'id-2', success: false, error: 'Action "nonexistent" is not supported for bulk operations on "grn"' },
      ]);
    });

    it('returns error for unknown document type', async () => {
      const results = await executeBulkAction('unknown', ['id-1'], 'submit', userId);

      expect(results).toEqual([
        { id: 'id-1', success: false, error: 'Action "submit" is not supported for bulk operations on "unknown"' },
      ]);
    });

    it('processes ids sequentially, not in parallel', async () => {
      const callOrder: string[] = [];

      vi.mocked(shipmentService.deliver).mockImplementation(async (id: string) => {
        callOrder.push(`start-${id}`);
        await new Promise(r => setTimeout(r, 10));
        callOrder.push(`end-${id}`);
      });

      await executeBulkAction('shipment', ['a', 'b', 'c'], 'deliver', userId);

      expect(callOrder).toEqual(['start-a', 'end-a', 'start-b', 'end-b', 'start-c', 'end-c']);
    });

    it('delegates to correct service for each document type', async () => {
      // Spot-check several doc types to ensure the handler map is wired correctly
      vi.mocked(qciService.start).mockResolvedValue(undefined);
      vi.mocked(drService.sendClaim).mockResolvedValue(undefined);
      vi.mocked(gatePassService.approve).mockResolvedValue(undefined);
      vi.mocked(stService.cancel).mockResolvedValue(undefined);
      vi.mocked(mrService.cancel).mockResolvedValue(undefined);

      await executeBulkAction('qci', ['r1'], 'start', userId);
      expect(qciService.start).toHaveBeenCalledWith('r1', userId);

      await executeBulkAction('dr', ['o1'], 'send-claim', userId);
      expect(drService.sendClaim).toHaveBeenCalledWith('o1');

      await executeBulkAction('gate-pass', ['gp1'], 'approve', userId);
      expect(gatePassService.approve).toHaveBeenCalledWith('gp1');

      await executeBulkAction('stock-transfer', ['st1'], 'cancel', userId);
      expect(stService.cancel).toHaveBeenCalledWith('st1');

      await executeBulkAction('mr', ['m1'], 'cancel', userId);
      expect(mrService.cancel).toHaveBeenCalledWith('m1');
    });

    it('delegates to correct service via V1 aliases', async () => {
      vi.mocked(qciService.start).mockResolvedValue(undefined);
      vi.mocked(drService.sendClaim).mockResolvedValue(undefined);
      vi.mocked(mrService.cancel).mockResolvedValue(undefined);

      await executeBulkAction('rfim', ['r1'], 'start', userId);
      expect(qciService.start).toHaveBeenCalledWith('r1', userId);

      await executeBulkAction('osd', ['o1'], 'send-claim', userId);
      expect(drService.sendClaim).toHaveBeenCalledWith('o1');

      await executeBulkAction('mrf', ['m1'], 'cancel', userId);
      expect(mrService.cancel).toHaveBeenCalledWith('m1');
    });

    it('passes io to job-order submit handler', async () => {
      vi.mocked(joService.submit).mockResolvedValue(undefined);

      await executeBulkAction('job-order', ['jo-1'], 'submit', userId, mockIo);

      expect(joService.submit).toHaveBeenCalledWith('jo-1', userId, mockIo);
    });

    it('returns empty array when given empty ids list', async () => {
      const results = await executeBulkAction('grn', [], 'submit', userId);

      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getAvailableBulkActions
  // ---------------------------------------------------------------------------
  describe('getAvailableBulkActions', () => {
    it('returns correct actions for grn', () => {
      expect(getAvailableBulkActions('grn')).toEqual(['submit', 'approve-qc', 'receive', 'store']);
    });

    it('returns correct actions for V1 alias mrrv', () => {
      expect(getAvailableBulkActions('mrrv')).toEqual(['submit', 'approve-qc', 'receive', 'store']);
    });

    it('returns correct actions for mi', () => {
      expect(getAvailableBulkActions('mi')).toEqual(['submit', 'issue', 'cancel']);
    });

    it('returns correct actions for V1 alias mirv', () => {
      expect(getAvailableBulkActions('mirv')).toEqual(['submit', 'issue', 'cancel']);
    });

    it('returns correct actions for shipment', () => {
      expect(getAvailableBulkActions('shipment')).toEqual(['deliver', 'cancel']);
    });

    it('returns empty array for unknown document type', () => {
      expect(getAvailableBulkActions('nonexistent')).toEqual([]);
    });
  });
});
