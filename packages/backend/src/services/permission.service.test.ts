/**
 * Unit tests for permission.service.ts
 *
 * Tests cover:
 * - Cache behavior (TTL, invalidation)
 * - getAllPermissions (DB + fallback to ROLE_PERMISSIONS)
 * - getPermissionsForRole
 * - hasPermissionDB
 * - updatePermission (upsert + cache invalidation)
 * - updateRolePermissions (bulk upsert + transaction)
 * - resetToDefaults (single role + all roles)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaMock } from '../test-utils/prisma-mock.js';

// ── Hoisted Mocks ───────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('@nit-scs-v2/shared', () => ({
  ROLE_PERMISSIONS: {
    admin: { grn: ['read', 'write', 'delete'], mi: ['read', 'write'] },
    warehouse_staff: { grn: ['read'], mi: ['read'] },
  },
}));

// ── Imports (After Mocks) ───────────────────────────────────────────────

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  getAllPermissions,
  getPermissionsForRole,
  hasPermissionDB,
  updatePermission,
  updateRolePermissions,
  resetToDefaults,
  invalidatePermissionCache,
} from './permission.service.js';

// ── Test Suite ──────────────────────────────────────────────────────────

describe('permission.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // CRITICAL: Clear cache between tests to ensure isolation
    invalidatePermissionCache();
  });

  // ──────────────────────────────────────────────────────────────────────
  // getAllPermissions
  // ──────────────────────────────────────────────────────────────────────

  describe('getAllPermissions', () => {
    it('should return permissions from DB when available', async () => {
      const dbRows = [
        { role: 'admin', resource: 'grn', actions: ['read', 'write'] },
        { role: 'admin', resource: 'mi', actions: ['read'] },
        { role: 'viewer', resource: 'grn', actions: ['read'] },
      ];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      const result = await getAllPermissions();

      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledWith({
        orderBy: [{ role: 'asc' }, { resource: 'asc' }],
      });
      expect(result).toEqual({
        admin: { grn: ['read', 'write'], mi: ['read'] },
        viewer: { grn: ['read'] },
      });
    });

    it('should fall back to ROLE_PERMISSIONS when DB is empty', async () => {
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await getAllPermissions();

      expect(result).toEqual({
        admin: { grn: ['read', 'write', 'delete'], mi: ['read', 'write'] },
        warehouse_staff: { grn: ['read'], mi: ['read'] },
      });
    });

    it('should cache results and skip DB on second call', async () => {
      const dbRows = [{ role: 'admin', resource: 'grn', actions: ['read'] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      // First call - hits DB
      const result1 = await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ admin: { grn: ['read'] } });

      // Second call - uses cache
      const result2 = await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1); // Not called again
      expect(result2).toEqual({ admin: { grn: ['read'] } });
    });

    it('should invalidate cache after TTL expires', async () => {
      vi.useFakeTimers();
      const dbRows = [{ role: 'admin', resource: 'grn', actions: ['read'] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      // First call
      await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1);

      // Advance time 4 minutes (within TTL)
      vi.advanceTimersByTime(4 * 60 * 1000);
      await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1); // Still cached

      // Advance time beyond TTL (6 minutes total)
      vi.advanceTimersByTime(2 * 60 * 1000);
      await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(2); // Cache expired

      vi.useRealTimers();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getPermissionsForRole
  // ──────────────────────────────────────────────────────────────────────

  describe('getPermissionsForRole', () => {
    it('should return permissions for existing role', async () => {
      const dbRows = [
        { role: 'admin', resource: 'grn', actions: ['read', 'write'] },
        { role: 'admin', resource: 'mi', actions: ['read'] },
        { role: 'viewer', resource: 'grn', actions: ['read'] },
      ];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      const result = await getPermissionsForRole('admin');

      expect(result).toEqual({
        grn: ['read', 'write'],
        mi: ['read'],
      });
    });

    it('should return empty object for non-existent role', async () => {
      const dbRows = [{ role: 'admin', resource: 'grn', actions: ['read'] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      const result = await getPermissionsForRole('unknown_role');

      expect(result).toEqual({});
    });

    it('should use cached permissions', async () => {
      const dbRows = [{ role: 'admin', resource: 'grn', actions: ['read'] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      // First call to cache
      await getPermissionsForRole('admin');
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1);

      // Second call uses cache
      await getPermissionsForRole('admin');
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // hasPermissionDB
  // ──────────────────────────────────────────────────────────────────────

  describe('hasPermissionDB', () => {
    it('should return true when role has permission', async () => {
      const dbRows = [{ role: 'admin', resource: 'grn', actions: ['read', 'write', 'delete'] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      const result = await hasPermissionDB('admin', 'grn', 'write');

      expect(result).toBe(true);
    });

    it('should return false when role lacks permission', async () => {
      const dbRows = [{ role: 'admin', resource: 'grn', actions: ['read'] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      const result = await hasPermissionDB('admin', 'grn', 'delete');

      expect(result).toBe(false);
    });

    it('should return false when resource does not exist for role', async () => {
      const dbRows = [{ role: 'admin', resource: 'grn', actions: ['read'] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      const result = await hasPermissionDB('admin', 'unknown_resource', 'read');

      expect(result).toBe(false);
    });

    it('should return false when role does not exist', async () => {
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await hasPermissionDB('unknown_role', 'grn', 'read');

      expect(result).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // updatePermission
  // ──────────────────────────────────────────────────────────────────────

  describe('updatePermission', () => {
    it('should upsert permission and invalidate cache', async () => {
      mockPrisma.rolePermission.upsert.mockResolvedValue({
        role: 'admin',
        resource: 'grn',
        actions: ['read', 'write'],
        updatedBy: 'user123',
      });

      // Cache some data first
      mockPrisma.rolePermission.findMany.mockResolvedValue([{ role: 'admin', resource: 'grn', actions: ['read'] }]);
      await getAllPermissions(); // Populate cache

      // Update permission
      await updatePermission('admin', 'grn', ['read', 'write'], 'user123');

      expect(mockPrisma.rolePermission.upsert).toHaveBeenCalledWith({
        where: { role_resource: { role: 'admin', resource: 'grn' } },
        update: { actions: ['read', 'write'], updatedBy: 'user123' },
        create: { role: 'admin', resource: 'grn', actions: ['read', 'write'], updatedBy: 'user123' },
      });

      // Verify cache was invalidated by checking DB is called again
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { role: 'admin', resource: 'grn', actions: ['read', 'write'] },
      ]);
      await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(2); // Cache was cleared
    });

    it('should upsert without updatedBy parameter', async () => {
      mockPrisma.rolePermission.upsert.mockResolvedValue({
        role: 'viewer',
        resource: 'mi',
        actions: ['read'],
        updatedBy: null,
      });

      await updatePermission('viewer', 'mi', ['read']);

      expect(mockPrisma.rolePermission.upsert).toHaveBeenCalledWith({
        where: { role_resource: { role: 'viewer', resource: 'mi' } },
        update: { actions: ['read'], updatedBy: undefined },
        create: { role: 'viewer', resource: 'mi', actions: ['read'], updatedBy: undefined },
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // updateRolePermissions (bulk)
  // ──────────────────────────────────────────────────────────────────────

  describe('updateRolePermissions', () => {
    it('should bulk upsert permissions in a transaction', async () => {
      const permissions = {
        grn: ['read', 'write'],
        mi: ['read'],
      };

      await updateRolePermissions('admin', permissions, 'user456');

      // Verify transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verify the transaction contains the right upsert operations
      const txArg = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
      expect(txArg).toHaveLength(2);
    });

    it('should invalidate cache after bulk update', async () => {
      const permissions = { grn: ['read'] };

      // Populate cache
      mockPrisma.rolePermission.findMany.mockResolvedValue([{ role: 'admin', resource: 'grn', actions: ['read'] }]);
      await getAllPermissions();

      // Bulk update
      await updateRolePermissions('admin', permissions);

      // Verify cache invalidated
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { role: 'admin', resource: 'grn', actions: ['read', 'write'] },
      ]);
      await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(2);
    });

    it('should handle empty permissions object', async () => {
      await updateRolePermissions('admin', {});

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // resetToDefaults
  // ──────────────────────────────────────────────────────────────────────

  describe('resetToDefaults', () => {
    it('should reset all roles when no role specified', async () => {
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 4 });

      await resetToDefaults();

      expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({});
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { role: 'admin', resource: 'grn', actions: ['read', 'write', 'delete'] },
          { role: 'admin', resource: 'mi', actions: ['read', 'write'] },
          { role: 'warehouse_staff', resource: 'grn', actions: ['read'] },
          { role: 'warehouse_staff', resource: 'mi', actions: ['read'] },
        ],
      });
    });

    it('should reset single role when specified', async () => {
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 2 });

      await resetToDefaults('admin');

      expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { role: 'admin' },
      });
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { role: 'admin', resource: 'grn', actions: ['read', 'write', 'delete'] },
          { role: 'admin', resource: 'mi', actions: ['read', 'write'] },
        ],
      });
    });

    it('should do nothing if role does not exist in ROLE_PERMISSIONS', async () => {
      await resetToDefaults('unknown_role');

      expect(mockPrisma.rolePermission.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.rolePermission.createMany).not.toHaveBeenCalled();
    });

    it('should invalidate cache after reset', async () => {
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 2 });

      // Populate cache
      mockPrisma.rolePermission.findMany.mockResolvedValue([{ role: 'admin', resource: 'grn', actions: ['read'] }]);
      await getAllPermissions();

      // Reset
      await resetToDefaults('admin');

      // Verify cache invalidated
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { role: 'admin', resource: 'grn', actions: ['read', 'write', 'delete'] },
      ]);
      await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // invalidatePermissionCache
  // ──────────────────────────────────────────────────────────────────────

  describe('invalidatePermissionCache', () => {
    it('should clear cache and force DB fetch on next call', async () => {
      // Populate cache
      mockPrisma.rolePermission.findMany.mockResolvedValue([{ role: 'admin', resource: 'grn', actions: ['read'] }]);
      await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1);

      // Invalidate cache
      invalidatePermissionCache();

      // Next call should hit DB
      await getAllPermissions();
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Edge Cases & Integration
  // ──────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty actions array in hasPermissionDB', async () => {
      const dbRows = [{ role: 'admin', resource: 'grn', actions: [] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      const result = await hasPermissionDB('admin', 'grn', 'read');

      expect(result).toBe(false);
    });

    it('should handle multiple resources for same role in getAllPermissions', async () => {
      const dbRows = [
        { role: 'admin', resource: 'grn', actions: ['read', 'write'] },
        { role: 'admin', resource: 'mi', actions: ['read'] },
        { role: 'admin', resource: 'dr', actions: ['read', 'write', 'delete'] },
      ];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      const result = await getAllPermissions();

      expect(result).toEqual({
        admin: {
          grn: ['read', 'write'],
          mi: ['read'],
          dr: ['read', 'write', 'delete'],
        },
      });
    });

    it('should handle cache fallback with multiple roles', async () => {
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await getAllPermissions();

      expect(result).toHaveProperty('admin');
      expect(result).toHaveProperty('warehouse_staff');
      expect(result.admin).toHaveProperty('grn');
      expect(result.admin).toHaveProperty('mi');
    });

    it('should preserve cache between getPermissionsForRole and hasPermissionDB calls', async () => {
      const dbRows = [{ role: 'admin', resource: 'grn', actions: ['read', 'write'] }];
      mockPrisma.rolePermission.findMany.mockResolvedValue(dbRows);

      // Three different operations
      await getPermissionsForRole('admin');
      await hasPermissionDB('admin', 'grn', 'read');
      const all = await getAllPermissions();

      // Should only hit DB once due to cache
      expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1);
      expect(all).toEqual({ admin: { grn: ['read', 'write'] } });
    });
  });
});
