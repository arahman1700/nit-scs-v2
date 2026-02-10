import type { Request, Response, NextFunction } from 'express';
import { requireRole, requirePermission } from './rbac.js';

const mockReq = (overrides = {}) => ({ headers: {}, query: {}, body: {}, ...overrides }) as unknown as Request;

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    locals: {},
  } as unknown as Response;
  return res;
};

let nextFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  nextFn = vi.fn();
});

describe('requireRole middleware', () => {
  it('allows user with matching role', () => {
    const middleware = requireRole('warehouse_supervisor', 'manager');
    const req = mockReq({ user: { systemRole: 'manager', userId: 'u1' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows admin even if not in the allowed roles list', () => {
    const middleware = requireRole('warehouse_supervisor', 'manager');
    const req = mockReq({ user: { systemRole: 'admin', userId: 'u1' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects user with wrong role (403)', () => {
    const middleware = requireRole('manager');
    const req = mockReq({ user: { systemRole: 'warehouse_staff', userId: 'u1' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Access denied'),
      }),
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated request (401, no req.user)', () => {
    const middleware = requireRole('manager');
    const req = mockReq(); // no user property
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Authentication required'),
      }),
    );
    expect(nextFn).not.toHaveBeenCalled();
  });
});

describe('requirePermission middleware', () => {
  it('allows user with the required permission', () => {
    // admin has all permissions on grn including 'create'
    const middleware = requirePermission('grn', 'create');
    const req = mockReq({ user: { systemRole: 'admin', userId: 'u1' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows warehouse_supervisor to read grn', () => {
    const middleware = requirePermission('grn', 'read');
    const req = mockReq({ user: { systemRole: 'warehouse_supervisor', userId: 'u1' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
  });

  it('rejects user without the required permission (403)', () => {
    // freight_forwarder cannot delete shipments
    const middleware = requirePermission('shipment', 'delete');
    const req = mockReq({ user: { systemRole: 'freight_forwarder', userId: 'u1' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Access denied'),
      }),
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('rejects unknown role without permissions', () => {
    const middleware = requirePermission('grn', 'create');
    const req = mockReq({ user: { systemRole: 'unknown_role', userId: 'u1' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated request (401)', () => {
    const middleware = requirePermission('grn', 'read');
    const req = mockReq(); // no user
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Authentication required'),
      }),
    );
    expect(nextFn).not.toHaveBeenCalled();
  });
});
