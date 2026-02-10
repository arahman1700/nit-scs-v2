import { UserRole } from './types/enums.js';
import { MI_APPROVAL_LEVELS, JO_APPROVAL_LEVELS } from './constants/index.js';

export type Permission = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';
export type ResourcePermissions = Record<string, Permission[]>;

const ROLE_PERMISSIONS: Record<string, ResourcePermissions> = {
  [UserRole.ADMIN]: {
    grn: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    mi: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    mrn: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    qci: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    dr: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    jo: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    gatepass: ['create', 'read', 'update', 'delete', 'export'],
    wt: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    mr: ['create', 'read', 'update', 'delete', 'approve', 'export'],
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
    imsf: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    surplus: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    scrap: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    ssc: ['create', 'read', 'update', 'approve'],
    rental_contract: ['create', 'read', 'update', 'delete', 'approve'],
    tool: ['create', 'read', 'update', 'delete'],
    tool_issue: ['create', 'read', 'update'],
    bin_card: ['read', 'update'],
    generator_fuel: ['create', 'read'],
    generator_maintenance: ['create', 'read', 'update'],
    warehouse_zone: ['create', 'read', 'update', 'delete'],
  },
  [UserRole.MANAGER]: {
    grn: ['read', 'approve', 'export'],
    mi: ['read', 'approve', 'export'],
    mrn: ['read', 'approve', 'export'],
    qci: ['read', 'approve', 'export'],
    dr: ['read', 'export'],
    jo: ['create', 'read', 'approve', 'export'],
    gatepass: ['read', 'export'],
    wt: ['read', 'approve', 'export'],
    mr: ['read', 'approve', 'export'],
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
    grn: ['create', 'read', 'update', 'approve'],
    mi: ['read', 'update', 'approve'],
    mrn: ['create', 'read', 'update'],
    qci: ['create', 'read'],
    dr: ['create', 'read', 'update'],
    gatepass: ['create', 'read', 'update'],
    wt: ['create', 'read', 'update'],
    inventory: ['read', 'update', 'export'],
    items: ['read', 'update'],
    projects: ['read'],
    warehouses: ['read'],
    imsf: ['create', 'read', 'update'],
    surplus: ['create', 'read', 'update'],
    scrap: ['create', 'read'],
    bin_card: ['read', 'update'],
    warehouse_zone: ['read'],
    tool: ['read', 'update'],
    tool_issue: ['create', 'read', 'update'],
  },
  [UserRole.WAREHOUSE_STAFF]: {
    grn: ['create', 'read', 'update'],
    mi: ['read', 'update'],
    mrn: ['create', 'read', 'update'],
    qci: ['create', 'read'],
    dr: ['create', 'read'],
    gatepass: ['create', 'read', 'update'],
    wt: ['create', 'read'],
    inventory: ['read', 'update'],
    items: ['read'],
    projects: ['read'],
    imsf: ['read'],
    bin_card: ['read', 'update'],
    tool_issue: ['create', 'read'],
  },
  [UserRole.LOGISTICS_COORDINATOR]: {
    grn: ['create', 'read', 'update'],
    mi: ['create', 'read', 'update', 'approve'],
    mrn: ['create', 'read', 'update'],
    jo: ['create', 'read', 'update', 'approve'],
    shipment: ['create', 'read', 'update'],
    customs: ['create', 'read', 'update'],
    gatepass: ['create', 'read', 'update'],
    wt: ['create', 'read', 'update'],
    inventory: ['read', 'export'],
    suppliers: ['read'],
    imsf: ['create', 'read', 'update'],
    rental_contract: ['read'],
    generator_fuel: ['create', 'read'],
    generator_maintenance: ['read'],
  },
  [UserRole.SITE_ENGINEER]: {
    mi: ['create', 'read'],
    mr: ['create', 'read'],
    jo: ['create', 'read'],
    inventory: ['read'],
    projects: ['read'],
  },
  [UserRole.QC_OFFICER]: {
    qci: ['create', 'read', 'update', 'approve'],
    dr: ['create', 'read', 'update'],
    grn: ['read'],
    inventory: ['read'],
    scrap: ['read', 'approve'],
    surplus: ['read'],
  },
  [UserRole.FREIGHT_FORWARDER]: {
    shipment: ['read', 'update'],
    customs: ['read'],
    gatepass: ['read'],
  },
  [UserRole.TRANSPORT_SUPERVISOR]: {
    jo: ['create', 'read', 'update', 'approve'],
    gatepass: ['create', 'read', 'update'],
    wt: ['create', 'read', 'update', 'approve'],
    imsf: ['create', 'read', 'update'],
    mr: ['read'],
    mi: ['read'],
    grn: ['read'],
    inventory: ['read'],
    fleet: ['read', 'update'],
    generators: ['read'],
    shipment: ['read'],
  },
  [UserRole.SCRAP_COMMITTEE_MEMBER]: {
    scrap: ['read', 'approve'],
    ssc: ['create', 'read', 'update', 'approve'],
    surplus: ['read'],
    inventory: ['read'],
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
    case UserRole.TRANSPORT_SUPERVISOR:
      return 1;
    case UserRole.SCRAP_COMMITTEE_MEMBER:
      return 1;
    default:
      return 0;
  }
}

export function getRequiredApprovalLevel(documentType: 'mi' | 'jo' | 'mr', amount: number) {
  const levels = documentType === 'jo' ? JO_APPROVAL_LEVELS : MI_APPROVAL_LEVELS;
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
