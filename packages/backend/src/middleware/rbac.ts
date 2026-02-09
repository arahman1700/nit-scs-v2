import type { Request, Response, NextFunction } from 'express';
import { hasPermission, type Permission } from '@nit-scs/shared';
import { sendError } from '../utils/response.js';

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
 * Permission-based middleware using the shared ROLE_PERMISSIONS matrix.
 * Checks if the user's role has the specified permission on the given resource.
 */
export function requirePermission(resource: string, action: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendError(res, 401, 'Authentication required');
      return;
    }

    if (!hasPermission(req.user.systemRole, resource, action)) {
      sendError(res, 403, `Access denied. Required permission: ${action} on ${resource}`);
      return;
    }

    next();
  };
}
