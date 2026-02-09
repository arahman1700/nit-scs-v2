/**
 * Integration tests for auth routes.
 *
 * Mocks at the SERVICE layer so the full route+middleware stack is exercised.
 * Uses the dev JWT fallback secret so signTestToken() tokens pass verification.
 */

// ── Set env vars BEFORE any module is loaded (vi.hoisted runs first) ────

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

// ── Infrastructure mocks (must come before any app import) ──────────────

vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
}));

vi.mock('../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
}));

vi.mock('../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));

// ── Service mock ────────────────────────────────────────────────────────

vi.mock('../services/auth.service.js', () => ({
  login: vi.fn(),
  refreshTokens: vi.fn(),
  getMe: vi.fn(),
  changePassword: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

// ── Imports ─────────────────────────────────────────────────────────────

import * as authService from '../services/auth.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);

// ── Helpers ─────────────────────────────────────────────────────────────

const loginMock = authService.login as ReturnType<typeof vi.fn>;
const refreshMock = authService.refreshTokens as ReturnType<typeof vi.fn>;
const getMeMock = authService.getMe as ReturnType<typeof vi.fn>;
const changePasswordMock = authService.changePassword as ReturnType<typeof vi.fn>;
const forgotPasswordMock = authService.forgotPassword as ReturnType<typeof vi.fn>;
const resetPasswordMock = authService.resetPassword as ReturnType<typeof vi.fn>;
const logoutMock = authService.logout as ReturnType<typeof vi.fn>;

const ADMIN_TOKEN = signTestToken({ systemRole: 'admin' });

const fakeLoginResult = {
  user: {
    id: 'emp-1',
    email: 'admin@nit.com',
    fullName: 'Admin User',
    role: 'admin',
    systemRole: 'admin',
    department: 'IT',
    assignedProjectId: null,
    assignedWarehouseId: null,
  },
  accessToken: 'fake-access-token',
  refreshToken: 'fake-refresh-token',
};

// ── Tests ───────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset only the service mocks we care about (not isTokenBlacklisted)
  loginMock.mockReset();
  refreshMock.mockReset();
  getMeMock.mockReset();
  changePasswordMock.mockReset();
  forgotPasswordMock.mockReset();
  resetPasswordMock.mockReset();
  logoutMock.mockReset();
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/login', () => {
  it('should return 200 with user and tokens on success', async () => {
    loginMock.mockResolvedValue(fakeLoginResult);

    const res = await request.post('/api/v1/auth/login').send({ email: 'admin@nit.com', password: 'Secret123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('admin@nit.com');
    expect(res.body.data.accessToken).toBe('fake-access-token');
    expect(res.body.data.refreshToken).toBe('fake-refresh-token');
    expect(loginMock).toHaveBeenCalledWith('admin@nit.com', 'Secret123');
  });

  it('should return 401 when credentials are invalid', async () => {
    loginMock.mockRejectedValue(new Error('Invalid email or password'));

    const res = await request.post('/api/v1/auth/login').send({ email: 'bad@nit.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid/);
  });

  it('should return 400 when email is missing', async () => {
    const res = await request.post('/api/v1/auth/login').send({ password: 'Secret123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('should return 400 when password is missing', async () => {
    const res = await request.post('/api/v1/auth/login').send({ email: 'admin@nit.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('should return 400 when email is invalid format', async () => {
    const res = await request.post('/api/v1/auth/login').send({ email: 'not-an-email', password: 'Secret123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/refresh', () => {
  it('should return 200 with new tokens on success', async () => {
    refreshMock.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const res = await request.post('/api/v1/auth/refresh').send({ refreshToken: 'valid-refresh-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('new-access');
    expect(res.body.data.refreshToken).toBe('new-refresh');
    expect(refreshMock).toHaveBeenCalledWith('valid-refresh-token');
  });

  it('should return 401 when refresh token is invalid', async () => {
    refreshMock.mockRejectedValue(new Error('Token expired'));

    const res = await request.post('/api/v1/auth/refresh').send({ refreshToken: 'expired-token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid refresh token/);
  });

  it('should return 400 when refreshToken is missing', async () => {
    const res = await request.post('/api/v1/auth/refresh').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------
describe('GET /api/v1/auth/me', () => {
  const fakeUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'admin',
    systemRole: 'admin',
    department: 'IT',
    isActive: true,
    assignedProjectId: null,
    assignedWarehouseId: null,
  };

  it('should return 200 with user data when authenticated', async () => {
    getMeMock.mockResolvedValue(fakeUser);

    const res = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test@example.com');
    expect(getMeMock).toHaveBeenCalledWith('test-user-id');
  });

  it('should return 401 without auth token', async () => {
    const res = await request.get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(getMeMock).not.toHaveBeenCalled();
  });

  it('should return 401 with malformed auth header', async () => {
    const res = await request.get('/api/v1/auth/me').set('Authorization', 'InvalidHeader');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/change-password
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/change-password', () => {
  const validPayload = {
    currentPassword: 'OldPass1',
    newPassword: 'NewPass1secure',
  };

  it('should return 200 on success', async () => {
    changePasswordMock.mockResolvedValue(undefined);

    const res = await request
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/changed/i);
    expect(changePasswordMock).toHaveBeenCalledWith('test-user-id', 'OldPass1', 'NewPass1secure');
  });

  it('should return 400 when current password is incorrect', async () => {
    changePasswordMock.mockRejectedValue(new Error('Current password is incorrect'));

    const res = await request
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/incorrect/);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/auth/change-password').send(validPayload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('should return 400 when newPassword is too weak', async () => {
    const res = await request
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ currentPassword: 'OldPass1', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(changePasswordMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/forgot-password
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/forgot-password', () => {
  it('should return 200 with generic success message', async () => {
    forgotPasswordMock.mockResolvedValue(undefined);

    const res = await request.post('/api/v1/auth/forgot-password').send({ email: 'user@nit.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/reset code/i);
    expect(forgotPasswordMock).toHaveBeenCalledWith('user@nit.com');
  });

  it('should return 200 even for unknown email (no information leak)', async () => {
    forgotPasswordMock.mockResolvedValue(undefined);

    const res = await request.post('/api/v1/auth/forgot-password').send({ email: 'unknown@nit.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when email is missing', async () => {
    const res = await request.post('/api/v1/auth/forgot-password').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/reset-password
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/reset-password', () => {
  const validPayload = {
    email: 'user@nit.com',
    code: '123456',
    newPassword: 'NewSecure1pass',
  };

  it('should return 200 on success', async () => {
    resetPasswordMock.mockResolvedValue(undefined);

    const res = await request.post('/api/v1/auth/reset-password').send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/reset/i);
    expect(resetPasswordMock).toHaveBeenCalledWith('user@nit.com', '123456', 'NewSecure1pass');
  });

  it('should return 400 on invalid or expired code', async () => {
    resetPasswordMock.mockRejectedValue(new Error('Invalid or expired reset code'));

    const res = await request.post('/api/v1/auth/reset-password').send(validPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid or expired/);
  });

  it('should return 400 when code is missing', async () => {
    const res = await request
      .post('/api/v1/auth/reset-password')
      .send({ email: 'user@nit.com', newPassword: 'NewSecure1pass' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('should return 400 when code is wrong length', async () => {
    const res = await request
      .post('/api/v1/auth/reset-password')
      .send({ email: 'user@nit.com', code: '12', newPassword: 'NewSecure1pass' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('should return 400 when newPassword is too weak', async () => {
    const res = await request
      .post('/api/v1/auth/reset-password')
      .send({ email: 'user@nit.com', code: '123456', newPassword: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/logout', () => {
  it('should return 200 on success', async () => {
    logoutMock.mockResolvedValue(undefined);

    const res = await request
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ refreshToken: 'some-refresh-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/logged out/i);
    expect(logoutMock).toHaveBeenCalled();
  });

  it('should return 200 even when logout service throws', async () => {
    logoutMock.mockRejectedValue(new Error('Redis down'));

    const res = await request.post('/api/v1/auth/logout').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({});

    // Route catches errors and still returns success
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/auth/logout').send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(logoutMock).not.toHaveBeenCalled();
  });
});
