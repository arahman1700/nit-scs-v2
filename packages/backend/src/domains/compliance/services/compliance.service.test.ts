import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { emit: vi.fn() } }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import {
  listChecklists,
  getChecklistById,
  createChecklist,
  updateChecklist,
  listAudits,
  getAuditById,
  createAudit,
  updateAudit,
  submitResponses,
  completeAudit,
} from './compliance.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeChecklist(overrides: Record<string, unknown> = {}) {
  return {
    id: 'checklist-1',
    checklistCode: 'CL-001',
    title: 'Fire Safety',
    standard: 'ISO-45001',
    category: 'safety',
    version: 1,
    isActive: true,
    items: [],
    _count: { audits: 0 },
    ...overrides,
  };
}

function makeAudit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    auditNumber: 'CA-001',
    checklistId: 'checklist-1',
    warehouseId: 'wh-1',
    auditorId: 'user-1',
    auditDate: new Date('2026-01-15'),
    status: 'draft',
    dueDate: null,
    findings: null,
    correctiveActions: null,
    overallScore: null,
    completedDate: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('compliance.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // CHECKLISTS
  // ─────────────────────────────────────────────────────────────────────

  describe('listChecklists', () => {
    const baseParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 25 };

    it('should return data and total', async () => {
      const rows = [makeChecklist()];
      mockPrisma.complianceChecklist.findMany.mockResolvedValue(rows);
      mockPrisma.complianceChecklist.count.mockResolvedValue(1);

      const result = await listChecklists(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause', async () => {
      mockPrisma.complianceChecklist.findMany.mockResolvedValue([]);
      mockPrisma.complianceChecklist.count.mockResolvedValue(0);

      await listChecklists({ ...baseParams, search: 'fire' });

      const where = mockPrisma.complianceChecklist.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
    });

    it('should filter active checklists when status is active', async () => {
      mockPrisma.complianceChecklist.findMany.mockResolvedValue([]);
      mockPrisma.complianceChecklist.count.mockResolvedValue(0);

      await listChecklists({ ...baseParams, status: 'active' });

      const where = mockPrisma.complianceChecklist.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });

    it('should filter inactive checklists when status is inactive', async () => {
      mockPrisma.complianceChecklist.findMany.mockResolvedValue([]);
      mockPrisma.complianceChecklist.count.mockResolvedValue(0);

      await listChecklists({ ...baseParams, status: 'inactive' });

      const where = mockPrisma.complianceChecklist.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(false);
    });

    it('should apply standard and category filters', async () => {
      mockPrisma.complianceChecklist.findMany.mockResolvedValue([]);
      mockPrisma.complianceChecklist.count.mockResolvedValue(0);

      await listChecklists({ ...baseParams, standard: 'ISO-9001', category: 'quality' } as any);

      const where = mockPrisma.complianceChecklist.findMany.mock.calls[0][0].where;
      expect(where.standard).toBe('ISO-9001');
      expect(where.category).toBe('quality');
    });

    it('should pass pagination parameters', async () => {
      mockPrisma.complianceChecklist.findMany.mockResolvedValue([]);
      mockPrisma.complianceChecklist.count.mockResolvedValue(0);

      await listChecklists({ ...baseParams, skip: 10, pageSize: 5 });

      const args = mockPrisma.complianceChecklist.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
    });
  });

  describe('getChecklistById', () => {
    it('should return checklist when found', async () => {
      const checklist = makeChecklist();
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(checklist);

      const result = await getChecklistById('checklist-1');

      expect(result).toEqual(checklist);
      expect(mockPrisma.complianceChecklist.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'checklist-1' } }),
      );
    });

    it('should throw NotFoundError when checklist not found', async () => {
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(null);

      await expect(getChecklistById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createChecklist', () => {
    const data = {
      checklistCode: 'CL-002',
      title: 'Warehouse Safety',
      standard: 'ISO-45001',
      category: 'safety',
    };

    it('should create a checklist with default version and isActive', async () => {
      const created = makeChecklist({ id: 'checklist-2', checklistCode: 'CL-002' });
      mockPrisma.complianceChecklist.create.mockResolvedValue(created);

      const result = await createChecklist(data);

      expect(result).toEqual(created);
      const createArgs = mockPrisma.complianceChecklist.create.mock.calls[0][0];
      expect(createArgs.data.version).toBe(1);
      expect(createArgs.data.isActive).toBe(true);
    });

    it('should create checklist with nested items', async () => {
      const items = [
        { itemNumber: 1, question: 'Fire extinguisher present?', weight: 2 },
        { itemNumber: 2, question: 'Exit signs visible?', weight: 1 },
      ];
      const created = makeChecklist({ items });
      mockPrisma.complianceChecklist.create.mockResolvedValue(created);

      await createChecklist({ ...data, items });

      const createArgs = mockPrisma.complianceChecklist.create.mock.calls[0][0];
      expect(createArgs.data.items.create).toHaveLength(2);
      expect(createArgs.data.items.create[0].question).toBe('Fire extinguisher present?');
      expect(createArgs.data.items.create[0].weight).toBe(2);
    });

    it('should set optional item fields to null when not provided', async () => {
      const items = [{ itemNumber: 1, question: 'Test question' }];
      mockPrisma.complianceChecklist.create.mockResolvedValue(makeChecklist());

      await createChecklist({ ...data, items });

      const createArgs = mockPrisma.complianceChecklist.create.mock.calls[0][0];
      expect(createArgs.data.items.create[0].category).toBeNull();
      expect(createArgs.data.items.create[0].requiredEvidence).toBeNull();
      expect(createArgs.data.items.create[0].weight).toBe(1);
    });

    it('should not include items create when items not provided', async () => {
      mockPrisma.complianceChecklist.create.mockResolvedValue(makeChecklist());

      await createChecklist(data);

      const createArgs = mockPrisma.complianceChecklist.create.mock.calls[0][0];
      expect(createArgs.data.items).toBeUndefined();
    });
  });

  describe('updateChecklist', () => {
    it('should update a checklist when found', async () => {
      const existing = makeChecklist();
      const updated = makeChecklist({ title: 'Updated Title' });
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(existing);
      mockPrisma.complianceChecklist.update.mockResolvedValue(updated);

      const result = await updateChecklist('checklist-1', { title: 'Updated Title' });

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when checklist not found', async () => {
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(null);

      await expect(updateChecklist('nonexistent', { title: 'New' })).rejects.toThrow(NotFoundError);
    });

    it('should replace items when items are provided', async () => {
      const existing = makeChecklist();
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(existing);
      mockPrisma.complianceChecklistItem.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.complianceChecklistItem.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.complianceChecklist.update.mockResolvedValue(existing);

      const newItems = [
        { itemNumber: 1, question: 'New Q1' },
        { itemNumber: 2, question: 'New Q2' },
      ];
      await updateChecklist('checklist-1', { items: newItems });

      expect(mockPrisma.complianceChecklistItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { checklistId: 'checklist-1' } }),
      );
      expect(mockPrisma.complianceChecklistItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ checklistId: 'checklist-1', question: 'New Q1' })]),
        }),
      );
    });

    it('should not touch items when items are not provided', async () => {
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(makeChecklist());
      mockPrisma.complianceChecklist.update.mockResolvedValue(makeChecklist());

      await updateChecklist('checklist-1', { title: 'Only title' });

      expect(mockPrisma.complianceChecklistItem.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.complianceChecklistItem.createMany).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // AUDITS
  // ─────────────────────────────────────────────────────────────────────

  describe('listAudits', () => {
    const baseParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 25 };

    it('should return data and total', async () => {
      const rows = [makeAudit()];
      mockPrisma.complianceAudit.findMany.mockResolvedValue(rows);
      mockPrisma.complianceAudit.count.mockResolvedValue(1);

      const result = await listAudits(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter', async () => {
      mockPrisma.complianceAudit.findMany.mockResolvedValue([]);
      mockPrisma.complianceAudit.count.mockResolvedValue(0);

      await listAudits({ ...baseParams, search: 'CA-001' });

      const where = mockPrisma.complianceAudit.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(3);
    });

    it('should apply status, warehouseId, checklistId, and auditorId filters', async () => {
      mockPrisma.complianceAudit.findMany.mockResolvedValue([]);
      mockPrisma.complianceAudit.count.mockResolvedValue(0);

      await listAudits({
        ...baseParams,
        status: 'draft',
        warehouseId: 'wh-1',
        checklistId: 'cl-1',
        auditorId: 'user-1',
      } as any);

      const where = mockPrisma.complianceAudit.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('draft');
      expect(where.warehouseId).toBe('wh-1');
      expect(where.checklistId).toBe('cl-1');
      expect(where.auditorId).toBe('user-1');
    });
  });

  describe('getAuditById', () => {
    it('should return audit when found', async () => {
      const audit = makeAudit();
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(audit);

      const result = await getAuditById('audit-1');

      expect(result).toEqual(audit);
    });

    it('should throw NotFoundError when audit not found', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(null);

      await expect(getAuditById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createAudit', () => {
    const data = {
      checklistId: 'checklist-1',
      warehouseId: 'wh-1',
      auditDate: '2026-01-15',
    };

    it('should create audit with generated document number', async () => {
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(makeChecklist());
      mockedGenDoc.mockResolvedValue('CA-001');
      const created = makeAudit();
      mockPrisma.complianceAudit.create.mockResolvedValue(created);

      const result = await createAudit(data, 'user-1');

      expect(result).toEqual(created);
      expect(mockedGenDoc).toHaveBeenCalledWith('compliance_audit');
    });

    it('should set status to draft and auditorId to userId', async () => {
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(makeChecklist());
      mockedGenDoc.mockResolvedValue('CA-002');
      mockPrisma.complianceAudit.create.mockResolvedValue(makeAudit());

      await createAudit(data, 'user-42');

      const createArgs = mockPrisma.complianceAudit.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('draft');
      expect(createArgs.data.auditorId).toBe('user-42');
    });

    it('should throw NotFoundError when checklist does not exist', async () => {
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(null);

      await expect(createAudit(data, 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when checklist is inactive', async () => {
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(makeChecklist({ isActive: false }));

      await expect(createAudit(data, 'user-1')).rejects.toThrow(BusinessRuleError);
      await expect(createAudit(data, 'user-1')).rejects.toThrow('Cannot create audit for inactive checklist');
    });

    it('should handle optional dueDate, findings, and correctiveActions', async () => {
      mockPrisma.complianceChecklist.findUnique.mockResolvedValue(makeChecklist());
      mockedGenDoc.mockResolvedValue('CA-003');
      mockPrisma.complianceAudit.create.mockResolvedValue(makeAudit());

      await createAudit(
        {
          ...data,
          dueDate: '2026-02-15',
          findings: 'Some findings',
          correctiveActions: 'Fix it',
        },
        'user-1',
      );

      const createArgs = mockPrisma.complianceAudit.create.mock.calls[0][0];
      expect(createArgs.data.dueDate).toEqual(new Date('2026-02-15'));
      expect(createArgs.data.findings).toBe('Some findings');
      expect(createArgs.data.correctiveActions).toBe('Fix it');
    });
  });

  describe('updateAudit', () => {
    it('should update audit when found and not completed', async () => {
      const existing = makeAudit({ status: 'draft' });
      const updated = makeAudit({ findings: 'Updated findings' });
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(existing);
      mockPrisma.complianceAudit.update.mockResolvedValue(updated);

      const result = await updateAudit('audit-1', { findings: 'Updated findings' });

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when audit not found', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(null);

      await expect(updateAudit('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when audit is completed', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(makeAudit({ status: 'completed' }));

      await expect(updateAudit('audit-1', { findings: 'test' })).rejects.toThrow('Cannot update a completed audit');
    });

    it('should convert auditDate and dueDate strings to Date objects', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(makeAudit({ status: 'in_progress' }));
      mockPrisma.complianceAudit.update.mockResolvedValue(makeAudit());

      await updateAudit('audit-1', { auditDate: '2026-03-01', dueDate: '2026-04-01' });

      const updateArgs = mockPrisma.complianceAudit.update.mock.calls[0][0];
      expect(updateArgs.data.auditDate).toEqual(new Date('2026-03-01'));
      expect(updateArgs.data.dueDate).toEqual(new Date('2026-04-01'));
    });

    it('should set dueDate to null when empty string provided', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(makeAudit({ status: 'draft' }));
      mockPrisma.complianceAudit.update.mockResolvedValue(makeAudit());

      await updateAudit('audit-1', { dueDate: '' });

      const updateArgs = mockPrisma.complianceAudit.update.mock.calls[0][0];
      expect(updateArgs.data.dueDate).toBeNull();
    });
  });

  describe('submitResponses', () => {
    const responses = [
      { checklistItemId: 'item-1', response: 'compliant', score: 100 },
      { checklistItemId: 'item-2', response: 'non_compliant', notes: 'Missing' },
    ];

    it('should submit responses and return updated audit', async () => {
      const audit = makeAudit({ status: 'draft' });
      mockPrisma.complianceAudit.findUnique
        .mockResolvedValueOnce(audit) // initial check
        .mockResolvedValueOnce({ ...audit, status: 'in_progress' }); // after transaction
      mockPrisma.complianceAuditResponse.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.complianceAuditResponse.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.complianceAudit.update.mockResolvedValue({ ...audit, status: 'in_progress' });

      const result = await submitResponses('audit-1', responses);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundError when audit not found', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(null);

      await expect(submitResponses('nonexistent', responses)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when audit is completed', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(makeAudit({ status: 'completed' }));

      await expect(submitResponses('audit-1', responses)).rejects.toThrow(
        'Cannot submit responses for a completed audit',
      );
    });

    it('should update draft audit status to in_progress', async () => {
      const audit = makeAudit({ status: 'draft' });
      mockPrisma.complianceAudit.findUnique
        .mockResolvedValueOnce(audit)
        .mockResolvedValueOnce({ ...audit, status: 'in_progress' });
      mockPrisma.complianceAuditResponse.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.complianceAuditResponse.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.complianceAudit.update.mockResolvedValue({ ...audit, status: 'in_progress' });

      await submitResponses('audit-1', responses);

      // The $transaction callback should have been invoked
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should not change status when audit is already in_progress', async () => {
      const audit = makeAudit({ status: 'in_progress' });
      mockPrisma.complianceAudit.findUnique.mockResolvedValueOnce(audit).mockResolvedValueOnce(audit);
      mockPrisma.complianceAuditResponse.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.complianceAuditResponse.createMany.mockResolvedValue({ count: 1 });

      await submitResponses('audit-1', [{ checklistItemId: 'item-1', response: 'compliant' }]);

      // The audit.update for status should NOT be called inside the transaction
      // because status is not 'draft'
      expect(mockPrisma.complianceAudit.update).not.toHaveBeenCalled();
    });
  });

  describe('completeAudit', () => {
    function makeAuditWithResponses(overrides: Record<string, unknown> = {}) {
      return {
        id: 'audit-1',
        auditNumber: 'CA-001',
        status: 'in_progress',
        auditorId: 'user-1',
        checklist: {
          items: [
            { id: 'item-1', weight: 2 },
            { id: 'item-2', weight: 1 },
          ],
        },
        responses: [
          { checklistItemId: 'item-1', response: 'compliant', checklistItem: { weight: 2 } },
          { checklistItemId: 'item-2', response: 'compliant', checklistItem: { weight: 1 } },
        ],
        ...overrides,
      };
    }

    it('should complete audit with 100% score when all compliant', async () => {
      const audit = makeAuditWithResponses();
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(audit);
      mockPrisma.complianceAudit.update.mockResolvedValue({
        ...audit,
        status: 'completed',
        overallScore: 100,
      });

      const result = await completeAudit('audit-1', 'user-1');

      expect(result.status).toBe('completed');
      expect(result.overallScore).toBe(100);
    });

    it('should throw NotFoundError when audit not found', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(null);

      await expect(completeAudit('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when audit is already completed', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(makeAuditWithResponses({ status: 'completed' }));

      await expect(completeAudit('audit-1', 'user-1')).rejects.toThrow('Audit is already completed');
    });

    it('should throw BusinessRuleError when user is not the assigned auditor', async () => {
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(makeAuditWithResponses({ auditorId: 'other-user' }));

      await expect(completeAudit('audit-1', 'user-1')).rejects.toThrow(
        'Only the assigned auditor can complete this audit',
      );
    });

    it('should throw BusinessRuleError when not all checklist items have responses', async () => {
      const audit = makeAuditWithResponses({
        responses: [
          { checklistItemId: 'item-1', response: 'compliant', checklistItem: { weight: 2 } },
          // item-2 is missing
        ],
      });
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(audit);

      await expect(completeAudit('audit-1', 'user-1')).rejects.toThrow(
        /All checklist items must have responses.*Missing 1 response/,
      );
    });

    it('should set status to action_required when score < 80', async () => {
      const audit = makeAuditWithResponses({
        responses: [
          { checklistItemId: 'item-1', response: 'partial', checklistItem: { weight: 2 } },
          { checklistItemId: 'item-2', response: 'non_compliant', checklistItem: { weight: 1 } },
        ],
      });
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(audit);
      mockPrisma.complianceAudit.update.mockImplementation(async (args: any) => ({
        ...audit,
        status: args.data.status,
        overallScore: args.data.overallScore,
      }));

      const result = await completeAudit('audit-1', 'user-1');

      expect(result.status).toBe('action_required');
    });

    it('should set status to action_required when any response is non_compliant', async () => {
      // Even with high score, if any item is non_compliant, set action_required
      const audit = makeAuditWithResponses({
        checklist: {
          items: [
            { id: 'item-1', weight: 10 },
            { id: 'item-2', weight: 1 },
          ],
        },
        responses: [
          { checklistItemId: 'item-1', response: 'compliant', checklistItem: { weight: 10 } },
          { checklistItemId: 'item-2', response: 'non_compliant', checklistItem: { weight: 1 } },
        ],
      });
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(audit);
      mockPrisma.complianceAudit.update.mockImplementation(async (args: any) => ({
        ...audit,
        status: args.data.status,
        overallScore: args.data.overallScore,
      }));

      const result = await completeAudit('audit-1', 'user-1');

      expect(result.status).toBe('action_required');
    });

    it('should exclude not_applicable responses from score calculation', async () => {
      const audit = makeAuditWithResponses({
        responses: [
          { checklistItemId: 'item-1', response: 'compliant', checklistItem: { weight: 2 } },
          { checklistItemId: 'item-2', response: 'not_applicable', checklistItem: { weight: 1 } },
        ],
      });
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(audit);
      mockPrisma.complianceAudit.update.mockImplementation(async (args: any) => ({
        ...audit,
        status: args.data.status,
        overallScore: args.data.overallScore,
      }));

      const result = await completeAudit('audit-1', 'user-1');

      // Only item-1 is scored: 100 * 2 / 2 = 100
      expect(result.overallScore).toBe(100);
      expect(result.status).toBe('completed');
    });

    it('should calculate weighted score correctly for mixed responses', async () => {
      const audit = makeAuditWithResponses({
        checklist: {
          items: [
            { id: 'item-1', weight: 3 },
            { id: 'item-2', weight: 1 },
          ],
        },
        responses: [
          { checklistItemId: 'item-1', response: 'compliant', checklistItem: { weight: 3 } },
          { checklistItemId: 'item-2', response: 'partial', checklistItem: { weight: 1 } },
        ],
      });
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(audit);
      mockPrisma.complianceAudit.update.mockImplementation(async (args: any) => ({
        ...audit,
        status: args.data.status,
        overallScore: args.data.overallScore,
      }));

      const result = await completeAudit('audit-1', 'user-1');

      // weighted = (100*3 + 50*1) / (3+1) = 350/4 = 87.5
      expect(result.overallScore).toBe(87.5);
      expect(result.status).toBe('completed');
    });

    it('should return 0 score when all responses are not_applicable', async () => {
      const audit = makeAuditWithResponses({
        responses: [
          { checklistItemId: 'item-1', response: 'not_applicable', checklistItem: { weight: 2 } },
          { checklistItemId: 'item-2', response: 'not_applicable', checklistItem: { weight: 1 } },
        ],
      });
      mockPrisma.complianceAudit.findUnique.mockResolvedValue(audit);
      mockPrisma.complianceAudit.update.mockImplementation(async (args: any) => ({
        ...audit,
        status: args.data.status,
        overallScore: args.data.overallScore,
      }));

      const result = await completeAudit('audit-1', 'user-1');

      // totalWeight = 0, so score = 0
      expect(result.overallScore).toBe(0);
    });
  });
});
