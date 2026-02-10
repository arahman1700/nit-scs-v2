import type { PrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, send, confirm, ship, deliver, complete } from './imsf.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { assertTransition } from '@nit-scs-v2/shared';

const mockedGenerateDocNumber = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

describe('imsf.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────────
  describe('list', () => {
    const baseParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 25 };

    it('should return data and total', async () => {
      const rows = [{ id: 'imsf-1' }];
      mockPrisma.imsf.findMany.mockResolvedValue(rows);
      mockPrisma.imsf.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter', async () => {
      mockPrisma.imsf.findMany.mockResolvedValue([]);
      mockPrisma.imsf.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'IMSF-001' });

      const where = mockPrisma.imsf.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(1);
    });

    it('should apply status filter', async () => {
      mockPrisma.imsf.findMany.mockResolvedValue([]);
      mockPrisma.imsf.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'created' });

      const where = mockPrisma.imsf.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('created');
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.imsf.findMany.mockResolvedValue([]);
      mockPrisma.imsf.count.mockResolvedValue(0);

      await list({ ...baseParams, skip: 20, pageSize: 10 });

      const args = mockPrisma.imsf.findMany.mock.calls[0][0];
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the IMSF when found', async () => {
      const imsf = { id: 'imsf-1', imsfNumber: 'IMSF-001' };
      mockPrisma.imsf.findUnique.mockResolvedValue(imsf);

      const result = await getById('imsf-1');

      expect(result).toEqual(imsf);
      expect(mockPrisma.imsf.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'imsf-1' } }));
    });

    it('should throw NotFoundError when IMSF not found', async () => {
      mockPrisma.imsf.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const headerData = {
      senderProjectId: 'proj-1',
      receiverProjectId: 'proj-2',
    };
    const lines = [{ itemId: 'item-1', qty: 10, uomId: 'uom-1' }];

    it('should generate document number and create IMSF', async () => {
      mockedGenerateDocNumber.mockResolvedValue('IMSF-001');
      mockPrisma.imsf.create.mockResolvedValue({ id: 'imsf-1', imsfNumber: 'IMSF-001' });

      const result = await create(headerData, lines, 'user-1');

      expect(result).toEqual({ id: 'imsf-1', imsfNumber: 'IMSF-001' });
      expect(mockedGenerateDocNumber).toHaveBeenCalledWith('imsf');
    });

    it('should set status to created and createdById', async () => {
      mockedGenerateDocNumber.mockResolvedValue('IMSF-002');
      mockPrisma.imsf.create.mockResolvedValue({ id: 'imsf-2' });

      await create(headerData, lines, 'user-1');

      const createArgs = mockPrisma.imsf.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('created');
      expect(createArgs.data.createdById).toBe('user-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update an IMSF in created status', async () => {
      const existing = { id: 'imsf-1', status: 'created' };
      const updated = { id: 'imsf-1', status: 'created', notes: 'Updated' };
      mockPrisma.imsf.findUnique.mockResolvedValue(existing);
      mockPrisma.imsf.update.mockResolvedValue(updated);

      const result = await update('imsf-1', { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when IMSF not found', async () => {
      mockPrisma.imsf.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when IMSF is not in created status', async () => {
      mockPrisma.imsf.findUnique.mockResolvedValue({ id: 'imsf-1', status: 'sent' });

      await expect(update('imsf-1', {})).rejects.toThrow('Only IMSF documents in "created" status can be updated');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // send (created -> sent)
  // ─────────────────────────────────────────────────────────────────────────
  describe('send', () => {
    it('should transition IMSF from created to sent', async () => {
      const imsf = { id: 'imsf-1', status: 'created', imsfLines: [{ id: 'line-1' }] };
      mockPrisma.imsf.findUnique.mockResolvedValue(imsf);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.imsf.update.mockResolvedValue({ ...imsf, status: 'sent' });

      const result = await send('imsf-1');

      expect(result.status).toBe('sent');
      expect(mockedAssertTransition).toHaveBeenCalledWith('imsf', 'created', 'sent');
    });

    it('should throw BusinessRuleError when no line items', async () => {
      const imsf = { id: 'imsf-1', status: 'created', imsfLines: [] };
      mockPrisma.imsf.findUnique.mockResolvedValue(imsf);
      mockedAssertTransition.mockReturnValue(undefined);

      await expect(send('imsf-1')).rejects.toThrow('Cannot send IMSF with no line items');
    });

    it('should throw NotFoundError when IMSF not found', async () => {
      mockPrisma.imsf.findUnique.mockResolvedValue(null);

      await expect(send('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // confirm (sent -> confirmed)
  // ─────────────────────────────────────────────────────────────────────────
  describe('confirm', () => {
    it('should transition IMSF to confirmed', async () => {
      const imsf = { id: 'imsf-1', status: 'sent' };
      mockPrisma.imsf.findUnique.mockResolvedValue(imsf);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.imsf.update.mockResolvedValue({ ...imsf, status: 'confirmed' });

      const result = await confirm('imsf-1');

      expect(result.status).toBe('confirmed');
      expect(mockedAssertTransition).toHaveBeenCalledWith('imsf', 'sent', 'confirmed');
    });

    it('should throw NotFoundError when IMSF not found', async () => {
      mockPrisma.imsf.findUnique.mockResolvedValue(null);

      await expect(confirm('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ship (confirmed -> in_transit)
  // ─────────────────────────────────────────────────────────────────────────
  describe('ship', () => {
    it('should transition IMSF to in_transit', async () => {
      const imsf = { id: 'imsf-1', status: 'confirmed' };
      mockPrisma.imsf.findUnique.mockResolvedValue(imsf);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.imsf.update.mockResolvedValue({ ...imsf, status: 'in_transit' });

      const result = await ship('imsf-1');

      expect(result.status).toBe('in_transit');
      expect(mockedAssertTransition).toHaveBeenCalledWith('imsf', 'confirmed', 'in_transit');
    });

    it('should throw NotFoundError when IMSF not found', async () => {
      mockPrisma.imsf.findUnique.mockResolvedValue(null);

      await expect(ship('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deliver (in_transit -> delivered)
  // ─────────────────────────────────────────────────────────────────────────
  describe('deliver', () => {
    it('should transition IMSF to delivered', async () => {
      const imsf = { id: 'imsf-1', status: 'in_transit' };
      mockPrisma.imsf.findUnique.mockResolvedValue(imsf);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.imsf.update.mockResolvedValue({ ...imsf, status: 'delivered' });

      const result = await deliver('imsf-1');

      expect(result.status).toBe('delivered');
      expect(mockedAssertTransition).toHaveBeenCalledWith('imsf', 'in_transit', 'delivered');
    });

    it('should throw NotFoundError when IMSF not found', async () => {
      mockPrisma.imsf.findUnique.mockResolvedValue(null);

      await expect(deliver('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // complete (delivered -> completed)
  // ─────────────────────────────────────────────────────────────────────────
  describe('complete', () => {
    it('should transition IMSF to completed', async () => {
      const imsf = { id: 'imsf-1', status: 'delivered' };
      mockPrisma.imsf.findUnique.mockResolvedValue(imsf);
      mockedAssertTransition.mockReturnValue(undefined);
      mockPrisma.imsf.update.mockResolvedValue({ ...imsf, status: 'completed' });

      const result = await complete('imsf-1');

      expect(result.status).toBe('completed');
      expect(mockedAssertTransition).toHaveBeenCalledWith('imsf', 'delivered', 'completed');
    });

    it('should throw NotFoundError when IMSF not found', async () => {
      mockPrisma.imsf.findUnique.mockResolvedValue(null);

      await expect(complete('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
