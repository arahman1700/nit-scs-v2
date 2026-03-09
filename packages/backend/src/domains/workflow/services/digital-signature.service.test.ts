import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock & { digitalSignature: any },
  };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { createSignature, getByDocument, getById, type CreateSignatureDto } from './digital-signature.service.js';

function createModelMock() {
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

describe('digital-signature.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as any).digitalSignature = createModelMock();
  });

  const validBase64DataUri = 'data:image/png;base64,iVBORw0KGgoAAAANS';
  const validRawBase64 = 'iVBORw0KGgoAAAANS';

  const validDto: CreateSignatureDto = {
    documentType: 'mirv',
    documentId: 'mirv-001',
    signedById: 'emp-001',
    signatureData: validBase64DataUri,
    purpose: 'approval',
    ipAddress: '192.168.1.1',
    notes: 'Approved',
  };

  // ---------------------------------------------------------------------------
  // createSignature — validation
  // ---------------------------------------------------------------------------
  describe('createSignature — validation', () => {
    it('should accept data URI format (data:image/png;base64,...)', async () => {
      mockPrisma.digitalSignature.create.mockResolvedValue({ id: 'sig-1' });

      await createSignature({ ...validDto, signatureData: validBase64DataUri });

      expect(mockPrisma.digitalSignature.create).toHaveBeenCalledOnce();
    });

    it('should accept raw base64 format', async () => {
      mockPrisma.digitalSignature.create.mockResolvedValue({ id: 'sig-1' });

      await createSignature({ ...validDto, signatureData: validRawBase64 });

      expect(mockPrisma.digitalSignature.create).toHaveBeenCalledOnce();
    });

    it('should reject empty data URI (data:image/png;base64, with nothing after)', async () => {
      await expect(createSignature({ ...validDto, signatureData: 'data:image/png;base64,' })).rejects.toThrow(
        'Signature data is empty',
      );
    });

    it('should reject invalid signature data (not base64, not data URI)', async () => {
      await expect(createSignature({ ...validDto, signatureData: '<script>alert("xss")</script>' })).rejects.toThrow(
        'Invalid signature data',
      );
    });

    it('should reject empty string as signature data', async () => {
      await expect(createSignature({ ...validDto, signatureData: '' })).rejects.toThrow('Invalid signature data');
    });

    it('should reject invalid purpose', async () => {
      await expect(createSignature({ ...validDto, purpose: 'invalid_purpose' })).rejects.toThrow('Invalid purpose');
    });

    it('should accept all valid purposes', async () => {
      const validPurposes = ['approval', 'delivery_confirmation', 'receipt', 'inspection', 'handover'];

      for (const purpose of validPurposes) {
        mockPrisma.digitalSignature.create.mockResolvedValue({ id: `sig-${purpose}` });
        await expect(createSignature({ ...validDto, purpose })).resolves.toBeDefined();
      }

      expect(mockPrisma.digitalSignature.create).toHaveBeenCalledTimes(validPurposes.length);
    });
  });

  // ---------------------------------------------------------------------------
  // createSignature — persistence
  // ---------------------------------------------------------------------------
  describe('createSignature — persistence', () => {
    it('should create a digital signature with all fields', async () => {
      const created = { id: 'sig-1', ...validDto };
      mockPrisma.digitalSignature.create.mockResolvedValue(created);

      const result = await createSignature(validDto);

      expect(result).toEqual(created);
      expect(mockPrisma.digitalSignature.create).toHaveBeenCalledWith({
        data: {
          documentType: 'mirv',
          documentId: 'mirv-001',
          signedById: 'emp-001',
          signatureData: validBase64DataUri,
          purpose: 'approval',
          ipAddress: '192.168.1.1',
          notes: 'Approved',
        },
        include: {
          signedBy: {
            select: { id: true, fullName: true, email: true, department: true, role: true },
          },
        },
      });
    });

    it('should set ipAddress to null when not provided', async () => {
      mockPrisma.digitalSignature.create.mockResolvedValue({ id: 'sig-2' });
      const dto = { ...validDto };
      delete dto.ipAddress;

      await createSignature(dto);

      const callArgs = mockPrisma.digitalSignature.create.mock.calls[0][0];
      expect(callArgs.data.ipAddress).toBeNull();
    });

    it('should set notes to null when not provided', async () => {
      mockPrisma.digitalSignature.create.mockResolvedValue({ id: 'sig-3' });
      const dto = { ...validDto };
      delete dto.notes;

      await createSignature(dto);

      const callArgs = mockPrisma.digitalSignature.create.mock.calls[0][0];
      expect(callArgs.data.notes).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getByDocument
  // ---------------------------------------------------------------------------
  describe('getByDocument', () => {
    it('should query signatures for document type and id', async () => {
      const sigs = [{ id: 'sig-1' }, { id: 'sig-2' }];
      mockPrisma.digitalSignature.findMany.mockResolvedValue(sigs);

      const result = await getByDocument('mirv', 'mirv-001');

      expect(result).toEqual(sigs);
      expect(mockPrisma.digitalSignature.findMany).toHaveBeenCalledWith({
        where: { documentType: 'mirv', documentId: 'mirv-001' },
        include: {
          signedBy: {
            select: { id: true, fullName: true, email: true, department: true, role: true },
          },
        },
        orderBy: { signedAt: 'desc' },
      });
    });

    it('should return empty array when no signatures exist', async () => {
      mockPrisma.digitalSignature.findMany.mockResolvedValue([]);

      const result = await getByDocument('mrv', 'mrv-999');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------
  describe('getById', () => {
    it('should return signature when found', async () => {
      const sig = { id: 'sig-1', purpose: 'approval' };
      mockPrisma.digitalSignature.findUnique.mockResolvedValue(sig);

      const result = await getById('sig-1');

      expect(result).toEqual(sig);
      expect(mockPrisma.digitalSignature.findUnique).toHaveBeenCalledWith({
        where: { id: 'sig-1' },
        include: {
          signedBy: {
            select: { id: true, fullName: true, email: true, department: true, role: true },
          },
        },
      });
    });

    it('should return null when signature not found', async () => {
      mockPrisma.digitalSignature.findUnique.mockResolvedValue(null);

      const result = await getById('missing');

      expect(result).toBeNull();
    });
  });
});
