import { UserRole } from './types/enums.js';
import { MIRV_APPROVAL_LEVELS, JO_APPROVAL_LEVELS } from './constants/index.js';

export type Permission = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';
export type ResourcePermissions = Record<string, Permission[]>;

const ROLE_PERMISSIONS: Record<string, ResourcePermissions> = {
  [UserRole.ADMIN]: {
    mrrv: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    mirv: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    mrv: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    rfim: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    osd: ['create', 'read', 'update', 'delete', 'export'],
    jo: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    gatepass: ['create', 'read', 'update', 'delete', 'export'],
    'stock-transfer': ['create', 'read', 'update', 'delete', 'approve', 'export'],
    mrf: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    shipment: ['create', 'read', 'update', 'delete', 'export'],
    customs: ['create', 'read', 'update', 'delete', 'export'],
    inventory: ['read', 'update', 'export'],
    items: ['create', 'read', 'update', 'delete', 'export'],
    projects: ['create', 'read', 'update', 'delete', 'export'],
    suppliers: ['create', 'read', 'update', 'delete', 'export'],
    employees: ['create', 'read', 'update', 'delete', 'export'],
    warehouses: ['create', 'read', 'update', 'delete', 'export'],
    generators: ['create', 'read', 'update', 'delete', 'export'],
    fleet: ['create', 'read', 'update', 'delete', 'export'],
    reports: ['read', 'export'],
    'audit-log': ['read', 'export'],
    settings: ['read', 'update'],
    roles: ['read'],
  },
  [UserRole.MANAGER]: {
    mrrv: ['read', 'approve', 'export'],
    mirv: ['read', 'approve', 'export'],
    mrv: ['read', 'approve', 'export'],
    rfim: ['read', 'approve', 'export'],
    osd: ['read', 'export'],
    jo: ['create', 'read', 'approve', 'export'],
    gatepass: ['read', 'export'],
    'stock-transfer': ['read', 'approve', 'export'],
    mrf: ['read', 'approve', 'export'],
    shipment: ['read', 'export'],
    customs: ['read', 'export'],
    inventory: ['read', 'export'],
    items: ['read', 'export'],
    projects: ['read', 'export'],
    suppliers: ['read', 'export'],
    employees: ['read', 'export'],
    warehouses: ['read', 'export'],
    reports: ['read', 'export'],
  },
  [UserRole.WAREHOUSE_SUPERVISOR]: {
    mrrv: ['create', 'read', 'update', 'approve'],
    mirv: ['read', 'update', 'approve'],
    mrv: ['create', 'read', 'update'],
    rfim: ['create', 'read'],
    osd: ['create', 'read', 'update'],
    gatepass: ['create', 'read', 'update'],
    'stock-transfer': ['create', 'read', 'update'],
    inventory: ['read', 'update', 'export'],
    items: ['read', 'update'],
    projects: ['read'],
    warehouses: ['read'],
  },
  [UserRole.WAREHOUSE_STAFF]: {
    mrrv: ['create', 'read', 'update'],
    mirv: ['read', 'update'],
    mrv: ['create', 'read', 'update'],
    rfim: ['create', 'read'],
    osd: ['create', 'read'],
    gatepass: ['create', 'read', 'update'],
    'stock-transfer': ['create', 'read'],
    inventory: ['read', 'update'],
    items: ['read'],
    projects: ['read'],
  },
  [UserRole.LOGISTICS_COORDINATOR]: {
    mrrv: ['create', 'read', 'update'],
    mirv: ['create', 'read', 'update', 'approve'],
    mrv: ['create', 'read', 'update'],
    jo: ['create', 'read', 'update', 'approve'],
    shipment: ['create', 'read', 'update'],
    customs: ['create', 'read', 'update'],
    gatepass: ['create', 'read', 'update'],
    'stock-transfer': ['create', 'read', 'update'],
    inventory: ['read', 'export'],
    suppliers: ['read'],
  },
  [UserRole.SITE_ENGINEER]: {
    mirv: ['create', 'read'],
    mrf: ['create', 'read'],
    jo: ['create', 'read'],
    inventory: ['read'],
    projects: ['read'],
  },
  [UserRole.QC_OFFICER]: {
    rfim: ['create', 'read', 'update', 'approve'],
    osd: ['create', 'read', 'update'],
    mrrv: ['read'],
    inventory: ['read'],
  },
  [UserRole.FREIGHT_FORWARDER]: {
    shipment: ['read', 'update'],
    customs: ['read'],
    gatepass: ['read'],
  },
};

export function hasPermission(role: UserRole | string, resource: string, permission: Permission): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return false;
  const resourcePerms = rolePerms[resource];
  if (!resourcePerms) return false;
  return resourcePerms.includes(permission);
}

export function canCreate(role: UserRole | string, resource: string): boolean {
  return hasPermission(role, resource, 'create');
}

export function canRead(role: UserRole | string, resource: string): boolean {
  return hasPermission(role, resource, 'read');
}

export function canUpdate(role: UserRole | string, resource: string): boolean {
  return hasPermission(role, resource, 'update');
}

export function canDelete(role: UserRole | string, resource: string): boolean {
  return hasPermission(role, resource, 'delete');
}

export function canApprove(role: UserRole | string, resource: string): boolean {
  return hasPermission(role, resource, 'approve');
}

export function canExport(role: UserRole | string, resource: string): boolean {
  return hasPermission(role, resource, 'export');
}

export function getMaxApprovalLevel(role: UserRole | string): number {
  switch (role) {
    case UserRole.ADMIN:
      return 5;
    case UserRole.MANAGER:
      return 4;
    case UserRole.LOGISTICS_COORDINATOR:
      return 2;
    case UserRole.WAREHOUSE_SUPERVISOR:
      return 1;
    case UserRole.WAREHOUSE_STAFF:
      return 1;
    case UserRole.QC_OFFICER:
      return 1;
    default:
      return 0;
  }
}

export function getRequiredApprovalLevel(documentType: 'mirv' | 'jo' | 'mrf', amount: number) {
  const levels = documentType === 'jo' ? JO_APPROVAL_LEVELS : MIRV_APPROVAL_LEVELS;
  return levels.find(l => amount >= l.minAmount && amount < l.maxAmount) || levels[levels.length - 1];
}

export function getPermissionMatrix(role: UserRole | string): ResourcePermissions {
  return ROLE_PERMISSIONS[role] || {};
}

// ── Override Support ────────────────────────────────────────────────────

export type PermissionOverrides = Record<string, ResourcePermissions>;

/** Merge API overrides with hardcoded defaults. Overrides replace per-role entirely when present. */
export function getEffectivePermissions(role: UserRole | string, overrides?: PermissionOverrides): ResourcePermissions {
  const defaults = ROLE_PERMISSIONS[role] || {};
  if (!overrides || !overrides[role]) return defaults;
  const roleOverrides = overrides[role];
  const merged = { ...defaults };
  for (const [resource, perms] of Object.entries(roleOverrides)) {
    merged[resource] = perms;
  }
  return merged;
}

/** Check effective permissions including overrides */
export function hasPermissionWithOverrides(
  role: UserRole | string,
  resource: string,
  permission: Permission,
  overrides?: PermissionOverrides,
): boolean {
  const effective = getEffectivePermissions(role, overrides);
  const resourcePerms = effective[resource];
  if (!resourcePerms) return false;
  return resourcePerms.includes(permission);
}

export { ROLE_PERMISSIONS };
