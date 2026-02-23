import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { validateEntityType, listByEntity, create, getById, softDelete } from './attachment.service.js';

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

describe('attachment.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).attachment = createModelMock();
  });

  // ─── validateEntityType ─────────────────────────────────────────────

  describe('validateEntityType', () => {
    it('does not throw for valid entity types', () => {
      const validTypes = [
        'mrrv',
        'mirv',
        'mrv',
        'shipment',
        'job-order',
        'rfim',
        'osd',
        'gate-pass',
        'stock-transfer',
        'mrf',
        'project',
        'supplier',
        'employee',
        'fleet',
        'generator',
        'warehouse',
        'customs',
      ];
      for (const t of validTypes) {
        expect(() => validateEntityType(t)).not.toThrow();
      }
    });

    it('throws for invalid entity type', () => {
      expect(() => validateEntityType('invalid')).toThrow('Invalid entity type: invalid');
    });
  });

  // ─── listByEntity ──────────────────────────────────────────────────

  describe('listByEntity', () => {
    it('queries by entityType and recordId with deletedAt null', async () => {
      mockPrisma.attachment.findMany.mockResolvedValue([]);
      await listByEntity('mrrv', 'rec-1');
      expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: 'mrrv', recordId: 'rec-1', deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        }),
      );
    });

    it('returns attachments list', async () => {
      const items = [{ id: 'a1', fileName: 'test.pdf' }];
      mockPrisma.attachment.findMany.mockResolvedValue(items);
      const result = await listByEntity('mrrv', 'rec-1');
      expect(result).toEqual(items);
    });
  });

  // ─── create ────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates attachment with all fields', async () => {
      const input = {
        entityType: 'mrrv',
        recordId: 'rec-1',
        fileName: 'abc.pdf',
        originalName: 'upload.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storagePath: '/uploads/abc.pdf',
        uploadedById: 'user-1',
      };
      const created = { id: 'a1', ...input };
      mockPrisma.attachment.create.mockResolvedValue(created);

      const result = await create(input);
      expect(result).toEqual(created);
      expect(mockPrisma.attachment.create).toHaveBeenCalledWith(expect.objectContaining({ data: input }));
    });
  });

  // ─── getById ───────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns attachment when found', async () => {
      const att = { id: 'a1', fileName: 'test.pdf', deletedAt: null };
      mockPrisma.attachment.findFirst.mockResolvedValue(att);
      const result = await getById('a1');
      expect(result).toEqual(att);
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.attachment.findFirst.mockResolvedValue(null);
      await expect(getById('bad')).rejects.toThrow();
    });
  });

  // ─── softDelete ────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('sets deletedAt on the attachment', async () => {
      const att = { id: 'a1', fileName: 'test.pdf', deletedAt: null };
      mockPrisma.attachment.findFirst.mockResolvedValue(att);
      mockPrisma.attachment.update.mockResolvedValue({ ...att, deletedAt: new Date() });

      await softDelete('a1');
      expect(mockPrisma.attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });

    it('throws NotFoundError when attachment not found', async () => {
      mockPrisma.attachment.findFirst.mockResolvedValue(null);
      await expect(softDelete('bad')).rejects.toThrow();
    });
  });
});
