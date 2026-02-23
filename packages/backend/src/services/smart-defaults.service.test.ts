/**
 * Tests for Smart Defaults Service
 * Covers cache behavior, defaults retrieval, suggestions, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaMock } from '../test-utils/prisma-mock.js';

// Hoisted mocks
const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

// Import service after mocks
import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { getUserDefaults, suggestWarehouse, suggestProject, invalidateUserDefaults } from './smart-defaults.service.js';

describe('Smart Defaults Service', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // Clear cache before each test to ensure isolation
    invalidateUserDefaults(userId);
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up cache after each test
    invalidateUserDefaults(userId);
  });

  describe('getUserDefaults', () => {
    it('should fetch all defaults in parallel on first call', async () => {
      const mockWarehouses = [
        { id: 'wh1', warehouseName: 'Main Warehouse', usage_count: 10n },
        { id: 'wh2', warehouseName: 'Storage B', usage_count: 5n },
      ];
      const mockProjects = [{ id: 'proj1', projectName: 'Project Alpha', usage_count: 8n }];
      const mockSuppliers = [{ id: 'sup1', supplierName: 'Supplier A', usage_count: 12n }];
      const mockItems = [
        {
          id: 'item1',
          itemCode: 'ITM001',
          itemDescription: 'Steel Bars',
          last_used: new Date('2026-02-20'),
        },
      ];

      // Mock $queryRaw to return different results for each query
      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockSuppliers)
        .mockResolvedValueOnce(mockItems);

      const result = await getUserDefaults(userId);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);
      expect(result).toEqual({
        warehouses: [
          { id: 'wh1', name: 'Main Warehouse', count: 10 },
          { id: 'wh2', name: 'Storage B', count: 5 },
        ],
        projects: [{ id: 'proj1', name: 'Project Alpha', count: 8 }],
        suppliers: [{ id: 'sup1', name: 'Supplier A', count: 12 }],
        recentItems: [
          {
            id: 'item1',
            code: 'ITM001',
            description: 'Steel Bars',
            lastUsed: new Date('2026-02-20'),
          },
        ],
      });
    });

    it('should return cached data on subsequent calls within TTL', async () => {
      const mockWarehouses = [{ id: 'wh1', warehouseName: 'Main Warehouse', usage_count: 10n }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // First call - fetches from DB
      const result1 = await getUserDefaults(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);

      // Second call - should use cache
      const result2 = await getUserDefaults(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4); // Still 4, not 8
      expect(result2).toEqual(result1);
    });

    it('should refetch data after cache invalidation', async () => {
      const mockWarehouses = [{ id: 'wh1', warehouseName: 'Main Warehouse', usage_count: 10n }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // First call
      await getUserDefaults(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);

      // Invalidate cache
      invalidateUserDefaults(userId);

      // Second call - should refetch
      await getUserDefaults(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(8);
    });

    it('should handle empty results gracefully', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getUserDefaults(userId);

      expect(result).toEqual({
        warehouses: [],
        projects: [],
        suppliers: [],
        recentItems: [],
      });
    });

    it('should convert bigint usage_count to number', async () => {
      const mockWarehouses = [{ id: 'wh1', warehouseName: 'Main Warehouse', usage_count: 999n }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getUserDefaults(userId);

      expect(result.warehouses[0].count).toBe(999);
      expect(typeof result.warehouses[0].count).toBe('number');
    });

    it('should handle warehouse query errors and return empty array', async () => {
      mockPrisma.$queryRaw
        .mockRejectedValueOnce(new Error('Database connection failed'))
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getUserDefaults(userId);

      expect(result.warehouses).toEqual([]);
      expect(result.projects).toEqual([]);
    });

    it('should handle project query errors and return empty array', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getUserDefaults(userId);

      expect(result.warehouses).toEqual([]);
      expect(result.projects).toEqual([]);
    });

    it('should handle supplier query errors and return empty array', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Query failed'))
        .mockResolvedValueOnce([]);

      const result = await getUserDefaults(userId);

      expect(result.suppliers).toEqual([]);
    });

    it('should handle recent items query errors and return empty array', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Complex query failed'));

      const result = await getUserDefaults(userId);

      expect(result.recentItems).toEqual([]);
    });

    it('should handle partial failures gracefully', async () => {
      const mockProjects = [{ id: 'proj1', projectName: 'Project Alpha', usage_count: 8n }];

      mockPrisma.$queryRaw
        .mockRejectedValueOnce(new Error('Warehouses failed'))
        .mockResolvedValueOnce(mockProjects)
        .mockRejectedValueOnce(new Error('Suppliers failed'))
        .mockResolvedValueOnce([]);

      const result = await getUserDefaults(userId);

      expect(result.warehouses).toEqual([]);
      expect(result.projects).toEqual([{ id: 'proj1', name: 'Project Alpha', count: 8 }]);
      expect(result.suppliers).toEqual([]);
      expect(result.recentItems).toEqual([]);
    });
  });

  describe('suggestWarehouse', () => {
    it('should return first warehouse ID when defaults exist', async () => {
      const mockWarehouses = [
        { id: 'wh1', warehouseName: 'Main Warehouse', usage_count: 10n },
        { id: 'wh2', warehouseName: 'Storage B', usage_count: 5n },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await suggestWarehouse(userId);

      expect(result).toBe('wh1');
    });

    it('should return null when no warehouses in defaults', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await suggestWarehouse(userId);

      expect(result).toBeNull();
    });

    it('should use cached data when available', async () => {
      const mockWarehouses = [{ id: 'wh1', warehouseName: 'Main Warehouse', usage_count: 10n }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // First call
      await suggestWarehouse(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);

      // Second call should use cache
      const result = await suggestWarehouse(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4); // Still 4
      expect(result).toBe('wh1');
    });
  });

  describe('suggestProject', () => {
    it('should return first project ID when defaults exist', async () => {
      const mockProjects = [
        { id: 'proj1', projectName: 'Project Alpha', usage_count: 8n },
        { id: 'proj2', projectName: 'Project Beta', usage_count: 3n },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await suggestProject(userId);

      expect(result).toBe('proj1');
    });

    it('should return null when no projects in defaults', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await suggestProject(userId);

      expect(result).toBeNull();
    });

    it('should use cached data when available', async () => {
      const mockProjects = [{ id: 'proj1', projectName: 'Project Alpha', usage_count: 8n }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // First call
      await suggestProject(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);

      // Second call should use cache
      const result = await suggestProject(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4); // Still 4
      expect(result).toBe('proj1');
    });
  });

  describe('invalidateUserDefaults', () => {
    it('should clear cache for specific user', async () => {
      const mockWarehouses = [{ id: 'wh1', warehouseName: 'Main Warehouse', usage_count: 10n }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Populate cache
      await getUserDefaults(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);

      // Invalidate
      invalidateUserDefaults(userId);

      // Next call should refetch
      await getUserDefaults(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(8);
    });

    it('should not affect other users caches', async () => {
      const userId2 = '00000000-0000-0000-0000-000000000002';
      const mockWarehouses = [{ id: 'wh1', warehouseName: 'Main Warehouse', usage_count: 10n }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Populate cache for both users
      await getUserDefaults(userId);
      await getUserDefaults(userId2);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(8);

      // Invalidate only userId
      invalidateUserDefaults(userId);

      // userId should refetch, userId2 should use cache
      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockWarehouses)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await getUserDefaults(userId);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(12); // 8 + 4

      await getUserDefaults(userId2);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(12); // Still 12, used cache

      // Clean up
      invalidateUserDefaults(userId2);
    });

    it('should be safe to call when cache is already empty', () => {
      expect(() => invalidateUserDefaults(userId)).not.toThrow();
      expect(() => invalidateUserDefaults('non-existent-user')).not.toThrow();
    });
  });
});
