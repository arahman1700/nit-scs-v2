import type { Request, Response, NextFunction } from 'express';
import type { Permission } from '@nit-scs-v2/shared';
import { sendError } from '../utils/response.js';
import { hasPermissionDB } from '../services/permission.service.js';

/**
 * Require user to have one of the listed roles (admin always passes).
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendError(res, 401, 'Authentication required');
      return;
    }

    const userRole = req.user.systemRole;
    if (!allowedRoles.includes(userRole) && userRole !== 'admin') {
      sendError(res, 403, `Access denied. Required roles: ${allowedRoles.join(', ')}`);
      return;
    }

    next();
  };
}

/**
 * Permission-based middleware — checks DB-backed permissions (with in-memory cache).
 * Falls back to hardcoded ROLE_PERMISSIONS if DB table is empty.
 */
export function requirePermission(resource: string, action: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendError(res, 401, 'Authentication required');
      return;
    }

    try {
      const allowed = await hasPermissionDB(req.user.systemRole, resource, action);
      if (!allowed) {
        sendError(res, 403, `Access denied. Required permission: ${action} on ${resource}`);
        return;
      }
      next();
    } catch {
      // If DB is unreachable, deny access rather than allowing
      sendError(res, 500, 'Permission check failed');
    }
  };
}
