import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canCreate,
  canRead,
  canUpdate,
  canDelete,
  canApprove,
  canExport,
  getMaxApprovalLevel,
  getRequiredApprovalLevel,
  getPermissionMatrix,
  getEffectivePermissions,
  hasPermissionWithOverrides,
  ROLE_PERMISSIONS,
} from './permissions.js';
import { UserRole } from './types/enums.js';

// ── hasPermission ───────────────────────────────────────────────────────

describe('hasPermission', () => {
  it('returns true for admin on all resources', () => {
    const resources = Object.keys(ROLE_PERMISSIONS[UserRole.ADMIN]);
    for (const resource of resources) {
      expect(hasPermission(UserRole.ADMIN, resource, 'read')).toBe(true);
    }
  });

  it('returns false for unknown role', () => {
    expect(hasPermission('nonexistent_role', 'mrrv', 'read')).toBe(false);
  });

  it('returns false for unknown resource', () => {
    expect(hasPermission(UserRole.ADMIN, 'nonexistent_resource', 'read')).toBe(false);
  });

  it('returns false for permission not in resource', () => {
    // QC officer cannot delete rfim
    expect(hasPermission(UserRole.QC_OFFICER, 'rfim', 'delete')).toBe(false);
  });
});

// ── Convenience functions ───────────────────────────────────────────────

describe('canCreate', () => {
  it('admin can create mrrv', () => {
    expect(canCreate(UserRole.ADMIN, 'mrrv')).toBe(true);
  });

  it('warehouse staff can create mrrv', () => {
    expect(canCreate(UserRole.WAREHOUSE_STAFF, 'mrrv')).toBe(true);
  });

  it('freight forwarder cannot create shipment', () => {
    expect(canCreate(UserRole.FREIGHT_FORWARDER, 'shipment')).toBe(false);
  });
});

describe('canRead', () => {
  it('manager can read documents', () => {
    expect(canRead(UserRole.MANAGER, 'mrrv')).toBe(true);
    expect(canRead(UserRole.MANAGER, 'mirv')).toBe(true);
    expect(canRead(UserRole.MANAGER, 'jo')).toBe(true);
  });

  it('freight forwarder can read shipment', () => {
    expect(canRead(UserRole.FREIGHT_FORWARDER, 'shipment')).toBe(true);
  });
});

describe('canUpdate', () => {
  it('warehouse staff can update mrrv', () => {
    expect(canUpdate(UserRole.WAREHOUSE_STAFF, 'mrrv')).toBe(true);
  });

  it('freight forwarder can update shipment', () => {
    expect(canUpdate(UserRole.FREIGHT_FORWARDER, 'shipment')).toBe(true);
  });

  it('site engineer cannot update mirv', () => {
    expect(canUpdate(UserRole.SITE_ENGINEER, 'mirv')).toBe(false);
  });
});

describe('canDelete', () => {
  it('admin can delete mrrv', () => {
    expect(canDelete(UserRole.ADMIN, 'mrrv')).toBe(true);
  });

  it('warehouse staff cannot delete mrrv', () => {
    expect(canDelete(UserRole.WAREHOUSE_STAFF, 'mrrv')).toBe(false);
  });

  it('manager cannot delete mrrv', () => {
    expect(canDelete(UserRole.MANAGER, 'mrrv')).toBe(false);
  });
});

describe('canApprove', () => {
  it('manager can approve documents', () => {
    expect(canApprove(UserRole.MANAGER, 'mrrv')).toBe(true);
    expect(canApprove(UserRole.MANAGER, 'mirv')).toBe(true);
  });

  it('qc officer can approve rfim', () => {
    expect(canApprove(UserRole.QC_OFFICER, 'rfim')).toBe(true);
  });

  it('qc officer cannot approve mrrv', () => {
    expect(canApprove(UserRole.QC_OFFICER, 'mrrv')).toBe(false);
  });

  it('warehouse staff cannot approve anything', () => {
    expect(canApprove(UserRole.WAREHOUSE_STAFF, 'mrrv')).toBe(false);
    expect(canApprove(UserRole.WAREHOUSE_STAFF, 'mirv')).toBe(false);
  });
});

describe('canExport', () => {
  it('admin can export all resources', () => {
    expect(canExport(UserRole.ADMIN, 'mrrv')).toBe(true);
    expect(canExport(UserRole.ADMIN, 'reports')).toBe(true);
  });

  it('manager can export documents', () => {
    expect(canExport(UserRole.MANAGER, 'mrrv')).toBe(true);
  });

  it('warehouse staff cannot export mrrv', () => {
    expect(canExport(UserRole.WAREHOUSE_STAFF, 'mrrv')).toBe(false);
  });
});

// ── Site Engineer (limited access) ──────────────────────────────────────

describe('site engineer permissions', () => {
  const role = UserRole.SITE_ENGINEER;

  it('can create and read mirv', () => {
    expect(canCreate(role, 'mirv')).toBe(true);
    expect(canRead(role, 'mirv')).toBe(true);
  });

  it('can create and read mrf', () => {
    expect(canCreate(role, 'mrf')).toBe(true);
    expect(canRead(role, 'mrf')).toBe(true);
  });

  it('can create and read jo', () => {
    expect(canCreate(role, 'jo')).toBe(true);
    expect(canRead(role, 'jo')).toBe(true);
  });

  it('cannot update or delete mirv', () => {
    expect(canUpdate(role, 'mirv')).toBe(false);
    expect(canDelete(role, 'mirv')).toBe(false);
  });

  it('cannot access mrrv', () => {
    expect(canRead(role, 'mrrv')).toBe(false);
    expect(canCreate(role, 'mrrv')).toBe(false);
  });
});

// ── Freight Forwarder (restricted) ──────────────────────────────────────

describe('freight forwarder permissions', () => {
  const role = UserRole.FREIGHT_FORWARDER;

  it('has only shipment read and update', () => {
    expect(canRead(role, 'shipment')).toBe(true);
    expect(canUpdate(role, 'shipment')).toBe(true);
    expect(canCreate(role, 'shipment')).toBe(false);
    expect(canDelete(role, 'shipment')).toBe(false);
  });

  it('can read customs and gatepass', () => {
    expect(canRead(role, 'customs')).toBe(true);
    expect(canRead(role, 'gatepass')).toBe(true);
  });

  it('cannot access warehouse resources', () => {
    expect(canRead(role, 'mrrv')).toBe(false);
    expect(canRead(role, 'mirv')).toBe(false);
    expect(canRead(role, 'inventory')).toBe(false);
  });
});

// ── getMaxApprovalLevel ─────────────────────────────────────────────────

describe('getMaxApprovalLevel', () => {
  it('admin = 5', () => {
    expect(getMaxApprovalLevel(UserRole.ADMIN)).toBe(5);
  });

  it('manager = 4', () => {
    expect(getMaxApprovalLevel(UserRole.MANAGER)).toBe(4);
  });

  it('logistics_coordinator = 2', () => {
    expect(getMaxApprovalLevel(UserRole.LOGISTICS_COORDINATOR)).toBe(2);
  });

  it('warehouse_supervisor = 1', () => {
    expect(getMaxApprovalLevel(UserRole.WAREHOUSE_SUPERVISOR)).toBe(1);
  });

  it('warehouse_staff = 1', () => {
    expect(getMaxApprovalLevel(UserRole.WAREHOUSE_STAFF)).toBe(1);
  });

  it('qc_officer = 1', () => {
    expect(getMaxApprovalLevel(UserRole.QC_OFFICER)).toBe(1);
  });

  it('unknown role = 0', () => {
    expect(getMaxApprovalLevel('unknown_role')).toBe(0);
  });
});

// ── getRequiredApprovalLevel ────────────────────────────────────────────

describe('getRequiredApprovalLevel', () => {
  describe('MIRV levels', () => {
    it('0 - 10,000 → Level 1', () => {
      const level = getRequiredApprovalLevel('mirv', 5_000);
      expect(level.level).toBe(1);
    });

    it('10,000 - 50,000 → Level 2', () => {
      const level = getRequiredApprovalLevel('mirv', 25_000);
      expect(level.level).toBe(2);
    });

    it('50,000 - 100,000 → Level 3', () => {
      const level = getRequiredApprovalLevel('mirv', 75_000);
      expect(level.level).toBe(3);
    });

    it('100,000 - 500,000 → Level 4', () => {
      const level = getRequiredApprovalLevel('mirv', 250_000);
      expect(level.level).toBe(4);
    });

    it('500,000+ → Level 5', () => {
      const level = getRequiredApprovalLevel('mirv', 1_000_000);
      expect(level.level).toBe(5);
    });

    it('boundary: exactly 10,000 → Level 2', () => {
      const level = getRequiredApprovalLevel('mirv', 10_000);
      expect(level.level).toBe(2);
    });

    it('boundary: exactly 0 → Level 1', () => {
      const level = getRequiredApprovalLevel('mirv', 0);
      expect(level.level).toBe(1);
    });
  });

  describe('JO levels', () => {
    it('0 - 5,000 → Level 1', () => {
      const level = getRequiredApprovalLevel('jo', 2_000);
      expect(level.level).toBe(1);
    });

    it('5,000 - 20,000 → Level 2', () => {
      const level = getRequiredApprovalLevel('jo', 10_000);
      expect(level.level).toBe(2);
    });

    it('20,000 - 100,000 → Level 3', () => {
      const level = getRequiredApprovalLevel('jo', 50_000);
      expect(level.level).toBe(3);
    });

    it('100,000+ → Level 4', () => {
      const level = getRequiredApprovalLevel('jo', 500_000);
      expect(level.level).toBe(4);
    });
  });

  describe('MRF uses MIRV levels', () => {
    it('uses MIRV approval levels', () => {
      const mrf = getRequiredApprovalLevel('mrf', 5_000);
      const mirv = getRequiredApprovalLevel('mirv', 5_000);
      expect(mrf.level).toBe(mirv.level);
    });
  });
});

// ── getPermissionMatrix ─────────────────────────────────────────────────

describe('getPermissionMatrix', () => {
  it('returns full matrix for admin', () => {
    const matrix = getPermissionMatrix(UserRole.ADMIN);
    expect(Object.keys(matrix).length).toBeGreaterThan(0);
    expect(matrix.mrrv).toContain('create');
  });

  it('returns empty object for unknown role', () => {
    expect(getPermissionMatrix('nonexistent')).toEqual({});
  });
});

// ── getEffectivePermissions ─────────────────────────────────────────────

describe('getEffectivePermissions', () => {
  it('returns defaults when no overrides', () => {
    const effective = getEffectivePermissions(UserRole.WAREHOUSE_STAFF);
    const defaults = ROLE_PERMISSIONS[UserRole.WAREHOUSE_STAFF];
    expect(effective).toEqual(defaults);
  });

  it('returns defaults when overrides is undefined', () => {
    const effective = getEffectivePermissions(UserRole.WAREHOUSE_STAFF, undefined);
    const defaults = ROLE_PERMISSIONS[UserRole.WAREHOUSE_STAFF];
    expect(effective).toEqual(defaults);
  });

  it('returns defaults when overrides has no entry for this role', () => {
    const overrides = { [UserRole.ADMIN]: { mrrv: ['read' as const] } };
    const effective = getEffectivePermissions(UserRole.WAREHOUSE_STAFF, overrides);
    const defaults = ROLE_PERMISSIONS[UserRole.WAREHOUSE_STAFF];
    expect(effective).toEqual(defaults);
  });

  it('merges overrides for the given role', () => {
    const overrides = {
      [UserRole.WAREHOUSE_STAFF]: {
        mrrv: ['create', 'read', 'update', 'delete'] as const,
        reports: ['read', 'export'] as const,
      },
    };
    const effective = getEffectivePermissions(UserRole.WAREHOUSE_STAFF, overrides);
    // override replaces mrrv permissions
    expect(effective.mrrv).toEqual(['create', 'read', 'update', 'delete']);
    // new resource added
    expect(effective.reports).toEqual(['read', 'export']);
    // existing non-overridden resource preserved
    expect(effective.mirv).toEqual(ROLE_PERMISSIONS[UserRole.WAREHOUSE_STAFF].mirv);
  });

  it('returns empty object for unknown role with no overrides', () => {
    const effective = getEffectivePermissions('unknown');
    expect(effective).toEqual({});
  });
});

// ── hasPermissionWithOverrides ──────────────────────────────────────────

describe('hasPermissionWithOverrides', () => {
  it('works like hasPermission when no overrides', () => {
    expect(hasPermissionWithOverrides(UserRole.WAREHOUSE_STAFF, 'mrrv', 'create')).toBe(true);
    expect(hasPermissionWithOverrides(UserRole.WAREHOUSE_STAFF, 'mrrv', 'delete')).toBe(false);
  });

  it('respects overrides that add permissions', () => {
    const overrides = {
      [UserRole.WAREHOUSE_STAFF]: {
        mrrv: ['create', 'read', 'update', 'delete'] as const,
      },
    };
    expect(hasPermissionWithOverrides(UserRole.WAREHOUSE_STAFF, 'mrrv', 'delete', overrides)).toBe(true);
  });

  it('respects overrides that remove permissions', () => {
    const overrides = {
      [UserRole.WAREHOUSE_STAFF]: {
        mrrv: ['read'] as const,
      },
    };
    expect(hasPermissionWithOverrides(UserRole.WAREHOUSE_STAFF, 'mrrv', 'create', overrides)).toBe(false);
    expect(hasPermissionWithOverrides(UserRole.WAREHOUSE_STAFF, 'mrrv', 'read', overrides)).toBe(true);
  });

  it('does not affect other resources', () => {
    const overrides = {
      [UserRole.WAREHOUSE_STAFF]: {
        mrrv: ['read'] as const,
      },
    };
    // mirv permissions are unchanged
    expect(hasPermissionWithOverrides(UserRole.WAREHOUSE_STAFF, 'mirv', 'read', overrides)).toBe(true);
  });
});
