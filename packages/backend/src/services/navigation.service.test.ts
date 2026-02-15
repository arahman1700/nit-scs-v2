import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('@nit-scs-v2/shared', () => ({
  UserRole: {
    ADMIN: 'ADMIN',
    WAREHOUSE_SUPERVISOR: 'WAREHOUSE_SUPERVISOR',
    WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
    FREIGHT_FORWARDER: 'FREIGHT_FORWARDER',
    MANAGER: 'MANAGER',
    QC_OFFICER: 'QC_OFFICER',
    LOGISTICS_COORDINATOR: 'LOGISTICS_COORDINATOR',
    SITE_ENGINEER: 'SITE_ENGINEER',
    TRANSPORT_SUPERVISOR: 'TRANSPORT_SUPERVISOR',
    SCRAP_COMMITTEE_MEMBER: 'SCRAP_COMMITTEE_MEMBER',
  },
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  getNavigationForRole,
  updateNavigationOrder,
  hideNavigationItem,
  showNavigationItem,
  invalidateNavCache,
} from './navigation.service.js';

describe('navigation.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    invalidateNavCache(); // Clear cache between tests
  });

  // ---------------------------------------------------------------------------
  // getNavigationForRole
  // ---------------------------------------------------------------------------
  describe('getNavigationForRole', () => {
    it('returns static nav items for ADMIN', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const result = await getNavigationForRole('ADMIN');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual(expect.objectContaining({ label: 'Dashboard', path: '/admin' }));
      // ADMIN has several top-level items including Warehouses, Equipment, Scrap, etc.
      const labels = result.map(item => item.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Warehouses & Stores');
      expect(labels).toContain('Equipment & Transport');
      expect(labels).toContain('Settings');
    });

    it('returns static nav items for WAREHOUSE_SUPERVISOR', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const result = await getNavigationForRole('WAREHOUSE_SUPERVISOR');

      const labels = result.map(item => item.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Operations');
      expect(labels).toContain('Inventory');
    });

    it('returns cached result on second call (no additional DB queries)', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const first = await getNavigationForRole('ADMIN');
      const second = await getNavigationForRole('ADMIN');

      expect(first).toBe(second); // Same reference — from cache
      // DB should only be queried once
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.navigationOverride.findMany).toHaveBeenCalledTimes(1);
    });

    it('returns empty array for unknown role', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const result = await getNavigationForRole('NON_EXISTENT_ROLE');

      expect(result).toEqual([]);
    });

    it('includes dynamic doc types visible to the role', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
        { code: 'custom-form', name: 'Custom Form', visibleToRoles: ['ADMIN', 'MANAGER'] },
        { code: 'site-report', name: 'Site Report', visibleToRoles: ['SITE_ENGINEER'] },
      ]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const result = await getNavigationForRole('ADMIN');

      // Should include the 'Custom Documents' parent with 'Custom Form' child
      const customDocs = result.find(item => item.label === 'Custom Documents');
      expect(customDocs).toBeDefined();
      expect(customDocs!.children).toHaveLength(1);
      expect(customDocs!.children![0]).toEqual(
        expect.objectContaining({ label: 'Custom Form', path: '/admin/dynamic/custom-form' }),
      );
    });

    it('includes dynamic doc types visible to wildcard (*)', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
        { code: 'global-doc', name: 'Global Doc', visibleToRoles: ['*'] },
      ]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const result = await getNavigationForRole('SITE_ENGINEER');

      const customDocs = result.find(item => item.label === 'Custom Documents');
      expect(customDocs).toBeDefined();
      expect(customDocs!.children).toHaveLength(1);
      expect(customDocs!.children![0].label).toBe('Global Doc');
    });

    it('excludes dynamic doc types not visible to the role', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
        { code: 'admin-only', name: 'Admin Only', visibleToRoles: ['ADMIN'] },
      ]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const result = await getNavigationForRole('WAREHOUSE_STAFF');

      const customDocs = result.find(item => item.label === 'Custom Documents');
      expect(customDocs).toBeUndefined();
    });

    it('filters out hidden items via overrides', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([
        { role: 'ADMIN', path: '/admin/map', hidden: true, sortOrder: 0, parentPath: null },
      ]);

      const result = await getNavigationForRole('ADMIN');

      const labels = result.map(item => item.label);
      expect(labels).not.toContain('Interactive Map');
    });

    it('applies sort order from overrides', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      // Push 'Settings' to the top (negative sort) and 'Dashboard' lower
      mockPrisma.navigationOverride.findMany.mockResolvedValue([
        { role: 'ADMIN', path: '/admin/settings', hidden: false, sortOrder: -100, parentPath: null },
        { role: 'ADMIN', path: '/admin', hidden: false, sortOrder: 100, parentPath: null },
      ]);

      const result = await getNavigationForRole('ADMIN');

      const settingsIdx = result.findIndex(item => item.label === 'Settings');
      const dashboardIdx = result.findIndex(item => item.label === 'Dashboard');
      expect(settingsIdx).toBeLessThan(dashboardIdx);
    });

    it('does not include Custom Documents group when no dynamic types are visible', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
        { code: 'internal', name: 'Internal', visibleToRoles: ['ADMIN'] },
      ]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const result = await getNavigationForRole('QC_OFFICER');

      const customDocs = result.find(item => item.label === 'Custom Documents');
      expect(customDocs).toBeUndefined();
    });

    it('queries dynamicDocumentType with isActive filter', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      await getNavigationForRole('ADMIN');

      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { code: true, name: true, visibleToRoles: true },
        orderBy: { name: 'asc' },
      });
    });

    it('queries navigationOverride by role', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      await getNavigationForRole('MANAGER');

      expect(mockPrisma.navigationOverride.findMany).toHaveBeenCalledWith({
        where: { role: 'MANAGER' },
      });
    });

    it('returns static nav for all 10 roles', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      const roles = [
        'ADMIN',
        'WAREHOUSE_SUPERVISOR',
        'WAREHOUSE_STAFF',
        'FREIGHT_FORWARDER',
        'MANAGER',
        'QC_OFFICER',
        'LOGISTICS_COORDINATOR',
        'SITE_ENGINEER',
        'TRANSPORT_SUPERVISOR',
        'SCRAP_COMMITTEE_MEMBER',
      ];

      for (const role of roles) {
        invalidateNavCache(); // Clear cache so each role hits DB
        const result = await getNavigationForRole(role);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('label');
        expect(result[0]).toHaveProperty('path');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // updateNavigationOrder
  // ---------------------------------------------------------------------------
  describe('updateNavigationOrder', () => {
    it('calls $transaction with upsert operations', async () => {
      mockPrisma.navigationOverride.upsert.mockResolvedValue({});

      const overrides = [
        { path: '/admin', sortOrder: 1 },
        { path: '/admin/settings', sortOrder: 2, parentPath: '/admin' },
      ];

      await updateNavigationOrder('ADMIN', overrides);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // The $transaction receives an array of promises (from upsert calls)
      const transactionArg = mockPrisma.$transaction.mock.calls[0][0];
      expect(Array.isArray(transactionArg)).toBe(true);
      expect(transactionArg).toHaveLength(2);
    });

    it('builds correct upsert arguments for each override', async () => {
      mockPrisma.navigationOverride.upsert.mockResolvedValue({});

      await updateNavigationOrder('ADMIN', [{ path: '/admin/map', sortOrder: 5 }]);

      expect(mockPrisma.navigationOverride.upsert).toHaveBeenCalledWith({
        where: { role_path: { role: 'ADMIN', path: '/admin/map' } },
        create: {
          role: 'ADMIN',
          path: '/admin/map',
          sortOrder: 5,
          parentPath: null,
        },
        update: {
          sortOrder: 5,
          parentPath: null,
        },
      });
    });

    it('passes parentPath when provided', async () => {
      mockPrisma.navigationOverride.upsert.mockResolvedValue({});

      await updateNavigationOrder('ADMIN', [{ path: '/admin/settings', sortOrder: 3, parentPath: '/admin' }]);

      expect(mockPrisma.navigationOverride.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ parentPath: '/admin' }),
          update: expect.objectContaining({ parentPath: '/admin' }),
        }),
      );
    });

    it('invalidates cache after updating', async () => {
      mockPrisma.navigationOverride.upsert.mockResolvedValue({});
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      // Populate cache
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(1);

      // Update order — should invalidate
      await updateNavigationOrder('ADMIN', [{ path: '/admin', sortOrder: 1 }]);

      // Next get should re-query DB
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(2);
    });

    it('handles empty overrides array', async () => {
      await updateNavigationOrder('ADMIN', []);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([]);
      expect(mockPrisma.navigationOverride.upsert).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // hideNavigationItem
  // ---------------------------------------------------------------------------
  describe('hideNavigationItem', () => {
    it('upserts override with hidden=true', async () => {
      mockPrisma.navigationOverride.upsert.mockResolvedValue({});

      await hideNavigationItem('ADMIN', '/admin/map');

      expect(mockPrisma.navigationOverride.upsert).toHaveBeenCalledWith({
        where: { role_path: { role: 'ADMIN', path: '/admin/map' } },
        create: { role: 'ADMIN', path: '/admin/map', hidden: true },
        update: { hidden: true },
      });
    });

    it('invalidates cache after hiding', async () => {
      mockPrisma.navigationOverride.upsert.mockResolvedValue({});
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      // Populate cache
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(1);

      // Hide item — should invalidate
      await hideNavigationItem('ADMIN', '/admin/map');

      // Next get should re-query DB
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(2);
    });

    it('works for non-ADMIN roles', async () => {
      mockPrisma.navigationOverride.upsert.mockResolvedValue({});

      await hideNavigationItem('WAREHOUSE_SUPERVISOR', '/warehouse/inventory');

      expect(mockPrisma.navigationOverride.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role_path: { role: 'WAREHOUSE_SUPERVISOR', path: '/warehouse/inventory' } },
          create: expect.objectContaining({ role: 'WAREHOUSE_SUPERVISOR' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // showNavigationItem
  // ---------------------------------------------------------------------------
  describe('showNavigationItem', () => {
    it('deletes override when sortOrder=0 and no parentPath', async () => {
      mockPrisma.navigationOverride.findUnique.mockResolvedValue({
        role: 'ADMIN',
        path: '/admin/map',
        hidden: true,
        sortOrder: 0,
        parentPath: null,
      });
      mockPrisma.navigationOverride.delete.mockResolvedValue({});

      await showNavigationItem('ADMIN', '/admin/map');

      expect(mockPrisma.navigationOverride.delete).toHaveBeenCalledWith({
        where: { role_path: { role: 'ADMIN', path: '/admin/map' } },
      });
      expect(mockPrisma.navigationOverride.update).not.toHaveBeenCalled();
    });

    it('updates hidden=false when override has sortOrder', async () => {
      mockPrisma.navigationOverride.findUnique.mockResolvedValue({
        role: 'ADMIN',
        path: '/admin/map',
        hidden: true,
        sortOrder: 5,
        parentPath: null,
      });
      mockPrisma.navigationOverride.update.mockResolvedValue({});

      await showNavigationItem('ADMIN', '/admin/map');

      expect(mockPrisma.navigationOverride.update).toHaveBeenCalledWith({
        where: { role_path: { role: 'ADMIN', path: '/admin/map' } },
        data: { hidden: false },
      });
      expect(mockPrisma.navigationOverride.delete).not.toHaveBeenCalled();
    });

    it('updates hidden=false when override has parentPath', async () => {
      mockPrisma.navigationOverride.findUnique.mockResolvedValue({
        role: 'ADMIN',
        path: '/admin/settings',
        hidden: true,
        sortOrder: 0,
        parentPath: '/admin',
      });
      mockPrisma.navigationOverride.update.mockResolvedValue({});

      await showNavigationItem('ADMIN', '/admin/settings');

      expect(mockPrisma.navigationOverride.update).toHaveBeenCalledWith({
        where: { role_path: { role: 'ADMIN', path: '/admin/settings' } },
        data: { hidden: false },
      });
      expect(mockPrisma.navigationOverride.delete).not.toHaveBeenCalled();
    });

    it('does nothing if override not found', async () => {
      mockPrisma.navigationOverride.findUnique.mockResolvedValue(null);

      await showNavigationItem('ADMIN', '/admin/map');

      expect(mockPrisma.navigationOverride.delete).not.toHaveBeenCalled();
      expect(mockPrisma.navigationOverride.update).not.toHaveBeenCalled();
    });

    it('invalidates cache after showing (delete path)', async () => {
      mockPrisma.navigationOverride.findUnique.mockResolvedValue({
        role: 'ADMIN',
        path: '/admin/map',
        hidden: true,
        sortOrder: 0,
        parentPath: null,
      });
      mockPrisma.navigationOverride.delete.mockResolvedValue({});
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      // Populate cache
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(1);

      // Show item — should invalidate
      await showNavigationItem('ADMIN', '/admin/map');

      // Next get should re-query DB
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(2);
    });

    it('invalidates cache after showing (update path)', async () => {
      mockPrisma.navigationOverride.findUnique.mockResolvedValue({
        role: 'ADMIN',
        path: '/admin/map',
        hidden: true,
        sortOrder: 10,
        parentPath: null,
      });
      mockPrisma.navigationOverride.update.mockResolvedValue({});
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      // Populate cache
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(1);

      // Show item — should invalidate
      await showNavigationItem('ADMIN', '/admin/map');

      // Next get should re-query DB
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(2);
    });

    it('does NOT invalidate cache when override not found', async () => {
      mockPrisma.navigationOverride.findUnique.mockResolvedValue(null);
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      // Populate cache
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(1);

      // Show non-existent item — returns early before invalidation
      // Note: The service still calls invalidateNavCache even when not found?
      // Re-checking: the service returns early with `if (!existing) return;` BEFORE invalidateNavCache
      await showNavigationItem('ADMIN', '/nonexistent');

      // Cache should still be valid
      await getNavigationForRole('ADMIN');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(1);
    });

    it('looks up override with correct compound key', async () => {
      mockPrisma.navigationOverride.findUnique.mockResolvedValue(null);

      await showNavigationItem('QC_OFFICER', '/qc/tasks');

      expect(mockPrisma.navigationOverride.findUnique).toHaveBeenCalledWith({
        where: { role_path: { role: 'QC_OFFICER', path: '/qc/tasks' } },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // invalidateNavCache
  // ---------------------------------------------------------------------------
  describe('invalidateNavCache', () => {
    it('with role deletes only that role from cache', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      // Populate cache for two roles
      await getNavigationForRole('ADMIN');
      await getNavigationForRole('MANAGER');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(2);

      // Invalidate only ADMIN
      invalidateNavCache('ADMIN');

      // ADMIN should re-query; MANAGER should use cache
      await getNavigationForRole('ADMIN');
      await getNavigationForRole('MANAGER');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(3); // +1 for ADMIN only
    });

    it('without role clears all cached roles', async () => {
      mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
      mockPrisma.navigationOverride.findMany.mockResolvedValue([]);

      // Populate cache for two roles
      await getNavigationForRole('ADMIN');
      await getNavigationForRole('MANAGER');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(2);

      // Invalidate all
      invalidateNavCache();

      // Both should re-query
      await getNavigationForRole('ADMIN');
      await getNavigationForRole('MANAGER');
      expect(mockPrisma.dynamicDocumentType.findMany).toHaveBeenCalledTimes(4); // +2
    });

    it('is idempotent — invalidating empty cache does not throw', () => {
      expect(() => invalidateNavCache()).not.toThrow();
      expect(() => invalidateNavCache('ADMIN')).not.toThrow();
    });
  });
});
