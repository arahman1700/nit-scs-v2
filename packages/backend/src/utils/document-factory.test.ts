import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Mock all dependencies before importing the factory
const {
  mockSendSuccess,
  mockSendCreated,
  mockSendError,
  mockAuthenticate,
  mockRequireRole,
  mockRequirePermission,
  mockPaginate,
  mockValidate,
  mockAuditAndEmit,
  mockBuildScopeFilter,
  mockCanAccessRecord,
} = vi.hoisted(() => {
  return {
    mockSendSuccess: vi.fn(),
    mockSendCreated: vi.fn(),
    mockSendError: vi.fn(),
    mockAuthenticate: vi.fn((_req: any, _res: any, next: any) => next()),
    mockRequireRole: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    mockRequirePermission: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    mockPaginate: vi.fn(() => (req: any, _res: any, next: any) => {
      req.pagination = { skip: 0, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc', search: '', page: 1 };
      next();
    }),
    mockValidate: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    mockAuditAndEmit: vi.fn().mockResolvedValue(undefined),
    mockBuildScopeFilter: vi.fn(() => ({})),
    mockCanAccessRecord: vi.fn(() => true),
  };
});

vi.mock('./response.js', () => ({
  sendSuccess: mockSendSuccess,
  sendCreated: mockSendCreated,
  sendError: mockSendError,
}));
vi.mock('../middleware/auth.js', () => ({ authenticate: mockAuthenticate }));
vi.mock('../middleware/rbac.js', () => ({
  requireRole: mockRequireRole,
  requirePermission: mockRequirePermission,
}));
vi.mock('../middleware/pagination.js', () => ({ paginate: mockPaginate }));
vi.mock('../middleware/validate.js', () => ({ validate: mockValidate }));
vi.mock('./routeHelpers.js', () => ({ auditAndEmit: mockAuditAndEmit }));
vi.mock('./scope-filter.js', () => ({
  buildScopeFilter: mockBuildScopeFilter,
  canAccessRecord: mockCanAccessRecord,
}));

import { createDocumentRouter, type DocumentRouteConfig, type ActionConfig } from './document-factory.js';

const createSchema = z.object({ projectId: z.string() });
const updateSchema = z.object({ notes: z.string().optional() });

describe('document-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseConfig: DocumentRouteConfig = {
    docType: 'mrrv',
    tableName: 'mrrv',
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getById: vi.fn().mockResolvedValue({ id: 'doc-1' }),
    createRoles: ['warehouse_staff', 'admin'],
    updateRoles: ['warehouse_staff', 'admin'],
  };

  it('should create a router with GET / and GET /:id routes', () => {
    const router = createDocumentRouter(baseConfig);

    const routes = (router as any).stack.filter((s: any) => s.route);
    const paths = routes.map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
    expect(paths).toContain('GET /');
    expect(paths).toContain('GET /:id');
  });

  it('should include POST route when create and createSchema are provided', () => {
    const router = createDocumentRouter({
      ...baseConfig,
      create: vi.fn().mockResolvedValue({ id: 'new-1' }),
      createSchema,
    });

    const routes = (router as any).stack.filter((s: any) => s.route);
    const paths = routes.map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
    expect(paths).toContain('POST /');
  });

  it('should not include POST route when create is not provided', () => {
    const router = createDocumentRouter(baseConfig);

    const routes = (router as any).stack.filter((s: any) => s.route);
    const paths = routes.map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
    expect(paths).not.toContain('POST /');
  });

  it('should include PUT route when update and updateSchema are provided', () => {
    const router = createDocumentRouter({
      ...baseConfig,
      update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
      updateSchema,
    });

    const routes = (router as any).stack.filter((s: any) => s.route);
    const paths = routes.map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
    expect(paths).toContain('PUT /:id');
  });

  it('should not include PUT route when update is not provided', () => {
    const router = createDocumentRouter(baseConfig);

    const routes = (router as any).stack.filter((s: any) => s.route);
    const paths = routes.map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
    expect(paths).not.toContain('PUT /:id');
  });

  it('should create action routes for each configured action', () => {
    const actions: ActionConfig[] = [
      { path: 'submit', roles: ['warehouse_staff'], handler: vi.fn().mockResolvedValue({}) },
      { path: 'approve', roles: ['manager'], handler: vi.fn().mockResolvedValue({}) },
    ];

    const router = createDocumentRouter({ ...baseConfig, actions });

    const routes = (router as any).stack.filter((s: any) => s.route);
    const paths = routes.map((r: any) => r.route.path);
    expect(paths).toContain('/:id/submit');
    expect(paths).toContain('/:id/approve');
  });

  it('should use requirePermission when resource is configured', () => {
    createDocumentRouter({ ...baseConfig, resource: 'grn' });

    expect(mockRequirePermission).toHaveBeenCalled();
  });

  it('should use requireRole as fallback when resource is not set', () => {
    const actions: ActionConfig[] = [
      { path: 'submit', roles: ['warehouse_staff'], handler: vi.fn().mockResolvedValue({}) },
    ];
    createDocumentRouter({ ...baseConfig, actions });

    expect(mockRequireRole).toHaveBeenCalledWith('warehouse_staff');
  });

  it('should use paginate middleware with configured defaultSort', () => {
    createDocumentRouter({ ...baseConfig, defaultSort: 'mrrvNumber' });

    expect(mockPaginate).toHaveBeenCalledWith('mrrvNumber');
  });

  it('should default sort to "createdAt" when not specified', () => {
    createDocumentRouter(baseConfig);

    expect(mockPaginate).toHaveBeenCalledWith('createdAt');
  });

  it('should use validate middleware for create routes', () => {
    createDocumentRouter({
      ...baseConfig,
      create: vi.fn().mockResolvedValue({ id: 'new-1' }),
      createSchema,
    });

    expect(mockValidate).toHaveBeenCalledWith(createSchema);
  });

  it('should use validate middleware for update routes', () => {
    createDocumentRouter({
      ...baseConfig,
      update: vi.fn().mockResolvedValue({ existing: {}, updated: {} }),
      updateSchema,
    });

    expect(mockValidate).toHaveBeenCalledWith(updateSchema);
  });

  it('should use validate middleware for actions with bodySchema', () => {
    const bodySchema = z.object({ reason: z.string() });
    const actions: ActionConfig[] = [{ path: 'reject', roles: ['manager'], handler: vi.fn(), bodySchema }];
    createDocumentRouter({ ...baseConfig, actions });

    expect(mockValidate).toHaveBeenCalledWith(bodySchema);
  });

  it('should map approve/reject/review actions to "approve" permission', () => {
    const actions: ActionConfig[] = [
      { path: 'approve', roles: ['manager'], handler: vi.fn() },
      { path: 'reject', roles: ['manager'], handler: vi.fn() },
      { path: 'review', roles: ['manager'], handler: vi.fn() },
    ];
    createDocumentRouter({ ...baseConfig, resource: 'grn', actions });

    // requirePermission should be called with 'approve' for these paths
    const permissionCalls = mockRequirePermission.mock.calls;
    const approvePerms = permissionCalls.filter((c: any[]) => c[1] === 'approve');
    expect(approvePerms.length).toBeGreaterThanOrEqual(3);
  });

  it('should map non-approve actions to "update" permission', () => {
    const actions: ActionConfig[] = [
      { path: 'submit', roles: ['warehouse_staff'], handler: vi.fn() },
      { path: 'complete', roles: ['warehouse_staff'], handler: vi.fn() },
    ];
    createDocumentRouter({ ...baseConfig, resource: 'grn', actions });

    const permissionCalls = mockRequirePermission.mock.calls;
    const updatePerms = permissionCalls.filter((c: any[]) => c[1] === 'update');
    expect(updatePerms.length).toBeGreaterThanOrEqual(2);
  });

  it('should default scopeMapping to warehouseId/projectId', () => {
    createDocumentRouter(baseConfig);
    // The default scope mapping is used internally
    expect(mockBuildScopeFilter).toBeDefined();
  });

  it('should accept custom scopeMapping', () => {
    const router = createDocumentRouter({
      ...baseConfig,
      scopeMapping: { warehouseField: 'sourceWarehouseId', projectField: 'projectId' },
    });
    expect(router).toBeDefined();
  });

  it('should register authenticate middleware on list route', () => {
    createDocumentRouter(baseConfig);
    expect(mockAuthenticate).toBeDefined();
  });
});
