import type { JwtPayload } from './jwt.js';

/**
 * Row-level security: build Prisma `where` conditions based on user role
 * and assigned project/warehouse.
 *
 * Scoping rules:
 * - admin, manager: see all records (no filter)
 * - warehouse_supervisor, warehouse_staff: filter by assignedWarehouseId
 * - site_engineer: filter by assignedProjectId
 * - qc_officer: see all (quality oversight across warehouses)
 * - logistics_coordinator, freight_forwarder: see all logistics-related
 *
 * Returns an empty object for unrestricted roles, or a Prisma `where` clause.
 */

/** Which Prisma field names map to project and warehouse for each model */
export interface ScopeFieldMapping {
  /** The field name for warehouse scoping (e.g. 'warehouseId', 'sourceWarehouseId'). */
  warehouseField?: string;
  /** The field name for project scoping (e.g. 'projectId'). */
  projectField?: string;
  /** The field name for user/creator scoping (e.g. 'createdById', 'receivedById'). */
  createdByField?: string;
}

const DEFAULT_MAPPING: ScopeFieldMapping = {
  warehouseField: 'warehouseId',
  projectField: 'projectId',
};

/** Roles that see everything */
const UNRESTRICTED_ROLES = new Set(['admin', 'manager', 'qc_officer', 'logistics_coordinator', 'freight_forwarder']);

/** Roles scoped to their assigned warehouse */
const WAREHOUSE_SCOPED_ROLES = new Set(['warehouse_supervisor', 'warehouse_staff']);

/** Roles scoped to their assigned project */
const PROJECT_SCOPED_ROLES = new Set(['site_engineer']);

/**
 * Build a Prisma `where` filter based on the authenticated user's role
 * and assigned project/warehouse. Returns `{}` for unrestricted roles.
 *
 * For warehouse-scoped users: adds `{ [warehouseField]: assignedWarehouseId }`
 * For project-scoped users: adds `{ [projectField]: assignedProjectId }`
 *
 * If a scoped user has no assigned ID (null), they see only records they created
 * (falls back to `createdByField` if available, otherwise returns an impossible filter).
 */
export function buildScopeFilter(
  user: JwtPayload,
  mapping: ScopeFieldMapping = DEFAULT_MAPPING,
): Record<string, unknown> {
  const role = user.systemRole;

  // Unrestricted roles see everything
  if (UNRESTRICTED_ROLES.has(role)) {
    return {};
  }

  // Warehouse-scoped roles
  if (WAREHOUSE_SCOPED_ROLES.has(role) && mapping.warehouseField) {
    if (user.assignedWarehouseId) {
      return { [mapping.warehouseField]: user.assignedWarehouseId };
    }
    // No warehouse assigned — fallback to own records only
    if (mapping.createdByField) {
      return { [mapping.createdByField]: user.userId };
    }
    // Safety net: impossible filter (returns no records)
    return { id: '__no_access__' };
  }

  // Project-scoped roles
  if (PROJECT_SCOPED_ROLES.has(role) && mapping.projectField) {
    if (user.assignedProjectId) {
      return { [mapping.projectField]: user.assignedProjectId };
    }
    if (mapping.createdByField) {
      return { [mapping.createdByField]: user.userId };
    }
    return { id: '__no_access__' };
  }

  // Unknown role — restrict to own records for safety
  if (mapping.createdByField) {
    return { [mapping.createdByField]: user.userId };
  }
  return {};
}

/**
 * Check if a user has access to a specific record.
 * Used for getById, update, and action routes to prevent unauthorized access.
 *
 * Returns true if:
 * - User has an unrestricted role
 * - The record's warehouse/project matches the user's assignment
 * - The user created the record
 */
export function canAccessRecord(
  user: JwtPayload,
  record: Record<string, unknown>,
  mapping: ScopeFieldMapping = DEFAULT_MAPPING,
): boolean {
  const role = user.systemRole;

  // Unrestricted roles
  if (UNRESTRICTED_ROLES.has(role)) {
    return true;
  }

  // Warehouse-scoped
  if (WAREHOUSE_SCOPED_ROLES.has(role)) {
    if (mapping.warehouseField && user.assignedWarehouseId) {
      if (record[mapping.warehouseField] === user.assignedWarehouseId) return true;
      // For models with dual warehouse fields (e.g. StockTransfer: fromWarehouseId/toWarehouseId)
      if (record['toWarehouseId'] === user.assignedWarehouseId) return true;
    }
    // Also allow access if user created the record
    if (mapping.createdByField && record[mapping.createdByField] === user.userId) return true;
    return false;
  }

  // Project-scoped
  if (PROJECT_SCOPED_ROLES.has(role)) {
    if (mapping.projectField && user.assignedProjectId) {
      if (record[mapping.projectField] === user.assignedProjectId) return true;
    }
    if (mapping.createdByField && record[mapping.createdByField] === user.userId) return true;
    return false;
  }

  // Unknown role — check creator only
  if (mapping.createdByField && record[mapping.createdByField] === user.userId) return true;
  return false;
}
