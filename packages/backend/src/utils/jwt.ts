import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getEnv } from '../config/env.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  systemRole: string;
  assignedProjectId?: string | null;
  assignedWarehouseId?: string | null;
  jti?: string; // JWT ID for revocation tracking
}

const ISSUER = 'nit-scs';
const AUDIENCE = 'nit-scs-api';

function getSecrets() {
  const env = getEnv();
  return { secret: env.JWT_SECRET, refreshSecret: env.JWT_REFRESH_SECRET };
}

function getAccessOptions(): SignOptions {
  const env = getEnv();
  return {
    expiresIn: (env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  };
}

function getRefreshOptions(): SignOptions {
  const env = getEnv();
  return {
    expiresIn: (env.JWT_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  };
}

export function signAccessToken(payload: JwtPayload): string {
  const tokenPayload = { ...payload, jti: randomUUID() };
  return jwt.sign(tokenPayload as object, getSecrets().secret, getAccessOptions());
}

export function signRefreshToken(payload: JwtPayload): string {
  const tokenPayload = { ...payload, jti: randomUUID() };
  return jwt.sign(tokenPayload as object, getSecrets().refreshSecret, getRefreshOptions());
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getSecrets().secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, getSecrets().refreshSecret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as JwtPayload;
}

/**
 * Decode a token without verification (e.g. to read jti for blacklisting).
 */
export function decodeToken(token: string): JwtPayload | null {
  const decoded = jwt.decode(token);
  return decoded as JwtPayload | null;
}
