import { describe, it, expect } from 'vitest';
import { canTransition, getNextStatuses, isTerminalStatus, assertTransition, getAllStatuses } from './stateMachine.js';

describe('stateMachine', () => {
  describe('canTransition', () => {
    it('allows valid GRN transitions', () => {
      expect(canTransition('grn', 'draft', 'pending_qc')).toBe(true);
      expect(canTransition('grn', 'pending_qc', 'qc_approved')).toBe(true);
      expect(canTransition('grn', 'qc_approved', 'received')).toBe(true);
      expect(canTransition('grn', 'received', 'stored')).toBe(true);
    });

    it('rejects invalid GRN transitions', () => {
      expect(canTransition('grn', 'draft', 'stored')).toBe(false);
      expect(canTransition('grn', 'stored', 'draft')).toBe(false);
      expect(canTransition('grn', 'draft', 'received')).toBe(false);
    });

    it('allows valid MI transitions', () => {
      expect(canTransition('mi', 'draft', 'pending_approval')).toBe(true);
      expect(canTransition('mi', 'pending_approval', 'approved')).toBe(true);
      expect(canTransition('mi', 'approved', 'issued')).toBe(true);
      expect(canTransition('mi', 'approved', 'partially_issued')).toBe(true);
    });

    it('rejects invalid MI transitions', () => {
      expect(canTransition('mi', 'draft', 'issued')).toBe(false);
      expect(canTransition('mi', 'completed', 'draft')).toBe(false);
    });

    it('allows rejected → draft for resubmission', () => {
      expect(canTransition('grn', 'rejected', 'draft')).toBe(true);
      expect(canTransition('mi', 'rejected', 'draft')).toBe(true);
      expect(canTransition('mrn', 'rejected', 'draft')).toBe(true);
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
      expect(canTransition('grn', 'nonexistent', 'draft')).toBe(false);
    });
  });

  describe('getNextStatuses', () => {
    it('returns valid next statuses for GRN draft', () => {
      expect(getNextStatuses('grn', 'draft')).toEqual(['pending_qc']);
    });

    it('returns multiple options when branching', () => {
      const next = getNextStatuses('mi', 'pending_approval');
      expect(next).toContain('approved');
      expect(next).toContain('rejected');
    });

    it('returns empty for terminal status', () => {
      expect(getNextStatuses('grn', 'stored')).toEqual([]);
      expect(getNextStatuses('mi', 'completed')).toEqual([]);
      expect(getNextStatuses('jo', 'invoiced')).toEqual([]);
    });

    it('returns empty for unknown doc type', () => {
      expect(getNextStatuses('unknown', 'draft')).toEqual([]);
    });
  });

  describe('isTerminalStatus', () => {
    it('identifies terminal statuses', () => {
      expect(isTerminalStatus('grn', 'stored')).toBe(true);
      expect(isTerminalStatus('mi', 'completed')).toBe(true);
      expect(isTerminalStatus('mi', 'cancelled')).toBe(true);
      expect(isTerminalStatus('jo', 'invoiced')).toBe(true);
      expect(isTerminalStatus('jo', 'cancelled')).toBe(true);
    });

    it('identifies non-terminal statuses', () => {
      expect(isTerminalStatus('grn', 'draft')).toBe(false);
      expect(isTerminalStatus('mi', 'approved')).toBe(false);
      expect(isTerminalStatus('jo', 'in_progress')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() => assertTransition('grn', 'draft', 'pending_qc')).not.toThrow();
    });

    it('throws descriptive error for invalid transitions', () => {
      expect(() => assertTransition('grn', 'draft', 'stored')).toThrow(
        /Invalid status transition for grn: 'draft' → 'stored'/,
      );
    });

    it('mentions allowed transitions in error message', () => {
      expect(() => assertTransition('grn', 'draft', 'stored')).toThrow(/pending_qc/);
    });
  });

  describe('getAllStatuses', () => {
    it('returns all statuses for known doc types', () => {
      expect(getAllStatuses('grn').length).toBeGreaterThan(0);
      expect(getAllStatuses('jo').length).toBeGreaterThan(0);
    });

    it('returns empty for unknown doc type', () => {
      expect(getAllStatuses('unknown')).toEqual([]);
    });
  });
});
