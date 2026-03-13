import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { sendSuccess, sendCreated, sendError } from './response.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import { paginate } from '../middleware/pagination.js';
import { validate } from '../middleware/validate.js';
import { auditAndEmit } from './routeHelpers.js';
import { buildScopeFilter, canAccessRecord, type ScopeFieldMapping } from './scope-filter.js';

/**
 * Configuration for a single status-transition action route.
 * Generates POST /:id/<path> with RBAC, calls the service function,
 * creates audit log, and emits socket events.
 */
export interface ActionConfig {
  /** URL path segment, e.g. 'submit', 'approve', 'complete' */
  path: string;
  /** Roles allowed to perform this action */
  roles: string[];
  /** Service function to call. Receives (id, req) and returns the result to send. */
  handler: (id: string, req: Request) => Promise<unknown>;
  /** Audit action name, defaults to 'update' */
  auditAction?: 'create' | 'update' | 'delete';
  /** Socket event name, e.g. 'mrrv:submitted'. If omitted, uses `${docType}:${path}` */
  socketEvent?: string;
  /** Extra socket data builder — receives the service result */
  socketData?: (result: unknown) => Record<string, unknown>;
  /** Entity event type. Defaults to none. */
  entityEvent?: 'created' | 'updated' | 'deleted';
  /** Optional validation schema for request body */
  bodySchema?: ZodSchema;
}

/**
 * Configuration for the document route factory.
 */
export interface DocumentRouteConfig {
  /** Document type identifier, e.g. 'mrrv', 'mirv', 'mrv' */
  docType: string;
  /** Audit table name, e.g. 'mrrv', 'osd_reports' */
  tableName: string;
  /**
   * RBAC resource name (must match a key in the permissions matrix, e.g. 'grn', 'mi', 'dr').
   * When provided, the factory uses DB-backed `requirePermission(resource, action)` instead of
   * role-list–based `requireRole(...roles)`. The `createRoles`, `updateRoles`, and action `roles`
   * fields become fallbacks only used when `resource` is NOT set (backward-compat).
   */
  resource?: string;

  // ── List ─────────────────────────────────────
  /** Service function for listing. Receives pagination params. */
  list: (params: {
    skip: number;
    pageSize: number;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    search?: string;
    status?: string;
    [key: string]: unknown;
  }) => Promise<{ data: unknown[]; total: number }>;
  /** Default sort field. Defaults to 'createdAt'. */
  defaultSort?: string;

  // ── Get by ID ────────────────────────────────
  /** Service function to get a single record by ID. Should throw NotFoundError if missing. */
  getById: (id: string) => Promise<unknown>;

  // ── Create ───────────────────────────────────
  /** Zod schema for create validation */
  createSchema?: ZodSchema;
  /** Roles allowed to create */
  createRoles: string[];
  /** Service function for creation. Receives (body, userId). */
  create?: (
    body: Record<string, unknown>,
    userId: string,
    req: Request,
  ) => Promise<{ id: string; [key: string]: unknown }>;

  // ── Update ───────────────────────────────────
  /** Zod schema for update validation */
  updateSchema?: ZodSchema;
  /** Roles allowed to update */
  updateRoles: string[];
  /** Service function for update. Receives (id, body). Should throw if not draft. */
  update?: (id: string, body: Record<string, unknown>) => Promise<{ existing: unknown; updated: unknown }>;

  // ── Status-transition actions ────────────────
  actions?: ActionConfig[];

  // ── Row-level security ────────────────────────
  /** Field mapping for row-level scope filtering. If omitted, defaults to warehouseId/projectId. */
  scopeMapping?: ScopeFieldMapping;
}

/**
 * Creates an Express Router for a document module using the service layer.
 * Generates standard list/get/create/update routes plus configurable action routes.
 *
 * All error handling is delegated to next() → the global error handler
 * (which already handles AppError subclasses from the service layer).
 */
export function createDocumentRouter(config: DocumentRouteConfig): Router {
  const router = Router();
  const defaultSort = config.defaultSort ?? 'createdAt';

  const scopeMapping = config.scopeMapping ?? { warehouseField: 'warehouseId', projectField: 'projectId' };

  // ── Helper: build RBAC middleware from resource or fallback roles ──
  const rbac = (action: 'read' | 'create' | 'update' | 'delete' | 'approve', fallbackRoles?: string[]) => {
    if (config.resource) return requirePermission(config.resource, action);
    if (fallbackRoles?.length) return requireRole(...fallbackRoles);
    // Fail-closed: deny access when no permission resource is configured
    return (_req: Request, res: Response) => {
      res.status(403).json({ error: 'No permission resource configured for this route' });
    };
  };

  /**
   * @openapi
   * /{resource}:
   *   get:
   *     tags:
   *       - Document Factory
   *     summary: List documents with pagination
   *     description: >
   *       Generic list endpoint generated by the document-factory for each
   *       document type (MRRV, MIRV, MRV, RFIM, OSD, etc.). Supports pagination,
   *       free-text search, status filtering, and row-level security scoping.
   *     parameters:
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           default: 1
   *       - name: pageSize
   *         in: query
   *         schema:
   *           type: integer
   *           default: 25
   *       - name: sortBy
   *         in: query
   *         schema:
   *           type: string
   *         description: Field to sort by (default varies by resource)
   *       - name: sortDir
   *         in: query
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *       - name: search
   *         in: query
   *         schema:
   *           type: string
   *         description: Free-text search across key fields
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by document status
   *     responses:
   *       '200':
   *         description: Paginated list of documents
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedResponse'
   *       '401':
   *         description: Unauthorized — missing or invalid JWT
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // ── GET / — List with pagination ─────────────────────────────────
  router.get(
    '/',
    authenticate,
    rbac('read'),
    paginate(defaultSort),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { skip, pageSize, sortBy, sortDir, search, page } = req.pagination!;

        // Row-level security: inject scope filter based on user role
        const scopeFilter = buildScopeFilter(req.user!, scopeMapping);

        // Collect extra query filters (status, etc.)
        const extra: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(req.query)) {
          if (['page', 'pageSize', 'sortBy', 'sortDir', 'search'].includes(key)) continue;
          if (value && typeof value === 'string') extra[key] = value;
        }

        const { data, total } = await config.list({
          skip,
          pageSize,
          sortBy,
          sortDir,
          search,
          ...extra,
          ...scopeFilter,
        });

        sendSuccess(res, data, { page, pageSize, total });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * @openapi
   * /{resource}/{id}:
   *   get:
   *     tags:
   *       - Document Factory
   *     summary: Get a single document by ID
   *     description: >
   *       Generic get-by-ID endpoint generated by the document-factory.
   *       Includes row-level security checks — the authenticated user must
   *       have access to the record's warehouse/project scope.
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Document UUID
   *     responses:
   *       '200':
   *         description: Document details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       '401':
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '403':
   *         description: Forbidden — user does not have access to this record
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '404':
   *         description: Document not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // ── GET /:id — Get by ID ────────────────────────────────────────
  router.get('/:id', authenticate, rbac('read'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await config.getById(req.params.id as string);
      // Row-level security: verify user has access to this record
      if (!canAccessRecord(req.user!, record as Record<string, unknown>, scopeMapping)) {
        sendError(res, 403, 'You do not have access to this record');
        return;
      }
      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /{resource}:
   *   post:
   *     tags:
   *       - Document Factory
   *     summary: Create a new document
   *     description: >
   *       Generic create endpoint generated by the document-factory.
   *       Validates the request body against the resource's Zod schema,
   *       creates an audit log entry, and emits a Socket.IO event.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Fields vary by document type — validated by Zod schema
   *     responses:
   *       '201':
   *         description: Document created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       '400':
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '401':
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '403':
   *         description: Forbidden — insufficient role/permission
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // ── POST / — Create ─────────────────────────────────────────────
  if (config.create && config.createSchema) {
    const mw = [authenticate, rbac('create', config.createRoles), validate(config.createSchema)];
    router.post('/', ...mw, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await config.create!(req.body, req.user!.userId, req);

        await auditAndEmit(req, {
          action: 'create',
          tableName: config.tableName,
          recordId: result.id,
          newValues: req.body,
          entityEvent: 'created',
          entityName: config.docType,
        });

        sendCreated(res, result);
      } catch (err) {
        next(err);
      }
    });
  }

  /**
   * @openapi
   * /{resource}/{id}:
   *   put:
   *     tags:
   *       - Document Factory
   *     summary: Update an existing document
   *     description: >
   *       Generic update endpoint generated by the document-factory.
   *       Only draft documents can be updated. Validates the request body,
   *       creates an audit log entry with old and new values, and emits
   *       a Socket.IO event.
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Document UUID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Fields vary by document type — validated by Zod schema
   *     responses:
   *       '200':
   *         description: Document updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessResponse'
   *       '400':
   *         description: Validation error or document not in draft status
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '401':
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '403':
   *         description: Forbidden — insufficient role/permission
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       '404':
   *         description: Document not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // ── PUT /:id — Update ───────────────────────────────────────────
  if (config.update && config.updateSchema) {
    const mw = [authenticate, rbac('update', config.updateRoles), validate(config.updateSchema)];
    router.put('/:id', ...mw, async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Phase C: version field is required for optimistic locking on all document updates
        const version = (req.body as Record<string, unknown>).version;
        if (version === undefined || version === null) {
          sendError(res, 400, 'version field is required for updates');
          return;
        }

        const { existing, updated } = await config.update!(req.params.id as string, req.body);

        await auditAndEmit(req, {
          action: 'update',
          tableName: config.tableName,
          recordId: req.params.id as string,
          oldValues: existing as Record<string, unknown>,
          newValues: req.body,
          entityEvent: 'updated',
          entityName: config.docType,
        });

        sendSuccess(res, updated);
      } catch (err) {
        next(err);
      }
    });
  }

  // ── Status-transition action routes ──────────────────────────────
  if (config.actions) {
    const APPROVE_ACTIONS = new Set(['approve', 'reject', 'review']);

    for (const action of config.actions) {
      // Map action path to permission: approve/reject/review → 'approve', everything else → 'update'
      const permAction = APPROVE_ACTIONS.has(action.path) ? ('approve' as const) : ('update' as const);

      const mw: Array<(req: Request, res: Response, next: NextFunction) => void | Promise<void>> = [
        authenticate,
        config.resource ? requirePermission(config.resource, permAction) : requireRole(...action.roles),
      ];
      if (action.bodySchema) {
        mw.push(validate(action.bodySchema));
      }

      router.post(`/:id/${action.path}`, ...mw, async (req: Request, res: Response, next: NextFunction) => {
        try {
          const id = req.params.id as string;

          // Row-level security: verify user has access before performing action
          const existingRecord = await config.getById(id);
          if (!canAccessRecord(req.user!, existingRecord as Record<string, unknown>, scopeMapping)) {
            sendError(res, 403, 'You do not have access to this record');
            return;
          }

          const result = await action.handler(id, req);

          const socketEvent = action.socketEvent ?? `${config.docType}:${action.path}`;
          const socketPayload = action.socketData ? action.socketData(result) : { status: action.path };

          await auditAndEmit(req, {
            action: action.auditAction ?? 'update',
            tableName: config.tableName,
            recordId: id,
            newValues: socketPayload,
            socketEvent,
            docType: config.docType,
            socketData: { id, ...socketPayload },
            entityEvent: action.entityEvent,
            entityName: action.entityEvent ? config.docType : undefined,
          });

          sendSuccess(res, result);
        } catch (err) {
          next(err);
        }
      });
    }
  }

  return router;
}
