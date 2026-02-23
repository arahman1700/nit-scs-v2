import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('./document-number.service.js', () => ({
  generateDocumentNumber: vi.fn().mockResolvedValue('DYN-2026-0001'),
}));
vi.mock('./dynamic-validation.service.js', () => ({
  validateDynamicData: vi.fn().mockReturnValue([]),
  validateDynamicLines: vi.fn().mockReturnValue([]),
}));
vi.mock('./dynamic-document-type.service.js', () => ({
  getDocumentTypeByCode: vi.fn(),
}));
vi.mock('./approval.service.js', () => ({
  isAuthorizedApprover: vi.fn().mockResolvedValue(true),
  getApprovalSteps: vi.fn().mockResolvedValue([]),
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { getDocumentTypeByCode } from './dynamic-document-type.service.js';
import { validateDynamicData, validateDynamicLines } from './dynamic-validation.service.js';
import { isAuthorizedApprover, getApprovalSteps } from './approval.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import {
  listDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  transitionDocument,
  approveDocument,
  getDocumentHistory,
  DynamicValidationError,
} from './dynamic-document.service.js';

// ── Local helper: create a model mock for models not in PrismaMock ──────

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────

const MOCK_STATUS_FLOW = {
  initialStatus: 'draft',
  statuses: [
    { key: 'draft', label: 'Draft', color: 'gray' },
    { key: 'submitted', label: 'Submitted', color: 'blue' },
    { key: 'approved', label: 'Approved', color: 'green' },
    { key: 'rejected', label: 'Rejected', color: 'red' },
  ],
  transitions: {
    draft: ['submitted'],
    submitted: ['approved', 'rejected'],
  },
};

const MOCK_DOC_TYPE = {
  id: 'type-1',
  code: 'WO',
  name: 'Work Order',
  fields: [],
  statusFlow: MOCK_STATUS_FLOW,
  settings: { numberPrefix: 'WO' },
  approvalConfig: null,
};

const MOCK_DOC_TYPE_WITH_APPROVAL = {
  ...MOCK_DOC_TYPE,
  approvalConfig: {
    levels: [
      { role: 'warehouse_manager', level: 1 },
      { role: 'project_manager', level: 2 },
    ],
  },
};

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    documentTypeId: 'type-1',
    documentNumber: 'DYN-2026-0001',
    status: 'draft',
    data: { description: 'Test' },
    projectId: null,
    warehouseId: null,
    createdById: 'user-1',
    updatedById: 'user-1',
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    documentType: MOCK_DOC_TYPE,
    lines: [],
    ...overrides,
  };
}

function makeDocumentWithFields(overrides: Record<string, unknown> = {}) {
  return {
    ...makeDocument(),
    documentType: {
      ...MOCK_DOC_TYPE,
      fields: [
        { id: 'f1', fieldKey: 'description', label: 'Description', fieldType: 'text', isRequired: true, sortOrder: 1 },
      ],
    },
    ...overrides,
  };
}

function makeApprovalStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    documentType: 'dynamic_WO',
    documentId: 'doc-1',
    level: 1,
    approverRole: 'warehouse_manager',
    status: 'pending',
    approverId: null,
    notes: null,
    decidedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════

describe('dynamic-document.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    // Add dynamicDocumentLine and dynamicDocumentHistory (not in PrismaMock interface)
    (mockPrisma as Record<string, unknown>).dynamicDocumentLine = createModelMock();
    (mockPrisma as Record<string, unknown>).dynamicDocumentHistory = createModelMock();

    // Override $transaction so it passes mockPrisma (with extra models) as tx
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });

    // Default: getDocumentTypeByCode returns the basic doc type
    vi.mocked(getDocumentTypeByCode).mockResolvedValue(MOCK_DOC_TYPE as never);
    // Default: validation passes
    vi.mocked(validateDynamicData).mockReturnValue([]);
    vi.mocked(validateDynamicLines).mockReturnValue([]);
  });

  // ─── DynamicValidationError ──────────────────────────────────────────

  describe('DynamicValidationError', () => {
    it('sets name, statusCode, message, and fieldErrors', () => {
      const errors = [
        { field: 'title', message: 'Title is required' },
        { field: 'qty', message: 'Qty must be positive' },
      ];
      const err = new DynamicValidationError(errors);

      expect(err.name).toBe('DynamicValidationError');
      expect(err.statusCode).toBe(422);
      expect(err.fieldErrors).toEqual(errors);
      expect(err.message).toBe('Validation failed: Title is required, Qty must be positive');
    });

    it('is an instance of Error', () => {
      const err = new DynamicValidationError([{ field: 'x', message: 'bad' }]);
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ─── listDocuments ───────────────────────────────────────────────────

  describe('listDocuments', () => {
    const baseParams = { skip: 0, pageSize: 20, sortBy: 'createdAt', sortDir: 'desc' as const };

    it('returns paginated data and total', async () => {
      const docs = [makeDocument()];
      mockPrisma.dynamicDocument.findMany.mockResolvedValue(docs);
      mockPrisma.dynamicDocument.count.mockResolvedValue(1);

      const result = await listDocuments('WO', baseParams);

      expect(result).toEqual({ data: docs, total: 1 });
      expect(mockPrisma.dynamicDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentTypeId: 'type-1' },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('applies status filter when provided', async () => {
      mockPrisma.dynamicDocument.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocument.count.mockResolvedValue(0);

      await listDocuments('WO', { ...baseParams, status: 'submitted' });

      expect(mockPrisma.dynamicDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'submitted' }),
        }),
      );
    });

    it('applies search filter on documentNumber', async () => {
      mockPrisma.dynamicDocument.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocument.count.mockResolvedValue(0);

      await listDocuments('WO', { ...baseParams, search: 'DYN-2026' });

      expect(mockPrisma.dynamicDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ documentNumber: { contains: 'DYN-2026', mode: 'insensitive' } }],
          }),
        }),
      );
    });

    it('applies projectId filter when provided', async () => {
      mockPrisma.dynamicDocument.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocument.count.mockResolvedValue(0);

      await listDocuments('WO', { ...baseParams, projectId: 'proj-1' });

      expect(mockPrisma.dynamicDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'proj-1' }),
        }),
      );
    });

    it('applies warehouseId filter when provided', async () => {
      mockPrisma.dynamicDocument.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocument.count.mockResolvedValue(0);

      await listDocuments('WO', { ...baseParams, warehouseId: 'wh-1' });

      expect(mockPrisma.dynamicDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: 'wh-1' }),
        }),
      );
    });

    it('returns empty data when no documents match', async () => {
      mockPrisma.dynamicDocument.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocument.count.mockResolvedValue(0);

      const result = await listDocuments('WO', baseParams);

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  // ─── getDocumentById ─────────────────────────────────────────────────

  describe('getDocumentById', () => {
    it('returns document with full includes', async () => {
      const doc = makeDocument();
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);

      const result = await getDocumentById('doc-1');

      expect(result).toEqual(doc);
      expect(mockPrisma.dynamicDocument.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          include: expect.objectContaining({
            documentType: expect.any(Object),
            lines: expect.any(Object),
            history: expect.any(Object),
            project: expect.any(Object),
            warehouse: expect.any(Object),
            createdBy: expect.any(Object),
            updatedBy: expect.any(Object),
          }),
        }),
      );
    });

    it('throws NotFoundError when document does not exist', async () => {
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(null);

      await expect(getDocumentById('nonexistent')).rejects.toThrow('Document not found');
    });
  });

  // ─── createDocument ──────────────────────────────────────────────────

  describe('createDocument', () => {
    const body = { data: { description: 'New work order' } };
    const userId = 'user-1';

    it('creates a document with initial status and history entry', async () => {
      const created = makeDocument({ documentNumber: 'DYN-2026-0001' });
      mockPrisma.dynamicDocument.create.mockResolvedValue(created);

      const result = await createDocument('WO', body, userId);

      expect(result).toEqual(created);
      expect(generateDocumentNumber).toHaveBeenCalledWith('dyn:WO');
      expect(mockPrisma.dynamicDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentTypeId: 'type-1',
            documentNumber: 'DYN-2026-0001',
            status: 'draft',
            data: body.data,
            createdById: userId,
            updatedById: userId,
            history: {
              create: {
                fromStatus: null,
                toStatus: 'draft',
                performedById: userId,
                comment: 'Document created',
              },
            },
          }),
        }),
      );
    });

    it('creates line items when provided', async () => {
      const lines = [
        { itemCode: 'IT-001', qty: 5 },
        { itemCode: 'IT-002', qty: 10 },
      ];
      const created = makeDocument({ lines });
      mockPrisma.dynamicDocument.create.mockResolvedValue(created);

      await createDocument('WO', { data: body.data, lines }, userId);

      expect(mockPrisma.dynamicDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: {
              create: [
                { lineNumber: 1, data: lines[0] },
                { lineNumber: 2, data: lines[1] },
              ],
            },
          }),
        }),
      );
    });

    it('creates approval steps when approvalConfig has levels', async () => {
      vi.mocked(getDocumentTypeByCode).mockResolvedValue(MOCK_DOC_TYPE_WITH_APPROVAL as never);
      const created = makeDocument();
      mockPrisma.dynamicDocument.create.mockResolvedValue(created);
      mockPrisma.approvalStep.createMany.mockResolvedValue({ count: 2 });

      await createDocument('WO', body, userId);

      expect(mockPrisma.approvalStep.createMany).toHaveBeenCalledWith({
        data: [
          {
            documentType: 'dynamic_WO',
            documentId: 'doc-1',
            level: 1,
            approverRole: 'warehouse_manager',
            status: 'pending',
          },
          {
            documentType: 'dynamic_WO',
            documentId: 'doc-1',
            level: 2,
            approverRole: 'project_manager',
            status: 'pending',
          },
        ],
      });
    });

    it('does NOT create approval steps when approvalConfig is null', async () => {
      const created = makeDocument();
      mockPrisma.dynamicDocument.create.mockResolvedValue(created);

      await createDocument('WO', body, userId);

      expect(mockPrisma.approvalStep.createMany).not.toHaveBeenCalled();
    });

    it('throws DynamicValidationError when header validation fails', async () => {
      vi.mocked(validateDynamicData).mockReturnValue([{ field: 'title', message: 'Title is required' }]);

      await expect(createDocument('WO', body, userId)).rejects.toThrow(DynamicValidationError);
      expect(mockPrisma.dynamicDocument.create).not.toHaveBeenCalled();
    });

    it('throws DynamicValidationError when line validation fails', async () => {
      vi.mocked(validateDynamicData).mockReturnValue([]);
      vi.mocked(validateDynamicLines).mockReturnValue([{ field: 'lines[0].qty', message: 'Qty is required' }]);

      const lines = [{ itemCode: 'IT-001' }];
      await expect(createDocument('WO', { data: body.data, lines }, userId)).rejects.toThrow(DynamicValidationError);
      expect(mockPrisma.dynamicDocument.create).not.toHaveBeenCalled();
    });

    it('combines header and line errors in DynamicValidationError', async () => {
      const headerErr = { field: 'title', message: 'Title is required' };
      const lineErr = { field: 'lines[0].qty', message: 'Qty must be positive' };
      vi.mocked(validateDynamicData).mockReturnValue([headerErr]);
      vi.mocked(validateDynamicLines).mockReturnValue([lineErr]);

      const lines = [{ qty: -1 }];
      try {
        await createDocument('WO', { data: body.data, lines }, userId);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(DynamicValidationError);
        expect((err as DynamicValidationError).fieldErrors).toEqual([headerErr, lineErr]);
      }
    });

    it('passes projectId and warehouseId to create', async () => {
      const created = makeDocument({ projectId: 'proj-1', warehouseId: 'wh-1' });
      mockPrisma.dynamicDocument.create.mockResolvedValue(created);

      await createDocument('WO', { ...body, projectId: 'proj-1', warehouseId: 'wh-1' }, userId);

      expect(mockPrisma.dynamicDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            warehouseId: 'wh-1',
          }),
        }),
      );
    });
  });

  // ─── updateDocument ──────────────────────────────────────────────────

  describe('updateDocument', () => {
    const userId = 'user-1';

    it('updates document data and increments version', async () => {
      const existing = makeDocumentWithFields({ status: 'draft' });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, data: { description: 'Updated' }, version: 2 };
      mockPrisma.dynamicDocument.update.mockResolvedValue(updated);

      const result = await updateDocument('doc-1', { data: { description: 'Updated' } }, userId);

      expect(result.updated).toEqual(updated);
      expect(mockPrisma.dynamicDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: { description: 'Updated' },
            updatedById: userId,
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('replaces lines when new lines are provided', async () => {
      const existing = makeDocumentWithFields({ status: 'draft' });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(existing);
      const lineMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentLine;
      lineMock.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.dynamicDocument.update.mockResolvedValue({ ...existing, version: 2 });

      const newLines = [{ item: 'A', qty: 3 }];
      await updateDocument('doc-1', { data: { description: 'test' }, lines: newLines }, userId);

      expect(lineMock.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc-1' } });
      expect(mockPrisma.dynamicDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: {
              create: [{ lineNumber: 1, data: newLines[0] }],
            },
          }),
        }),
      );
    });

    it('throws NotFoundError when document does not exist', async () => {
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(null);

      await expect(updateDocument('nonexistent', { data: {} }, userId)).rejects.toThrow('Document not found');
    });

    it('throws error when document is in non-editable status', async () => {
      // 'approved' has no outgoing transitions -> not editable
      const existing = makeDocumentWithFields({ status: 'approved' });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(existing);

      await expect(updateDocument('doc-1', { data: { x: 1 } }, userId)).rejects.toThrow(
        "Cannot edit document in 'approved' status",
      );
      expect(mockPrisma.dynamicDocument.update).not.toHaveBeenCalled();
    });

    it('allows editing when document is in draft (editable) status', async () => {
      const existing = makeDocumentWithFields({ status: 'draft' });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(existing);
      mockPrisma.dynamicDocument.update.mockResolvedValue({ ...existing, version: 2 });

      await expect(updateDocument('doc-1', { data: { x: 1 } }, userId)).resolves.toBeDefined();
    });

    it('allows editing when document is in submitted (has outgoing transitions) status', async () => {
      const existing = makeDocumentWithFields({ status: 'submitted' });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(existing);
      mockPrisma.dynamicDocument.update.mockResolvedValue({ ...existing, version: 2 });

      await expect(updateDocument('doc-1', { data: { x: 1 } }, userId)).resolves.toBeDefined();
    });

    it('throws DynamicValidationError when data validation fails', async () => {
      const existing = makeDocumentWithFields({ status: 'draft' });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(existing);
      vi.mocked(validateDynamicData).mockReturnValue([{ field: 'title', message: 'Required' }]);

      await expect(updateDocument('doc-1', { data: { title: '' } }, userId)).rejects.toThrow(DynamicValidationError);
      expect(mockPrisma.dynamicDocument.update).not.toHaveBeenCalled();
    });

    it('returns both existing and updated documents', async () => {
      const existing = makeDocumentWithFields({ status: 'draft' });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, data: { description: 'Updated' }, version: 2 };
      mockPrisma.dynamicDocument.update.mockResolvedValue(updated);

      const result = await updateDocument('doc-1', { data: { description: 'Updated' } }, userId);

      expect(result).toHaveProperty('existing');
      expect(result).toHaveProperty('updated');
      expect(result.existing).toEqual(existing);
      expect(result.updated).toEqual(updated);
    });
  });

  // ─── transitionDocument ──────────────────────────────────────────────

  describe('transitionDocument', () => {
    const userId = 'user-1';

    it('transitions from draft to submitted', async () => {
      const doc = makeDocument({ status: 'draft', documentType: MOCK_DOC_TYPE });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      const transitioned = { ...doc, status: 'submitted', version: 2 };
      mockPrisma.dynamicDocument.update.mockResolvedValue(transitioned);
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      const result = await transitionDocument('WO', 'doc-1', 'submitted', userId, 'Submitting');

      expect(result.status).toBe('submitted');
      expect(mockPrisma.dynamicDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            status: 'submitted',
            updatedById: userId,
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('creates history entry on successful transition', async () => {
      const doc = makeDocument({ status: 'draft', documentType: MOCK_DOC_TYPE });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.dynamicDocument.update.mockResolvedValue({ ...doc, status: 'submitted' });
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      await transitionDocument('WO', 'doc-1', 'submitted', userId, 'Ready for review');

      expect(historyMock.create).toHaveBeenCalledWith({
        data: {
          documentId: 'doc-1',
          fromStatus: 'draft',
          toStatus: 'submitted',
          performedById: userId,
          comment: 'Ready for review',
        },
      });
    });

    it('throws NotFoundError when document does not exist', async () => {
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(null);

      await expect(transitionDocument('WO', 'bad-id', 'submitted', userId)).rejects.toThrow('Document not found');
    });

    it('throws error for invalid status transition', async () => {
      const doc = makeDocument({ status: 'draft', documentType: MOCK_DOC_TYPE });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);

      await expect(transitionDocument('WO', 'doc-1', 'approved', userId)).rejects.toThrow(
        "Invalid status transition: 'draft' → 'approved'. Allowed: submitted",
      );
    });

    it('throws error when transitioning from terminal status with no transitions', async () => {
      const doc = makeDocument({ status: 'rejected', documentType: MOCK_DOC_TYPE });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);

      await expect(transitionDocument('WO', 'doc-1', 'draft', userId)).rejects.toThrow(
        "Invalid status transition: 'rejected' → 'draft'. Allowed: none",
      );
    });

    it('blocks transition when there are pending approval steps', async () => {
      const doc = makeDocument({
        status: 'submitted',
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findMany.mockResolvedValue([
        makeApprovalStep({ level: 1 }),
        makeApprovalStep({ id: 'step-2', level: 2 }),
      ]);

      await expect(transitionDocument('WO', 'doc-1', 'approved', userId)).rejects.toThrow(
        'Cannot transition: document has 2 pending approval(s) at level(s) 1, 2',
      );
    });

    it('allows transition when no pending approval steps remain', async () => {
      const doc = makeDocument({
        status: 'submitted',
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findMany.mockResolvedValue([]);
      mockPrisma.dynamicDocument.update.mockResolvedValue({ ...doc, status: 'approved' });
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      const result = await transitionDocument('WO', 'doc-1', 'approved', userId);

      expect(result.status).toBe('approved');
    });

    it('skips approval check when approvalConfig is null', async () => {
      const doc = makeDocument({ status: 'draft', documentType: MOCK_DOC_TYPE });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.dynamicDocument.update.mockResolvedValue({ ...doc, status: 'submitted' });
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      await transitionDocument('WO', 'doc-1', 'submitted', userId);

      // approvalStep.findMany should NOT be called when there is no approvalConfig
      expect(mockPrisma.approvalStep.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── approveDocument ─────────────────────────────────────────────────

  describe('approveDocument', () => {
    const userId = 'user-1';

    beforeEach(() => {
      vi.mocked(isAuthorizedApprover).mockResolvedValue(true);
      vi.mocked(getApprovalSteps).mockResolvedValue([]);
    });

    it('approves the current pending step', async () => {
      const doc = makeDocument({
        status: 'submitted',
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findFirst.mockResolvedValue(makeApprovalStep());
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalStep.count.mockResolvedValue(1); // 1 remaining
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      const result = await approveDocument('WO', 'doc-1', userId, 'Looks good');

      expect(result.approvedLevel).toBe(1);
      expect(result.approverRole).toBe('warehouse_manager');
      expect(result.allApproved).toBe(false);
      expect(result.remainingLevels).toBe(1);

      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'step-1' },
          data: expect.objectContaining({
            status: 'approved',
            approverId: userId,
            notes: 'Looks good',
          }),
        }),
      );
    });

    it('returns allApproved=true when all steps are completed', async () => {
      const doc = makeDocument({
        status: 'submitted',
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findFirst.mockResolvedValue(
        makeApprovalStep({ level: 2, approverRole: 'project_manager' }),
      );
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalStep.count.mockResolvedValue(0); // none remaining
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      const result = await approveDocument('WO', 'doc-1', userId);

      expect(result.allApproved).toBe(true);
      expect(result.remainingLevels).toBe(0);
    });

    it('creates history entry with correct comment for partial approval', async () => {
      const doc = makeDocument({
        status: 'submitted',
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findFirst.mockResolvedValue(makeApprovalStep());
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalStep.count.mockResolvedValue(1);
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      await approveDocument('WO', 'doc-1', userId);

      expect(historyMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          comment: 'Approval level 1 approved by warehouse_manager',
        }),
      });
    });

    it('creates history entry with completion comment for final approval', async () => {
      const doc = makeDocument({
        status: 'submitted',
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findFirst.mockResolvedValue(makeApprovalStep({ level: 2 }));
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalStep.count.mockResolvedValue(0);
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      await approveDocument('WO', 'doc-1', userId);

      expect(historyMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          comment: 'All approval levels completed (level 2 approved)',
        }),
      });
    });

    it('throws NotFoundError when document does not exist', async () => {
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(null);

      await expect(approveDocument('WO', 'bad-id', userId)).rejects.toThrow('Document not found');
    });

    it('throws error when document type has no approval config', async () => {
      const doc = makeDocument({ documentType: MOCK_DOC_TYPE }); // approvalConfig: null
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);

      await expect(approveDocument('WO', 'doc-1', userId)).rejects.toThrow(
        "Document type 'WO' does not have approval configuration",
      );
    });

    it('throws error when no pending approval steps remain', async () => {
      const doc = makeDocument({
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findFirst.mockResolvedValue(null);

      await expect(approveDocument('WO', 'doc-1', userId)).rejects.toThrow(
        'No pending approval steps for this document',
      );
    });

    it('throws error when user is not authorized approver', async () => {
      const doc = makeDocument({
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findFirst.mockResolvedValue(makeApprovalStep());
      vi.mocked(isAuthorizedApprover).mockResolvedValue(false);

      await expect(approveDocument('WO', 'doc-1', userId)).rejects.toThrow(
        'User is not authorized to approve at level 1. Required role: warehouse_manager',
      );
      expect(mockPrisma.approvalStep.update).not.toHaveBeenCalled();
    });

    it('sets notes to null when no comments provided', async () => {
      const doc = makeDocument({
        status: 'submitted',
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findFirst.mockResolvedValue(makeApprovalStep());
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalStep.count.mockResolvedValue(0);
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});

      await approveDocument('WO', 'doc-1', userId);

      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: null,
          }),
        }),
      );
    });

    it('calls getApprovalSteps and returns steps in response', async () => {
      const doc = makeDocument({
        status: 'submitted',
        documentType: MOCK_DOC_TYPE_WITH_APPROVAL,
      });
      mockPrisma.dynamicDocument.findUnique.mockResolvedValue(doc);
      mockPrisma.approvalStep.findFirst.mockResolvedValue(makeApprovalStep());
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalStep.count.mockResolvedValue(0);
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.create.mockResolvedValue({});
      const mockSteps = [{ level: 1, status: 'approved' }];
      vi.mocked(getApprovalSteps).mockResolvedValue(mockSteps as never);

      const result = await approveDocument('WO', 'doc-1', userId);

      expect(getApprovalSteps).toHaveBeenCalledWith('dynamic_WO', 'doc-1');
      expect(result.steps).toEqual(mockSteps);
    });
  });

  // ─── getDocumentHistory ──────────────────────────────────────────────

  describe('getDocumentHistory', () => {
    it('returns history entries ordered by performedAt desc', async () => {
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      const entries = [
        { id: 'h-2', fromStatus: 'draft', toStatus: 'submitted', performedAt: new Date('2026-01-02') },
        { id: 'h-1', fromStatus: null, toStatus: 'draft', performedAt: new Date('2026-01-01') },
      ];
      historyMock.findMany.mockResolvedValue(entries);

      const result = await getDocumentHistory('doc-1');

      expect(result).toEqual(entries);
      expect(historyMock.findMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
        orderBy: { performedAt: 'desc' },
        include: { performedBy: { select: { fullName: true } } },
      });
    });

    it('returns empty array when no history exists', async () => {
      const historyMock = (mockPrisma as Record<string, PrismaModelMock>).dynamicDocumentHistory;
      historyMock.findMany.mockResolvedValue([]);

      const result = await getDocumentHistory('doc-1');

      expect(result).toEqual([]);
    });
  });
});
