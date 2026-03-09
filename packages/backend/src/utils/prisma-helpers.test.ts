import { getPrismaDelegate } from './prisma-helpers.js';

describe('prisma-helpers', () => {
  // ---------------------------------------------------------------------------
  // getPrismaDelegate
  // ---------------------------------------------------------------------------
  describe('getPrismaDelegate', () => {
    it('should return the delegate for a valid model name', () => {
      const mockDelegate = { findMany: vi.fn(), create: vi.fn() };
      const mockPrisma = { mrrv: mockDelegate } as any;

      const result = getPrismaDelegate(mockPrisma, 'mrrv');

      expect(result).toBe(mockDelegate);
    });

    it('should return typed delegate when generic is provided', () => {
      interface MyDelegate {
        findUnique: (args: unknown) => Promise<unknown>;
      }
      const mockDelegate = { findUnique: vi.fn() };
      const mockPrisma = { item: mockDelegate } as any;

      const result = getPrismaDelegate<MyDelegate>(mockPrisma, 'item');

      expect(result.findUnique).toBe(mockDelegate.findUnique);
    });

    it('should return undefined for non-existent model name', () => {
      const mockPrisma = {} as any;

      const result = getPrismaDelegate(mockPrisma, 'nonExistent');

      expect(result).toBeUndefined();
    });

    it('should work with camelCase model names', () => {
      const delegate = { findMany: vi.fn() };
      const mockPrisma = { stockTransfer: delegate } as any;

      const result = getPrismaDelegate(mockPrisma, 'stockTransfer');

      expect(result).toBe(delegate);
    });

    it('should return the same reference as the original prisma property', () => {
      const delegate = { findMany: vi.fn(), count: vi.fn() };
      const mockPrisma = { warehouse: delegate } as any;

      const result1 = getPrismaDelegate(mockPrisma, 'warehouse');
      const result2 = getPrismaDelegate(mockPrisma, 'warehouse');

      expect(result1).toBe(result2);
      expect(result1).toBe(delegate);
    });

    it('should work with various model names used in the project', () => {
      const delegates: Record<string, any> = {
        employee: { findMany: vi.fn() },
        mirv: { findMany: vi.fn() },
        jobOrder: { findMany: vi.fn() },
        osdReport: { findMany: vi.fn() },
        inventoryLot: { findMany: vi.fn() },
      };
      const mockPrisma = delegates as any;

      for (const [name, delegate] of Object.entries(delegates)) {
        const result = getPrismaDelegate(mockPrisma, name);
        expect(result).toBe(delegate);
      }
    });

    it('should handle default generic type (DefaultDelegate)', () => {
      const delegate = { someMethod: vi.fn().mockResolvedValue('result') };
      const mockPrisma = { custom: delegate } as any;

      const result = getPrismaDelegate(mockPrisma, 'custom');

      // Default type is Record<string, (...args: any[]) => Promise<unknown>>
      expect(result).toBe(delegate);
    });

    it('should not throw for any model name', () => {
      const mockPrisma = {} as any;

      expect(() => getPrismaDelegate(mockPrisma, '')).not.toThrow();
      expect(() => getPrismaDelegate(mockPrisma, 'undefined')).not.toThrow();
      expect(() => getPrismaDelegate(mockPrisma, 'constructor')).not.toThrow();
    });

    it('should allow calling methods on the returned delegate', async () => {
      const delegate = {
        findMany: vi.fn().mockResolvedValue([{ id: '1' }]),
        create: vi.fn().mockResolvedValue({ id: '2' }),
      };
      const mockPrisma = { supplier: delegate } as any;

      const result = getPrismaDelegate<typeof delegate>(mockPrisma, 'supplier');

      const items = await result.findMany({});
      expect(items).toEqual([{ id: '1' }]);

      const created = await result.create({ data: {} });
      expect(created).toEqual({ id: '2' });
    });

    it('should access delegate properties correctly', () => {
      const delegate = {
        $name: 'warehouse',
        findMany: vi.fn(),
      };
      const mockPrisma = { warehouse: delegate } as any;

      const result = getPrismaDelegate<typeof delegate>(mockPrisma, 'warehouse');

      expect(result.$name).toBe('warehouse');
    });
  });
});
