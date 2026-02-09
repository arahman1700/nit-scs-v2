import { buildScopeFilter, canAccessRecord } from './scope-filter.js';
import type { JwtPayload } from './jwt.js';

// ── Test user payloads ──────────────────────────────────────────────────

const adminUser: JwtPayload = {
  userId: 'admin-1',
  email: 'admin@test.com',
  role: 'admin',
  systemRole: 'admin',
};

const managerUser: JwtPayload = {
  userId: 'mgr-1',
  email: 'manager@test.com',
  role: 'manager',
  systemRole: 'manager',
};

const qcOfficerUser: JwtPayload = {
  userId: 'qc-1',
  email: 'qc@test.com',
  role: 'qc_officer',
  systemRole: 'qc_officer',
};

const warehouseSupervisor: JwtPayload = {
  userId: 'ws-1',
  email: 'ws@test.com',
  role: 'warehouse_supervisor',
  systemRole: 'warehouse_supervisor',
  assignedWarehouseId: 'wh-1',
};

const warehouseSupervisorNoAssignment: JwtPayload = {
  userId: 'ws-2',
  email: 'ws2@test.com',
  role: 'warehouse_supervisor',
  systemRole: 'warehouse_supervisor',
  assignedWarehouseId: null,
};

const warehouseStaff: JwtPayload = {
  userId: 'wstaff-1',
  email: 'wstaff@test.com',
  role: 'warehouse_staff',
  systemRole: 'warehouse_staff',
  assignedWarehouseId: 'wh-2',
};

const warehouseStaffNoAssignment: JwtPayload = {
  userId: 'wstaff-2',
  email: 'wstaff2@test.com',
  role: 'warehouse_staff',
  systemRole: 'warehouse_staff',
  assignedWarehouseId: null,
};

const siteEngineer: JwtPayload = {
  userId: 'se-1',
  email: 'se@test.com',
  role: 'site_engineer',
  systemRole: 'site_engineer',
  assignedProjectId: 'proj-1',
};

const siteEngineerNoAssignment: JwtPayload = {
  userId: 'se-2',
  email: 'se2@test.com',
  role: 'site_engineer',
  systemRole: 'site_engineer',
  assignedProjectId: null,
};

const unknownRoleUser: JwtPayload = {
  userId: 'unknown-1',
  email: 'unknown@test.com',
  role: 'viewer',
  systemRole: 'viewer',
};

// ── buildScopeFilter tests ──────────────────────────────────────────────

describe('buildScopeFilter', () => {
  it('returns empty filter for admin (unrestricted)', () => {
    expect(buildScopeFilter(adminUser)).toEqual({});
  });

  it('returns empty filter for manager (unrestricted)', () => {
    expect(buildScopeFilter(managerUser)).toEqual({});
  });

  it('returns empty filter for qc_officer (unrestricted)', () => {
    expect(buildScopeFilter(qcOfficerUser)).toEqual({});
  });

  it('returns warehouse filter for warehouse_supervisor with assignedWarehouseId', () => {
    expect(buildScopeFilter(warehouseSupervisor)).toEqual({ warehouseId: 'wh-1' });
  });

  it('returns warehouse filter for warehouse_staff with assignedWarehouseId', () => {
    expect(buildScopeFilter(warehouseStaff)).toEqual({ warehouseId: 'wh-2' });
  });

  it('falls back to createdByField for warehouse_staff without assignedWarehouseId', () => {
    const result = buildScopeFilter(warehouseStaffNoAssignment, {
      warehouseField: 'warehouseId',
      createdByField: 'createdById',
    });
    expect(result).toEqual({ createdById: 'wstaff-2' });
  });

  it('returns impossible filter for warehouse_staff without warehouseId or createdByField', () => {
    const result = buildScopeFilter(warehouseStaffNoAssignment);
    expect(result).toEqual({ id: '__no_access__' });
  });

  it('returns project filter for site_engineer with assignedProjectId', () => {
    expect(buildScopeFilter(siteEngineer)).toEqual({ projectId: 'proj-1' });
  });

  it('falls back to createdByField for site_engineer without assignedProjectId', () => {
    const result = buildScopeFilter(siteEngineerNoAssignment, {
      projectField: 'projectId',
      createdByField: 'createdById',
    });
    expect(result).toEqual({ createdById: 'se-2' });
  });

  it('returns impossible filter for site_engineer without projectId or createdByField', () => {
    const result = buildScopeFilter(siteEngineerNoAssignment);
    expect(result).toEqual({ id: '__no_access__' });
  });

  it('supports custom field mapping', () => {
    const result = buildScopeFilter(warehouseSupervisor, {
      warehouseField: 'sourceWarehouseId',
    });
    expect(result).toEqual({ sourceWarehouseId: 'wh-1' });
  });

  it('returns own records for unknown role with createdByField', () => {
    const result = buildScopeFilter(unknownRoleUser, {
      createdByField: 'createdById',
    });
    expect(result).toEqual({ createdById: 'unknown-1' });
  });

  it('returns empty filter for unknown role without createdByField', () => {
    const result = buildScopeFilter(unknownRoleUser);
    expect(result).toEqual({});
  });

  it('returns empty for logistics_coordinator (unrestricted)', () => {
    const lc: JwtPayload = {
      userId: 'lc-1',
      email: 'lc@test.com',
      role: 'logistics_coordinator',
      systemRole: 'logistics_coordinator',
    };
    expect(buildScopeFilter(lc)).toEqual({});
  });

  it('returns empty for freight_forwarder (unrestricted)', () => {
    const ff: JwtPayload = {
      userId: 'ff-1',
      email: 'ff@test.com',
      role: 'freight_forwarder',
      systemRole: 'freight_forwarder',
    };
    expect(buildScopeFilter(ff)).toEqual({});
  });
});

// ── canAccessRecord tests ───────────────────────────────────────────────

describe('canAccessRecord', () => {
  it('admin always has access', () => {
    const record = { warehouseId: 'wh-99', projectId: 'proj-99' };
    expect(canAccessRecord(adminUser, record)).toBe(true);
  });

  it('warehouse_supervisor: true if record.warehouseId matches', () => {
    const record = { warehouseId: 'wh-1' };
    expect(canAccessRecord(warehouseSupervisor, record)).toBe(true);
  });

  it('warehouse_supervisor: true if record.toWarehouseId matches (dual warehouse)', () => {
    const record = { warehouseId: 'wh-other', toWarehouseId: 'wh-1' };
    expect(canAccessRecord(warehouseSupervisor, record)).toBe(true);
  });

  it('warehouse_supervisor: true if record creator matches', () => {
    const record = { warehouseId: 'wh-other', createdById: 'ws-1' };
    expect(
      canAccessRecord(warehouseSupervisor, record, {
        warehouseField: 'warehouseId',
        createdByField: 'createdById',
      }),
    ).toBe(true);
  });

  it('warehouse_supervisor: false if nothing matches', () => {
    const record = { warehouseId: 'wh-99', createdById: 'someone-else' };
    expect(
      canAccessRecord(warehouseSupervisor, record, {
        warehouseField: 'warehouseId',
        createdByField: 'createdById',
      }),
    ).toBe(false);
  });

  it('warehouse_supervisor without assignment: false if no match', () => {
    const record = { warehouseId: 'wh-1' };
    expect(canAccessRecord(warehouseSupervisorNoAssignment, record)).toBe(false);
  });

  it('site_engineer: true if record.projectId matches', () => {
    const record = { projectId: 'proj-1' };
    expect(canAccessRecord(siteEngineer, record)).toBe(true);
  });

  it('site_engineer: false if record.projectId does not match', () => {
    const record = { projectId: 'proj-99' };
    expect(canAccessRecord(siteEngineer, record)).toBe(false);
  });

  it('site_engineer: true if record creator matches', () => {
    const record = { projectId: 'proj-99', createdById: 'se-1' };
    expect(
      canAccessRecord(siteEngineer, record, {
        projectField: 'projectId',
        createdByField: 'createdById',
      }),
    ).toBe(true);
  });

  it('unknown role: only has access if creator matches', () => {
    const record = { createdById: 'unknown-1' };
    expect(canAccessRecord(unknownRoleUser, record, { createdByField: 'createdById' })).toBe(true);
  });

  it('unknown role: false if creator does not match', () => {
    const record = { createdById: 'someone-else' };
    expect(canAccessRecord(unknownRoleUser, record, { createdByField: 'createdById' })).toBe(false);
  });

  it('unknown role: false if no createdByField mapping', () => {
    const record = { createdById: 'unknown-1' };
    expect(canAccessRecord(unknownRoleUser, record)).toBe(false);
  });

  it('manager always has access (unrestricted)', () => {
    const record = { warehouseId: 'wh-99' };
    expect(canAccessRecord(managerUser, record)).toBe(true);
  });
});
