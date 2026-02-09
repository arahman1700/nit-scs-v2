import { describe, it, expect } from 'vitest';
import { canTransition, getNextStatuses, isTerminalStatus, assertTransition, getAllStatuses } from './stateMachine.js';

describe('stateMachine', () => {
  describe('canTransition', () => {
    it('allows valid MRRV transitions', () => {
      expect(canTransition('mrrv', 'draft', 'pending_qc')).toBe(true);
      expect(canTransition('mrrv', 'pending_qc', 'qc_approved')).toBe(true);
      expect(canTransition('mrrv', 'qc_approved', 'received')).toBe(true);
      expect(canTransition('mrrv', 'received', 'stored')).toBe(true);
    });

    it('rejects invalid MRRV transitions', () => {
      expect(canTransition('mrrv', 'draft', 'stored')).toBe(false);
      expect(canTransition('mrrv', 'stored', 'draft')).toBe(false);
      expect(canTransition('mrrv', 'draft', 'received')).toBe(false);
    });

    it('allows valid MIRV transitions', () => {
      expect(canTransition('mirv', 'draft', 'pending_approval')).toBe(true);
      expect(canTransition('mirv', 'pending_approval', 'approved')).toBe(true);
      expect(canTransition('mirv', 'approved', 'issued')).toBe(true);
      expect(canTransition('mirv', 'approved', 'partially_issued')).toBe(true);
    });

    it('rejects invalid MIRV transitions', () => {
      expect(canTransition('mirv', 'draft', 'issued')).toBe(false);
      expect(canTransition('mirv', 'completed', 'draft')).toBe(false);
    });

    it('allows rejected → draft for resubmission', () => {
      expect(canTransition('mrrv', 'rejected', 'draft')).toBe(true);
      expect(canTransition('mirv', 'rejected', 'draft')).toBe(true);
      expect(canTransition('mrv', 'rejected', 'draft')).toBe(true);
      expect(canTransition('jo', 'rejected', 'draft')).toBe(true);
    });

    it('handles JO full lifecycle', () => {
      expect(canTransition('jo', 'draft', 'pending_approval')).toBe(true);
      expect(canTransition('jo', 'pending_approval', 'approved')).toBe(true);
      expect(canTransition('jo', 'approved', 'assigned')).toBe(true);
      expect(canTransition('jo', 'assigned', 'in_progress')).toBe(true);
      expect(canTransition('jo', 'in_progress', 'completed')).toBe(true);
      expect(canTransition('jo', 'completed', 'invoiced')).toBe(true);
    });

    it('returns false for unknown document type', () => {
      expect(canTransition('unknown', 'draft', 'pending')).toBe(false);
    });

    it('returns false for unknown status', () => {
      expect(canTransition('mrrv', 'nonexistent', 'draft')).toBe(false);
    });
  });

  describe('getNextStatuses', () => {
    it('returns valid next statuses for MRRV draft', () => {
      expect(getNextStatuses('mrrv', 'draft')).toEqual(['pending_qc']);
    });

    it('returns multiple options when branching', () => {
      const next = getNextStatuses('mirv', 'pending_approval');
      expect(next).toContain('approved');
      expect(next).toContain('rejected');
    });

    it('returns empty for terminal status', () => {
      expect(getNextStatuses('mrrv', 'stored')).toEqual([]);
      expect(getNextStatuses('mirv', 'completed')).toEqual([]);
      expect(getNextStatuses('jo', 'invoiced')).toEqual([]);
    });

    it('returns empty for unknown doc type', () => {
      expect(getNextStatuses('unknown', 'draft')).toEqual([]);
    });
  });

  describe('isTerminalStatus', () => {
    it('identifies terminal statuses', () => {
      expect(isTerminalStatus('mrrv', 'stored')).toBe(true);
      expect(isTerminalStatus('mirv', 'completed')).toBe(true);
      expect(isTerminalStatus('mirv', 'cancelled')).toBe(true);
      expect(isTerminalStatus('jo', 'invoiced')).toBe(true);
      expect(isTerminalStatus('jo', 'cancelled')).toBe(true);
    });

    it('identifies non-terminal statuses', () => {
      expect(isTerminalStatus('mrrv', 'draft')).toBe(false);
      expect(isTerminalStatus('mirv', 'approved')).toBe(false);
      expect(isTerminalStatus('jo', 'in_progress')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() => assertTransition('mrrv', 'draft', 'pending_qc')).not.toThrow();
    });

    it('throws descriptive error for invalid transitions', () => {
      expect(() => assertTransition('mrrv', 'draft', 'stored')).toThrow(
        /Invalid status transition for mrrv: 'draft' → 'stored'/,
      );
    });

    it('mentions allowed transitions in error message', () => {
      expect(() => assertTransition('mrrv', 'draft', 'stored')).toThrow(/pending_qc/);
    });
  });

  describe('getAllStatuses', () => {
    it('returns all statuses for known doc types', () => {
      expect(getAllStatuses('mrrv').length).toBeGreaterThan(0);
      expect(getAllStatuses('jo').length).toBeGreaterThan(0);
    });

    it('returns empty for unknown doc type', () => {
      expect(getAllStatuses('unknown')).toEqual([]);
    });
  });
});
