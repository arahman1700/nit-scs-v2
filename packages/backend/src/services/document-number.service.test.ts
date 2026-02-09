import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('@nit-scs/shared/constants', () => ({
  DOC_PREFIXES: {
    mrrv: 'MRRV',
    mirv: 'MIRV',
    lot: 'LOT',
  } as Record<string, string>,
}));

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { generateDocumentNumber } from './document-number.service.js';

describe('document-number.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
  });

  const currentYear = new Date().getFullYear();

  describe('generateDocumentNumber', () => {
    it('should generate a document number with a known prefix', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ last_number: 1 }]);

      const result = await generateDocumentNumber('mrrv');

      expect(result).toBe(`MRRV-${currentYear}-0001`);
    });

    it('should use the correct prefix from DOC_PREFIXES', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ last_number: 1 }]);

      const result = await generateDocumentNumber('mirv');

      expect(result).toBe(`MIRV-${currentYear}-0001`);
    });

    it('should pad numbers to 4 digits', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ last_number: 7 }]);

      const result = await generateDocumentNumber('mirv');

      expect(result).toBe(`MIRV-${currentYear}-0007`);
    });

    it('should handle multi-digit counter values with padding', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ last_number: 123 }]);

      const result = await generateDocumentNumber('lot');

      expect(result).toBe(`LOT-${currentYear}-0123`);
    });

    it('should not truncate counter values exceeding 4 digits', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ last_number: 12345 }]);

      const result = await generateDocumentNumber('mrrv');

      expect(result).toBe(`MRRV-${currentYear}-12345`);
    });

    it('should use uppercase documentType as prefix for unknown types', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ last_number: 1 }]);

      const result = await generateDocumentNumber('purchase');

      expect(result).toBe(`PURCHASE-${currentYear}-0001`);
    });

    it('should call $queryRaw exactly once', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ last_number: 5 }]);

      await generateDocumentNumber('mrrv');

      expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
    });

    it('should propagate database errors', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection lost'));

      await expect(generateDocumentNumber('mrrv')).rejects.toThrow('Connection lost');
    });
  });
});
