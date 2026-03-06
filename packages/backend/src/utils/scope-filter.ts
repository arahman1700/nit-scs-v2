import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from './jwt.js';

// ---------------------------------------------------------------------------
// Express type augmentation — `req.scopeFilter`
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Prisma `where` clause derived from the authenticated user's role and
       * assigned warehouse/project. Populated by the `applyScopeFilter` middleware.
       *
       * For unrestricted roles this is `{}`. For warehouse-scoped roles it will
       * contain `{ warehouseId: <assignedId> }`, etc.
       */
      scopeFilter?: Record<string, unknown>;
    }
  }
}

/**
 * Row-level security: build Prisma `where` conditions based on user role
 * and assigned project/warehouse.
 *
 * Scoping rules (SOW Section 13.1 — 17 roles):
 * - UNRESTRICTED: admin, manager, qc_officer, logistics_coordinator, freight_forwarder,
 *   transport_supervisor, scrap_committee_member, technical_manager, finance_user,
 *   compliance_officer, shipping_officer, customs_specialist
 * - WAREHOUSE_SCOPED: warehouse_supervisor, warehouse_staff, gate_officer, inventory_specialist
 * - PROJECT_SCOPED: site_engineer
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

/** Roles that see everything (cross-warehouse/project visibility) */
const UNRESTRICTED_ROLES = new Set([
  'admin',
  'manager',
  'qc_officer',
  'logistics_coordinator',
  'freight_forwarder',
  'transport_supervisor',
  'scrap_committee_member',
  // SOW Section 13.1 — cross-warehouse oversight roles
  'technical_manager',
  'finance_user',
  'compliance_officer',
  'shipping_officer',
  'customs_specialist',
]);

/** Roles scoped to their assigned warehouse */
const WAREHOUSE_SCOPED_ROLES = new Set([
  'warehouse_supervisor',
  'warehouse_staff',
  // SOW Section 13.1 — warehouse-bound roles
  'gate_officer',
  'inventory_specialist',
]);

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

// ---------------------------------------------------------------------------
// Express Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that reads `req.user` (set by the `authenticate` middleware)
 * and attaches a Prisma-compatible `where` filter to `req.scopeFilter`.
 *
 * Usage (per-route or router-level):
 * ```ts
 *   router.get('/', authenticate, applyScopeFilter(), async (req, res) => {
 *     const where = { ...myFilters, ...req.scopeFilter };
 *   });
 * ```
 *
 * @param mapping  Optional field mapping override (defaults to warehouseId / projectId).
 */
export function applyScopeFilter(mapping: ScopeFieldMapping = DEFAULT_MAPPING) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user) {
      req.scopeFilter = buildScopeFilter(req.user, mapping);
    } else {
      // No user — safety net: impossible filter
      req.scopeFilter = { id: '__no_access__' };
    }
    next();
  };
}
