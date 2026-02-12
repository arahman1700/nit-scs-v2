import { prisma } from '../utils/prisma.js';
import { ROLE_PERMISSIONS, type Permission } from '@nit-scs-v2/shared';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────

type ResourcePermissions = Record<string, Permission[]>;
type PermissionCache = Record<string, ResourcePermissions>;

// ── In-Memory Cache (5-minute TTL) ──────────────────────────────────────

let cache: PermissionCache | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function isCacheValid(): boolean {
  return cache !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

export function invalidatePermissionCache(): void {
  cache = null;
  cacheTimestamp = 0;
  log('info', '[Permissions] Cache invalidated');
}

// ── Core Operations ─────────────────────────────────────────────────────

/**
 * Get all role permissions from DB, structured as { role: { resource: actions[] } }.
 * Falls back to hardcoded ROLE_PERMISSIONS if DB is empty.
 */
export async function getAllPermissions(): Promise<PermissionCache> {
  if (isCacheValid()) return cache!;

  const rows = await prisma.rolePermission.findMany({
    orderBy: [{ role: 'asc' }, { resource: 'asc' }],
  });

  if (rows.length === 0) {
    // DB is empty — return hardcoded defaults
    cache = ROLE_PERMISSIONS as unknown as PermissionCache;
    cacheTimestamp = Date.now();
    return cache;
  }

  const result: PermissionCache = {};
  for (const row of rows) {
    if (!result[row.role]) result[row.role] = {};
    result[row.role][row.resource] = row.actions as Permission[];
  }

  cache = result;
  cacheTimestamp = Date.now();
  return cache;
}

/**
 * Get permissions for a specific role.
 */
export async function getPermissionsForRole(role: string): Promise<ResourcePermissions> {
  const all = await getAllPermissions();
  return all[role] || {};
}

/**
 * Check if a role has a specific permission on a resource.
 */
export async function hasPermissionDB(role: string, resource: string, action: Permission): Promise<boolean> {
  const rolePerms = await getPermissionsForRole(role);
  const resourcePerms = rolePerms[resource];
  if (!resourcePerms) return false;
  return resourcePerms.includes(action);
}

/**
 * Update permissions for a role+resource combination.
 */
export async function updatePermission(
  role: string,
  resource: string,
  actions: Permission[],
  updatedBy?: string,
): Promise<void> {
  await prisma.rolePermission.upsert({
    where: { role_resource: { role, resource } },
    update: { actions, updatedBy },
    create: { role, resource, actions, updatedBy },
  });
  invalidatePermissionCache();
}

/**
 * Update all permissions for a role (bulk).
 */
export async function updateRolePermissions(
  role: string,
  permissions: ResourcePermissions,
  updatedBy?: string,
): Promise<void> {
  const operations = Object.entries(permissions).map(([resource, actions]) =>
    prisma.rolePermission.upsert({
      where: { role_resource: { role, resource } },
      update: { actions, updatedBy },
      create: { role, resource, actions, updatedBy },
    }),
  );
  await prisma.$transaction(operations);
  invalidatePermissionCache();
}

/**
 * Reset permissions to hardcoded defaults. If role is provided, reset only that role.
 */
export async function resetToDefaults(role?: string): Promise<void> {
  const defaults = ROLE_PERMISSIONS as unknown as PermissionCache;

  if (role) {
    // Reset single role
    const roleDefaults = defaults[role];
    if (!roleDefaults) return;

    await prisma.rolePermission.deleteMany({ where: { role } });
    const creates = Object.entries(roleDefaults).map(([resource, actions]) => ({
      role,
      resource,
      actions: actions as unknown as Permission[],
    }));
    await prisma.rolePermission.createMany({ data: creates });
  } else {
    // Reset all roles
    await prisma.rolePermission.deleteMany({});
    const creates: Array<{ role: string; resource: string; actions: Permission[] }> = [];
    for (const [r, resources] of Object.entries(defaults)) {
      for (const [resource, actions] of Object.entries(resources)) {
        creates.push({ role: r, resource, actions: actions as Permission[] });
      }
    }
    await prisma.rolePermission.createMany({ data: creates });
  }

  invalidatePermissionCache();
  log('info', `[Permissions] Reset to defaults${role ? ` for role: ${role}` : ''}`);
}
