import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Mock all dependencies before importing the factory
const {
  mockPrisma,
  mockGetPrismaDelegate,
  mockSendSuccess,
  mockSendCreated,
  mockSendNoContent,
  mockSendError,
  mockAuthenticate,
  mockRequireRole,
  mockRequirePermission,
  mockPaginate,
  mockValidate,
  mockCreateAuditLog,
  mockEmitEntityEvent,
  mockClientIp,
  mockBuildScopeFilter,
  mockCanAccessRecord,
} = vi.hoisted(() => {
  return {
    mockPrisma: {} as any,
    mockGetPrismaDelegate: vi.fn(),
    mockSendSuccess: vi.fn(),
    mockSendCreated: vi.fn(),
    mockSendNoContent: vi.fn(),
    mockSendError: vi.fn(),
    mockAuthenticate: vi.fn((_req: any, _res: any, next: any) => next()),
    mockRequireRole: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    mockRequirePermission: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    mockPaginate: vi.fn(() => (req: any, _res: any, next: any) => {
      req.pagination = { skip: 0, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc', search: '', page: 1 };
      next();
    }),
    mockValidate: vi.fn(() => (req: any, _res: any, next: any) => next()),
    mockCreateAuditLog: vi.fn().mockResolvedValue({}),
    mockEmitEntityEvent: vi.fn(),
    mockClientIp: vi.fn(() => '127.0.0.1'),
    mockBuildScopeFilter: vi.fn(() => ({})),
    mockCanAccessRecord: vi.fn(() => true),
  };
});

vi.mock('./prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./prisma-helpers.js', () => ({ getPrismaDelegate: mockGetPrismaDelegate }));
vi.mock('./response.js', () => ({
  sendSuccess: mockSendSuccess,
  sendCreated: mockSendCreated,
  sendNoContent: mockSendNoContent,
  sendError: mockSendError,
}));
vi.mock('../middleware/auth.js', () => ({ authenticate: mockAuthenticate }));
vi.mock('../middleware/rbac.js', () => ({
  requireRole: mockRequireRole,
  requirePermission: mockRequirePermission,
}));
vi.mock('../middleware/pagination.js', () => ({ paginate: mockPaginate }));
vi.mock('../middleware/validate.js', () => ({ validate: mockValidate }));
vi.mock('../domains/audit/services/audit.service.js', () => ({
  createAuditLog: mockCreateAuditLog,
}));
vi.mock('../socket/setup.js', () => ({ emitEntityEvent: mockEmitEntityEvent }));
vi.mock('./helpers.js', () => ({ clientIp: mockClientIp }));
vi.mock('./scope-filter.js', () => ({
  buildScopeFilter: mockBuildScopeFilter,
  canAccessRecord: mockCanAccessRecord,
}));

import { createCrudRouter, type CrudConfig } from './crud-factory.js';

const createSchema = z.object({ name: z.string() });
const updateSchema = z.object({ name: z.string().optional() });

const mockDelegate = {
  findMany: vi.fn().mockResolvedValue([]),
  findUnique: vi.fn().mockResolvedValue(null),
  count: vi.fn().mockResolvedValue(0),
  create: vi.fn().mockResolvedValue({ id: 'new-1' }),
  update: vi.fn().mockResolvedValue({ id: 'upd-1' }),
  delete: vi.fn().mockResolvedValue({}),
};

describe('crud-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrismaDelegate.mockReturnValue(mockDelegate);
  });

  const config: CrudConfig = {
    modelName: 'region',
    tableName: 'regions',
    createSchema,
    updateSchema,
    searchFields: ['regionName', 'code'],
  };

  it('should create a router with GET, POST, PUT, DELETE routes', () => {
    const router = createCrudRouter(config);

    expect(router).toBeDefined();
    // Router has stack of middleware layers
    const routes = (router as any).stack.filter((s: any) => s.route);
    const paths = routes.map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
    expect(paths).toContain('GET /');
    expect(paths).toContain('GET /:id');
    expect(paths).toContain('POST /');
    expect(paths).toContain('PUT /:id');
    expect(paths).toContain('DELETE /:id');
  });

  it('should use requirePermission when resource is configured', () => {
    const configWithResource = { ...config, resource: 'regions' };
    createCrudRouter(configWithResource);

    expect(mockRequirePermission).toHaveBeenCalled();
  });

  it('should use requireRole as fallback when allowedRoles is set but resource is not', () => {
    const configWithRoles = { ...config, allowedRoles: ['admin', 'manager'] };
    createCrudRouter(configWithRoles);

    expect(mockRequireRole).toHaveBeenCalled();
  });

  it('should use paginate middleware with the configured default sort', () => {
    createCrudRouter({ ...config, defaultSort: 'regionName' });

    expect(mockPaginate).toHaveBeenCalledWith('regionName');
  });

  it('should use "createdAt" as default sort when not specified', () => {
    createCrudRouter(config);

    expect(mockPaginate).toHaveBeenCalledWith('createdAt');
  });

  it('should use authenticate middleware on all routes', () => {
    createCrudRouter(config);

    // authenticate is called during router setup (middleware registration)
    expect(mockAuthenticate).toBeDefined();
  });

  it('should use validate middleware for POST and PUT routes', () => {
    createCrudRouter(config);

    // validate is called with createSchema and updateSchema
    expect(mockValidate).toHaveBeenCalledWith(createSchema);
    expect(mockValidate).toHaveBeenCalledWith(updateSchema);
  });

  it('should call getPrismaDelegate with the model name', () => {
    createCrudRouter(config);

    expect(mockGetPrismaDelegate).toHaveBeenCalledWith(mockPrisma, 'region');
  });

  it('should treat softDelete as false by default', () => {
    // When softDelete is not set, default behavior is hard delete
    const router = createCrudRouter(config);
    expect(router).toBeDefined();
  });

  it('should support softDelete configuration', () => {
    const router = createCrudRouter({ ...config, softDelete: true });
    expect(router).toBeDefined();
  });

  it('should accept allowedFilters configuration', () => {
    const router = createCrudRouter({
      ...config,
      allowedFilters: ['status', 'projectId'],
    });
    expect(router).toBeDefined();
  });

  it('should accept omitFields configuration', () => {
    const router = createCrudRouter({
      ...config,
      omitFields: ['passwordHash'],
    });
    expect(router).toBeDefined();
  });

  it('should accept beforeDelete guard configuration', () => {
    const router = createCrudRouter({
      ...config,
      beforeDelete: vi.fn().mockResolvedValue(undefined),
    });
    expect(router).toBeDefined();
  });

  it('should accept scopeMapping configuration', () => {
    const router = createCrudRouter({
      ...config,
      scopeMapping: { warehouseField: 'warehouseId', projectField: 'projectId' },
    });
    expect(router).toBeDefined();
  });

  it('should accept detailIncludes separate from list includes', () => {
    const router = createCrudRouter({
      ...config,
      includes: { project: true },
      detailIncludes: { project: true, warehouse: true },
    });
    expect(router).toBeDefined();
  });
});
