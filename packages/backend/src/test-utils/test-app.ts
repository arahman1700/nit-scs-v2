/**
 * Test app factory for integration tests with supertest.
 *
 * Creates a minimal Express app with the full middleware chain and routes
 * but WITHOUT side effects (no server.listen, no Redis connect, no scheduler).
 *
 * Usage:
 *   import { createTestApp, signTestToken } from '../test-utils/test-app.js';
 *   import supertest from 'supertest';
 *
 *   const app = createTestApp();
 *   const request = supertest(app);
 *   const token = signTestToken({ systemRole: 'admin' });
 *
 *   const res = await request.get('/api/v1/delegations')
 *     .set('Authorization', `Bearer ${token}`);
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { requestId } from '../middleware/request-id.js';
import { errorHandler } from '../middleware/error-handler.js';
import apiRoutes from '../routes/index.js';

// Dev fallback secret (matches config/env.ts)
const DEV_JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';

/**
 * Create a minimal Express app for integration testing.
 * Includes: JSON parsing, requestId, API routes, error handler.
 * Excludes: helmet, cors, morgan, swagger, static files, socket.io, redis.
 */
export function createTestApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(requestId);
  app.use('/api/v1', apiRoutes);
  app.use(errorHandler);

  return app;
}

export interface TestTokenPayload {
  userId?: string;
  email?: string;
  role?: string;
  systemRole?: string;
  assignedProjectId?: string | null;
  assignedWarehouseId?: string | null;
}

/**
 * Sign a JWT token for use in integration tests.
 * Uses the dev fallback secret that matches the backend config.
 */
export function signTestToken(overrides: TestTokenPayload = {}): string {
  const payload = {
    userId: overrides.userId ?? 'test-user-id',
    email: overrides.email ?? 'test@example.com',
    role: overrides.role ?? 'admin',
    systemRole: overrides.systemRole ?? 'admin',
    assignedProjectId: overrides.assignedProjectId ?? null,
    assignedWarehouseId: overrides.assignedWarehouseId ?? null,
  };

  return jwt.sign(payload, DEV_JWT_SECRET, {
    issuer: 'nit-scs',
    audience: 'nit-scs-api',
    expiresIn: '1h',
    jwtid: `test-${Date.now()}`,
  });
}
