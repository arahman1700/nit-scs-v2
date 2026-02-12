import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { ZodSchema } from 'zod';
import { prisma } from './prisma.js';
import { sendSuccess, sendCreated, sendNoContent, sendError } from './response.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { paginate } from '../middleware/pagination.js';
import { validate } from '../middleware/validate.js';
import { createAuditLog } from '../services/audit.service.js';
import { emitEntityEvent } from '../socket/setup.js';
import { clientIp } from './helpers.js';
import { buildScopeFilter, canAccessRecord, type ScopeFieldMapping } from './scope-filter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PrismaDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown>;
  count: (args: unknown) => Promise<number>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
};

export interface CrudConfig {
  /** Prisma model name (camelCase, e.g. 'region', 'project'). */
  modelName: string;
  /** Database table name (for audit log). */
  tableName: string;
  /** Zod schema for POST (create). */
  createSchema: ZodSchema;
  /** Zod schema for PUT (update). */
  updateSchema: ZodSchema;
  /** Fields that can be searched with ILIKE (e.g. ['regionName', 'code']). */
  searchFields?: string[];
  /** Prisma `include` clause for list queries. Also used for get-by-id if `detailIncludes` is not set. */
  includes?: Record<string, unknown>;
  /** Prisma `include` clause for get-by-id (detail) queries. Falls back to `includes` if omitted. */
  detailIncludes?: Record<string, unknown>;
  /** Default sort column (default: 'createdAt'). */
  defaultSort?: string;
  /** If specified, only these roles may create/update/delete. */
  allowedRoles?: string[];
  /**
   * Query parameters that may be forwarded as Prisma `where` filters.
   * Any parameter NOT in this list is silently ignored.
   * If omitted, NO query-param filtering is allowed (safe default).
   */
  allowedFilters?: string[];
  /** Whether this model supports soft-delete (has `deletedAt` column). Default: true. */
  softDelete?: boolean;
  /**
   * Row-level security: field mapping for scope filtering.
   * If omitted, no scope filter is applied (master data is typically unscoped).
   */
  scopeMapping?: ScopeFieldMapping;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDelegate(modelName: string): PrismaDelegate {
  return (prisma as unknown as Record<string, PrismaDelegate>)[modelName];
}

/** Extract entity name from route base URL (e.g. '/api/v1/regions' -> 'regions'). */
function entityFromUrl(req: Request): string {
  const segments = req.baseUrl.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCrudRouter(config: CrudConfig): Router {
  const router = Router();
  const delegate = getDelegate(config.modelName);
  const softDelete = config.softDelete === true; // default false — only enable for models with deletedAt column

  // ── GET / — List with pagination, search, sort, filter ──────────────
  router.get(
    '/',
    authenticate,
    paginate(config.defaultSort || 'createdAt'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;

        const where: Record<string, unknown> = {};

        // Filter out soft-deleted records
        if (softDelete) {
          where.deletedAt = null;
        }

        // Row-level security: inject scope filter if configured
        if (config.scopeMapping) {
          Object.assign(where, buildScopeFilter(req.user!, config.scopeMapping));
        }

        // Text search across configured fields
        if (search && config.searchFields?.length) {
          where.OR = config.searchFields.map(f => ({
            [f]: { contains: search, mode: 'insensitive' },
          }));
        }

        // Safe query-param filters (only allowed fields)
        if (config.allowedFilters?.length) {
          const reserved = new Set(['page', 'pageSize', 'sortBy', 'sortDir', 'search']);
          for (const [key, value] of Object.entries(req.query)) {
            if (reserved.has(key)) continue;
            if (config.allowedFilters.includes(key) && value && typeof value === 'string') {
              where[key] = value;
            }
          }
        }

        const [data, total] = await Promise.all([
          delegate.findMany({
            where,
            orderBy: { [sortBy]: sortDir },
            skip,
            take: pageSize,
            ...(config.includes ? { include: config.includes } : {}),
          }),
          delegate.count({ where }),
        ]);

        sendSuccess(res, data, { page, pageSize, total });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── GET /:id — Get by ID ────────────────────────────────────────────
  router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detailInclude = config.detailIncludes ?? config.includes;
      const findWhere: Record<string, unknown> = { id: req.params.id as string };
      // Filter out soft-deleted records by ID
      if (softDelete) {
        findWhere.deletedAt = null;
      }
      const record = await delegate.findUnique({
        where: findWhere,
        ...(detailInclude ? { include: detailInclude } : {}),
      });
      if (!record) {
        sendError(res, 404, 'Record not found');
        return;
      }
      // Row-level security: verify access if scoping is configured
      if (config.scopeMapping && !canAccessRecord(req.user!, record as Record<string, unknown>, config.scopeMapping)) {
        sendError(res, 403, 'You do not have access to this record');
        return;
      }
      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  });

  // Build write middleware chain (authenticate + optional RBAC)
  const writeMw = config.allowedRoles?.length ? [authenticate, requireRole(...config.allowedRoles)] : [authenticate];

  // ── POST / — Create ─────────────────────────────────────────────────
  router.post(
    '/',
    ...writeMw,
    validate(config.createSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const record = (await delegate.create({ data: req.body })) as { id: string };

        await createAuditLog({
          tableName: config.tableName,
          recordId: record.id,
          action: 'create',
          newValues: req.body,
          performedById: req.user!.userId,
          ipAddress: clientIp(req),
        });

        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitEntityEvent(io, 'entity:created', { entity: entityFromUrl(req) });

        sendCreated(res, record);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── PUT /:id — Update ───────────────────────────────────────────────
  router.put(
    '/:id',
    ...writeMw,
    validate(config.updateSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const old = await delegate.findUnique({ where: { id: req.params.id as string } });
        if (!old) {
          sendError(res, 404, 'Record not found');
          return;
        }
        // Row-level security
        if (config.scopeMapping && !canAccessRecord(req.user!, old as Record<string, unknown>, config.scopeMapping)) {
          sendError(res, 403, 'You do not have access to this record');
          return;
        }

        const record = await delegate.update({
          where: { id: req.params.id as string },
          data: req.body,
        });

        await createAuditLog({
          tableName: config.tableName,
          recordId: req.params.id as string,
          action: 'update',
          oldValues: old as Record<string, unknown>,
          newValues: req.body,
          performedById: req.user!.userId,
          ipAddress: clientIp(req),
        });

        const io = req.app.get('io') as SocketIOServer | undefined;
        if (io) emitEntityEvent(io, 'entity:updated', { entity: entityFromUrl(req) });

        sendSuccess(res, record);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── DELETE /:id — Soft-delete (or hard-delete for lookup tables) ─────
  router.delete('/:id', ...writeMw, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      // Row-level security check before delete
      if (config.scopeMapping) {
        const existing = await delegate.findUnique({ where: { id } });
        if (!existing) {
          sendError(res, 404, 'Record not found');
          return;
        }
        if (!canAccessRecord(req.user!, existing as Record<string, unknown>, config.scopeMapping)) {
          sendError(res, 403, 'You do not have access to this record');
          return;
        }
      }

      if (softDelete) {
        // Soft-delete: set deletedAt timestamp
        await delegate.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      } else {
        await delegate.delete({ where: { id } });
      }

      await createAuditLog({
        tableName: config.tableName,
        recordId: id,
        action: 'delete',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) emitEntityEvent(io, 'entity:deleted', { entity: entityFromUrl(req) });

      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
