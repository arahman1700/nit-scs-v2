import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('./approval.service.js', () => ({ submitForApproval: vi.fn() }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return {
    ...actual,
    assertTransition: vi.fn(),
  };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { generateDocumentNumber } from './document-number.service.js';
import { submitForApproval } from './approval.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';
import {
  list,
  getById,
  create,
  update,
  submit,
  approve,
  reject,
  assign,
  start,
  hold,
  resume,
  complete,
  invoice,
  cancel,
  addPayment,
  updatePayment,
} from './job-order.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedSubmitForApproval = submitForApproval as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeJo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'jo-1',
    joNumber: 'JO-2025-0001',
    joType: 'transport',
    entityId: null,
    projectId: 'proj-1',
    supplierId: 'sup-1',
    requestedById: 'user-1',
    requestDate: new Date('2025-06-01'),
    requiredDate: null,
    priority: 'normal',
    description: 'Transport steel beams',
    notes: null,
    totalAmount: 5000,
    status: 'draft',
    startDate: null,
    completionDate: null,
    completedById: null,
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    jobOrderId: 'jo-1',
    invoiceNumber: 'INV-001',
    invoiceReceiptDate: new Date('2025-07-01'),
    costExclVat: 4000,
    vatAmount: 600,
    grandTotal: 4600,
    paymentStatus: 'pending',
    oracleVoucher: null,
    attachmentUrl: null,
    paymentApprovedDate: null,
    actualPaymentDate: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('job-order.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── list ────────────────────────────────────────────────────────────

  describe('list', () => {
    const baseParams = { skip: 0, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' as const };

    it('returns data and total', async () => {
      const rows = [makeJo()];
      mockPrisma.jobOrder.findMany.mockResolvedValue(rows);
      mockPrisma.jobOrder.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('applies search filter to joNumber and description', async () => {
      mockPrisma.jobOrder.findMany.mockResolvedValue([]);
      mockPrisma.jobOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'transport' });

      const call = mockPrisma.jobOrder.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { joNumber: { contains: 'transport', mode: 'insensitive' } },
        { description: { contains: 'transport', mode: 'insensitive' } },
      ]);
    });

    it('applies status filter', async () => {
      mockPrisma.jobOrder.findMany.mockResolvedValue([]);
      mockPrisma.jobOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'in_progress' });

      const call = mockPrisma.jobOrder.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('in_progress');
    });

    it('applies joType filter', async () => {
      mockPrisma.jobOrder.findMany.mockResolvedValue([]);
      mockPrisma.jobOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, joType: 'transport' });

      const call = mockPrisma.jobOrder.findMany.mock.calls[0][0];
      expect(call.where.joType).toBe('transport');
    });

    it('applies projectId and requestedById scope filters', async () => {
      mockPrisma.jobOrder.findMany.mockResolvedValue([]);
      mockPrisma.jobOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, projectId: 'proj-5', requestedById: 'user-5' });

      const call = mockPrisma.jobOrder.findMany.mock.calls[0][0];
      expect(call.where.projectId).toBe('proj-5');
      expect(call.where.requestedById).toBe('user-5');
    });

    it('applies pagination and sorting', async () => {
      mockPrisma.jobOrder.findMany.mockResolvedValue([]);
      mockPrisma.jobOrder.count.mockResolvedValue(0);

      await list({ skip: 20, pageSize: 5, sortBy: 'joNumber', sortDir: 'asc' });

      const call = mockPrisma.jobOrder.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(5);
      expect(call.orderBy).toEqual({ joNumber: 'asc' });
    });
  });

  // ─── getById ─────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the job order with detail includes', async () => {
      const jo = makeJo();
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);

      const result = await getById('jo-1');

      expect(result).toEqual(jo);
      expect(mockPrisma.jobOrder.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'jo-1' } }));
    });

    it('throws NotFoundError when job order does not exist', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────

  describe('create', () => {
    it('generates a document number', async () => {
      mockedGenDoc.mockResolvedValue('JO-2025-0042');
      mockPrisma.jobOrder.create.mockResolvedValue(makeJo({ id: 'jo-new' }));
      mockPrisma.joSlaTracking.create.mockResolvedValue({});
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ id: 'jo-new' }));

      await create(
        {
          joType: 'transport',
          projectId: 'proj-1',
          requestDate: '2025-06-01',
          description: 'Test',
          transportDetails: { pickupLocation: 'A', deliveryLocation: 'B', cargoType: 'steel' },
        },
        'user-1',
      );

      expect(mockedGenDoc).toHaveBeenCalledWith('jo');
    });

    it('creates job order header with correct fields', async () => {
      mockedGenDoc.mockResolvedValue('JO-2025-0043');
      const created = makeJo({ id: 'jo-new', joNumber: 'JO-2025-0043' });
      mockPrisma.jobOrder.create.mockResolvedValue(created);
      mockPrisma.joSlaTracking.create.mockResolvedValue({});
      mockPrisma.jobOrder.findUnique.mockResolvedValue(created);

      await create(
        {
          joType: 'transport',
          projectId: 'proj-1',
          requestDate: '2025-06-01',
          description: 'Transport job',
          priority: 'urgent',
          totalAmount: 10000,
          notes: 'Rush delivery',
        },
        'user-2',
      );

      const call = mockPrisma.jobOrder.create.mock.calls[0][0];
      expect(call.data).toEqual(
        expect.objectContaining({
          joNumber: 'JO-2025-0043',
          joType: 'transport',
          projectId: 'proj-1',
          requestedById: 'user-2',
          priority: 'urgent',
          description: 'Transport job',
          totalAmount: 10000,
          status: 'draft',
          notes: 'Rush delivery',
        }),
      );
    });

    it('creates transport details for transport type', async () => {
      mockedGenDoc.mockResolvedValue('JO-2025-0044');
      const created = makeJo({ id: 'jo-new' });
      mockPrisma.jobOrder.create.mockResolvedValue(created);
      mockPrisma.joTransportDetail.create.mockResolvedValue({});
      mockPrisma.joSlaTracking.create.mockResolvedValue({});
      mockPrisma.jobOrder.findUnique.mockResolvedValue(created);

      await create(
        {
          joType: 'transport',
          projectId: 'proj-1',
          requestDate: '2025-06-01',
          description: 'Transport',
          transportDetails: {
            pickupLocation: 'Riyadh',
            deliveryLocation: 'Jeddah',
            cargoType: 'steel',
            cargoWeightTons: 20,
            numberOfTrailers: 2,
            insuranceRequired: true,
          },
        },
        'user-1',
      );

      expect(mockPrisma.joTransportDetail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobOrderId: 'jo-new',
            pickupLocation: 'Riyadh',
            deliveryLocation: 'Jeddah',
            cargoType: 'steel',
            cargoWeightTons: 20,
            numberOfTrailers: 2,
            insuranceRequired: true,
          }),
        }),
      );
    });

    it('creates rental details for rental_monthly type', async () => {
      mockedGenDoc.mockResolvedValue('JO-2025-0045');
      const created = makeJo({ id: 'jo-new', joType: 'rental_monthly' });
      mockPrisma.jobOrder.create.mockResolvedValue(created);
      mockPrisma.joRentalDetail.create.mockResolvedValue({});
      mockPrisma.joSlaTracking.create.mockResolvedValue({});
      mockPrisma.jobOrder.findUnique.mockResolvedValue(created);

      await create(
        {
          joType: 'rental_monthly',
          projectId: 'proj-1',
          requestDate: '2025-06-01',
          description: 'Crane rental',
          rentalDetails: {
            rentalStartDate: '2025-06-15',
            rentalEndDate: '2025-09-15',
            monthlyRate: 15000,
            withOperator: true,
          },
        },
        'user-1',
      );

      expect(mockPrisma.joRentalDetail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobOrderId: 'jo-new',
            rentalStartDate: new Date('2025-06-15'),
            rentalEndDate: new Date('2025-09-15'),
            monthlyRate: 15000,
            withOperator: true,
          }),
        }),
      );
    });

    it('creates SLA tracking record', async () => {
      mockedGenDoc.mockResolvedValue('JO-2025-0046');
      const created = makeJo({ id: 'jo-new' });
      mockPrisma.jobOrder.create.mockResolvedValue(created);
      mockPrisma.joSlaTracking.create.mockResolvedValue({});
      mockPrisma.jobOrder.findUnique.mockResolvedValue(created);

      await create(
        { joType: 'transport', projectId: 'proj-1', requestDate: '2025-06-01', description: 'Test' },
        'user-1',
      );

      expect(mockPrisma.joSlaTracking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { jobOrderId: 'jo-new' },
        }),
      );
    });

    it('fetches full record after creation', async () => {
      mockedGenDoc.mockResolvedValue('JO-2025-0047');
      const created = makeJo({ id: 'jo-new' });
      mockPrisma.jobOrder.create.mockResolvedValue(created);
      mockPrisma.joSlaTracking.create.mockResolvedValue({});
      const fullRecord = { ...created, transportDetails: {}, slaTracking: {} };
      mockPrisma.jobOrder.findUnique.mockResolvedValue(fullRecord);

      const result = await create(
        { joType: 'transport', projectId: 'proj-1', requestDate: '2025-06-01', description: 'Test' },
        'user-1',
      );

      expect(result).toEqual(fullRecord);
      // The second findUnique call (first is inside $transaction context)
      expect(mockPrisma.jobOrder.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'jo-new' } }));
    });

    it('does not create transport details for non-transport type', async () => {
      mockedGenDoc.mockResolvedValue('JO-2025-0048');
      const created = makeJo({ id: 'jo-new', joType: 'scrap' });
      mockPrisma.jobOrder.create.mockResolvedValue(created);
      mockPrisma.joScrapDetail.create.mockResolvedValue({});
      mockPrisma.joSlaTracking.create.mockResolvedValue({});
      mockPrisma.jobOrder.findUnique.mockResolvedValue(created);

      await create(
        {
          joType: 'scrap',
          projectId: 'proj-1',
          requestDate: '2025-06-01',
          description: 'Scrap disposal',
          scrapDetails: { scrapType: 'metal', scrapWeightTons: 5 },
        },
        'user-1',
      );

      expect(mockPrisma.joTransportDetail.create).not.toHaveBeenCalled();
      expect(mockPrisma.joScrapDetail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobOrderId: 'jo-new',
            scrapType: 'metal',
            scrapWeightTons: 5,
          }),
        }),
      );
    });
  });

  // ─── update ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a draft job order successfully', async () => {
      const existing = makeJo({ status: 'draft' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, description: 'Updated description' };
      mockPrisma.jobOrder.update.mockResolvedValue(updated);

      const result = await update('jo-1', { description: 'Updated description' });

      expect(result).toEqual({ existing, updated });
    });

    it('throws NotFoundError when job order does not exist', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', { description: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when job order is not draft', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'approved' }));

      await expect(update('jo-1', { description: 'x' })).rejects.toThrow(BusinessRuleError);
      await expect(update('jo-1', { description: 'x' })).rejects.toThrow('Only draft Job Orders can be updated');
    });

    it('transforms date fields to Date objects', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'draft' }));
      mockPrisma.jobOrder.update.mockResolvedValue(makeJo());

      await update('jo-1', { requestDate: '2025-07-01', requiredDate: '2025-08-01' });

      const call = mockPrisma.jobOrder.update.mock.calls[0][0];
      expect(call.data.requestDate).toEqual(new Date('2025-07-01'));
      expect(call.data.requiredDate).toEqual(new Date('2025-08-01'));
    });
  });

  // ─── submit ──────────────────────────────────────────────────────────

  describe('submit', () => {
    it('calls assertTransition and submitForApproval', async () => {
      const jo = makeJo({ status: 'draft', totalAmount: 5000 });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockedSubmitForApproval.mockResolvedValue({ approverRole: 'manager', slaHours: 24 });
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      const result = await submit('jo-1', 'user-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('jo', 'draft', 'pending_approval');
      expect(mockedSubmitForApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'jo',
          documentId: 'jo-1',
          amount: 5000,
          submittedById: 'user-1',
        }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 'jo-1', approverRole: 'manager', slaHours: 24 }));
    });

    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(submit('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('updates SLA tracking with sla info', async () => {
      const jo = makeJo({ status: 'draft' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockedSubmitForApproval.mockResolvedValue({ approverRole: 'director', slaHours: 48 });
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      await submit('jo-1', 'user-1');

      expect(mockPrisma.joSlaTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobOrderId: 'jo-1' },
          data: expect.objectContaining({
            slaResponseHours: 48,
            slaDueDate: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── approve ─────────────────────────────────────────────────────────

  describe('approve', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(approve('nonexistent', 'user-1', true)).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is not pending_approval or quoted', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'draft', approvals: [] }));

      await expect(approve('jo-1', 'user-1', true)).rejects.toThrow(BusinessRuleError);
    });

    it('creates approval record and updates to approved when approved=true', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'pending_approval', approvals: [] }));
      mockPrisma.joApproval.create.mockResolvedValue({});
      mockPrisma.jobOrder.update.mockResolvedValue({});
      mockPrisma.joSlaTracking.findUnique.mockResolvedValue(null);

      const result = await approve('jo-1', 'approver-1', true, 5000, 'Looks good');

      expect(mockPrisma.joApproval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobOrderId: 'jo-1',
            approved: true,
            approverId: 'approver-1',
            quoteAmount: 5000,
            comments: 'Looks good',
          }),
        }),
      );
      expect(mockPrisma.jobOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'approved' },
        }),
      );
      expect(result).toEqual({ id: 'jo-1', status: 'approved' });
    });

    it('creates rejection record and updates to rejected when approved=false', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'pending_approval', approvals: [] }));
      mockPrisma.joApproval.create.mockResolvedValue({});
      mockPrisma.jobOrder.update.mockResolvedValue({});

      const result = await approve('jo-1', 'approver-1', false, undefined, 'Not justified');

      expect(mockPrisma.joApproval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobOrderId: 'jo-1',
            approved: false,
            comments: 'Not justified',
          }),
        }),
      );
      expect(result).toEqual({ id: 'jo-1', status: 'rejected' });
    });

    it('checks SLA and updates slaMet on approval', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'pending_approval', approvals: [] }));
      mockPrisma.joApproval.create.mockResolvedValue({});
      mockPrisma.jobOrder.update.mockResolvedValue({});
      const futureDate = new Date(Date.now() + 86400000); // tomorrow
      mockPrisma.joSlaTracking.findUnique.mockResolvedValue({ slaDueDate: futureDate });
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      await approve('jo-1', 'approver-1', true);

      expect(mockPrisma.joSlaTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobOrderId: 'jo-1' },
          data: { slaMet: true },
        }),
      );
    });

    it('sets slaMet to false when SLA is missed', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'pending_approval', approvals: [] }));
      mockPrisma.joApproval.create.mockResolvedValue({});
      mockPrisma.jobOrder.update.mockResolvedValue({});
      const pastDate = new Date(Date.now() - 86400000); // yesterday
      mockPrisma.joSlaTracking.findUnique.mockResolvedValue({ slaDueDate: pastDate });
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      await approve('jo-1', 'approver-1', true);

      expect(mockPrisma.joSlaTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { slaMet: false },
        }),
      );
    });
  });

  // ─── reject ──────────────────────────────────────────────────────────

  describe('reject', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(reject('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is invalid', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'draft' }));

      await expect(reject('jo-1', 'user-1')).rejects.toThrow(BusinessRuleError);
    });

    it('creates rejection approval and updates to rejected', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'pending_approval' }));
      mockPrisma.joApproval.create.mockResolvedValue({});
      mockPrisma.jobOrder.update.mockResolvedValue({});

      const result = await reject('jo-1', 'user-1', 'Budget exceeded');

      expect(mockPrisma.joApproval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobOrderId: 'jo-1',
            approved: false,
            approverId: 'user-1',
            comments: 'Budget exceeded',
          }),
        }),
      );
      expect(result).toEqual({ id: 'jo-1', status: 'rejected' });
    });
  });

  // ─── assign ──────────────────────────────────────────────────────────

  describe('assign', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(assign('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('calls assertTransition and updates to assigned with supplierId', async () => {
      const jo = makeJo({ status: 'approved' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({ ...jo, status: 'assigned' });

      await assign('jo-1', 'sup-new');

      expect(mockedAssertTransition).toHaveBeenCalledWith('jo', 'approved', 'assigned');
      expect(mockPrisma.jobOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'assigned', supplierId: 'sup-new' },
        }),
      );
    });

    it('uses existing supplierId when not provided', async () => {
      const jo = makeJo({ status: 'approved', supplierId: 'sup-existing' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({ ...jo, status: 'assigned' });

      await assign('jo-1');

      expect(mockPrisma.jobOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'assigned', supplierId: 'sup-existing' },
        }),
      );
    });
  });

  // ─── start ───────────────────────────────────────────────────────────

  describe('start', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(start('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('calls assertTransition and updates to in_progress with startDate', async () => {
      const jo = makeJo({ status: 'assigned' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({ ...jo, status: 'in_progress' });

      await start('jo-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('jo', 'assigned', 'in_progress');
      expect(mockPrisma.jobOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'in_progress',
            startDate: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── hold ────────────────────────────────────────────────────────────

  describe('hold', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(hold('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('calls assertTransition, updates to on_hold, and sets stopClock', async () => {
      const jo = makeJo({ status: 'in_progress' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({});
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      const result = await hold('jo-1', 'Waiting for materials');

      expect(mockedAssertTransition).toHaveBeenCalledWith('jo', 'in_progress', 'on_hold');
      expect(mockPrisma.jobOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'on_hold' } }));
      expect(mockPrisma.joSlaTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobOrderId: 'jo-1' },
          data: expect.objectContaining({
            stopClockStart: expect.any(Date),
            stopClockReason: 'Waiting for materials',
          }),
        }),
      );
      expect(result).toEqual({ id: 'jo-1' });
    });

    it('sets stopClockReason to null when no reason provided', async () => {
      const jo = makeJo({ status: 'in_progress' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({});
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      await hold('jo-1');

      const call = mockPrisma.joSlaTracking.update.mock.calls[0][0];
      expect(call.data.stopClockReason).toBeNull();
    });
  });

  // ─── resume ──────────────────────────────────────────────────────────

  describe('resume', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(resume('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('calls assertTransition and updates to in_progress', async () => {
      const jo = makeJo({ status: 'on_hold' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({});
      mockPrisma.joSlaTracking.findUnique.mockResolvedValue({ stopClockStart: null, slaDueDate: null });
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      const result = await resume('jo-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('jo', 'on_hold', 'in_progress');
      expect(result).toEqual({ id: 'jo-1' });
    });

    it('adjusts slaDueDate based on pause duration when stopClock data exists', async () => {
      const jo = makeJo({ status: 'on_hold' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({});

      const stopClockStart = new Date(Date.now() - 3600000); // 1 hour ago
      const slaDueDate = new Date(Date.now() + 3600000); // 1 hour from now
      mockPrisma.joSlaTracking.findUnique.mockResolvedValue({ stopClockStart, slaDueDate });
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      await resume('jo-1');

      const call = mockPrisma.joSlaTracking.update.mock.calls[0][0];
      expect(call.data.stopClockEnd).toBeInstanceOf(Date);
      expect(call.data.slaDueDate).toBeInstanceOf(Date);
      // New SLA due date should be extended by approximately the pause duration
      expect(call.data.slaDueDate.getTime()).toBeGreaterThan(slaDueDate.getTime());
    });

    it('sets stopClockEnd without adjusting slaDueDate when no stopClock data', async () => {
      const jo = makeJo({ status: 'on_hold' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({});
      mockPrisma.joSlaTracking.findUnique.mockResolvedValue({ stopClockStart: null, slaDueDate: null });
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      await resume('jo-1');

      const call = mockPrisma.joSlaTracking.update.mock.calls[0][0];
      expect(call.data.stopClockEnd).toBeInstanceOf(Date);
      expect(call.data.slaDueDate).toBeUndefined();
    });
  });

  // ─── complete ────────────────────────────────────────────────────────

  describe('complete', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(complete('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('calls assertTransition and updates to completed', async () => {
      const jo = makeJo({ status: 'in_progress', slaTracking: null });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({});

      const result = await complete('jo-1', 'user-1');

      expect(mockedAssertTransition).toHaveBeenCalledWith('jo', 'in_progress', 'completed');
      expect(mockPrisma.jobOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            completionDate: expect.any(Date),
            completedById: 'user-1',
          }),
        }),
      );
      expect(result).toEqual({ id: 'jo-1', slaMet: null });
    });

    it('updates slaMet when SLA tracking has a due date', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const jo = makeJo({ status: 'in_progress', slaTracking: { slaDueDate: futureDate } });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({});
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      const result = await complete('jo-1', 'user-1');

      expect(mockPrisma.joSlaTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobOrderId: 'jo-1' },
          data: { slaMet: true },
        }),
      );
      expect(result.slaMet).toBe(true);
    });

    it('sets slaMet to false when SLA is missed', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const jo = makeJo({ status: 'in_progress', slaTracking: { slaDueDate: pastDate } });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      mockPrisma.jobOrder.update.mockResolvedValue({});
      mockPrisma.joSlaTracking.update.mockResolvedValue({});

      const result = await complete('jo-1', 'user-1');

      expect(mockPrisma.joSlaTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { slaMet: false },
        }),
      );
      expect(result.slaMet).toBe(false);
    });
  });

  // ─── invoice ─────────────────────────────────────────────────────────

  describe('invoice', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(invoice('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('calls assertTransition, updates to invoiced, and creates payment', async () => {
      const jo = makeJo({ status: 'completed' });
      mockPrisma.jobOrder.findUnique.mockResolvedValue(jo);
      const paymentData = {
        invoiceNumber: 'INV-001',
        invoiceReceiptDate: '2025-07-01',
        costExclVat: 4000,
        vatAmount: 600,
        grandTotal: 4600,
        paymentStatus: 'pending',
      };
      mockPrisma.jobOrder.update.mockResolvedValue({ ...jo, status: 'invoiced' });
      mockPrisma.joPayment.create.mockResolvedValue(makePayment());

      const result = await invoice('jo-1', paymentData);

      expect(mockedAssertTransition).toHaveBeenCalledWith('jo', 'completed', 'invoiced');
      expect(mockPrisma.jobOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'invoiced' } }),
      );
      expect(mockPrisma.joPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobOrderId: 'jo-1',
            invoiceNumber: 'INV-001',
            costExclVat: 4000,
            vatAmount: 600,
            grandTotal: 4600,
          }),
        }),
      );
      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('payment');
    });
  });

  // ─── cancel ──────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(cancel('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is completed', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'completed' }));

      await expect(cancel('jo-1')).rejects.toThrow(BusinessRuleError);
    });

    it('throws BusinessRuleError when status is invoiced', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'invoiced' }));

      await expect(cancel('jo-1')).rejects.toThrow(BusinessRuleError);
    });

    it('throws BusinessRuleError when status is already cancelled', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'cancelled' }));

      await expect(cancel('jo-1')).rejects.toThrow(BusinessRuleError);
    });

    it('cancels from draft status', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'draft' }));
      mockPrisma.jobOrder.update.mockResolvedValue(makeJo({ status: 'cancelled' }));

      const result = await cancel('jo-1');

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.jobOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'cancelled' },
        }),
      );
    });

    it('cancels from in_progress status', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo({ status: 'in_progress' }));
      mockPrisma.jobOrder.update.mockResolvedValue(makeJo({ status: 'cancelled' }));

      const result = await cancel('jo-1');

      expect(result.status).toBe('cancelled');
    });
  });

  // ─── addPayment ──────────────────────────────────────────────────────

  describe('addPayment', () => {
    it('throws NotFoundError when job order not found', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(addPayment('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('creates a payment record', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(makeJo());
      const payment = makePayment();
      mockPrisma.joPayment.create.mockResolvedValue(payment);

      const result = await addPayment('jo-1', {
        invoiceNumber: 'INV-002',
        costExclVat: 3000,
        grandTotal: 3450,
      });

      expect(result).toEqual(payment);
      expect(mockPrisma.joPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobOrderId: 'jo-1',
            invoiceNumber: 'INV-002',
            costExclVat: 3000,
            grandTotal: 3450,
          }),
        }),
      );
    });
  });

  // ─── updatePayment ───────────────────────────────────────────────────

  describe('updatePayment', () => {
    it('throws NotFoundError when payment not found', async () => {
      mockPrisma.joPayment.findFirst.mockResolvedValue(null);

      await expect(updatePayment('jo-1', 'pay-999', {})).rejects.toThrow(NotFoundError);
    });

    it('updates payment with partial data', async () => {
      const existing = makePayment();
      mockPrisma.joPayment.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, oracleVoucher: 'OV-100' };
      mockPrisma.joPayment.update.mockResolvedValue(updated);

      const result = await updatePayment('jo-1', 'pay-1', { oracleVoucher: 'OV-100' });

      expect(result).toEqual({ existing, updated });
      expect(mockPrisma.joPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ oracleVoucher: 'OV-100' }),
        }),
      );
    });

    it('sets paymentApprovedDate when paymentStatus is approved', async () => {
      const existing = makePayment();
      mockPrisma.joPayment.findFirst.mockResolvedValue(existing);
      mockPrisma.joPayment.update.mockResolvedValue(existing);

      await updatePayment('jo-1', 'pay-1', { paymentStatus: 'approved' });

      const call = mockPrisma.joPayment.update.mock.calls[0][0];
      expect(call.data.paymentApprovedDate).toBeInstanceOf(Date);
    });

    it('sets actualPaymentDate when paymentStatus is paid', async () => {
      const existing = makePayment();
      mockPrisma.joPayment.findFirst.mockResolvedValue(existing);
      mockPrisma.joPayment.update.mockResolvedValue(existing);

      await updatePayment('jo-1', 'pay-1', { paymentStatus: 'paid' });

      const call = mockPrisma.joPayment.update.mock.calls[0][0];
      expect(call.data.actualPaymentDate).toBeInstanceOf(Date);
    });

    it('validates findFirst uses both joId and paymentId', async () => {
      mockPrisma.joPayment.findFirst.mockResolvedValue(null);

      await expect(updatePayment('jo-1', 'pay-1', {})).rejects.toThrow(NotFoundError);

      expect(mockPrisma.joPayment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1', jobOrderId: 'jo-1' },
        }),
      );
    });
  });
});
