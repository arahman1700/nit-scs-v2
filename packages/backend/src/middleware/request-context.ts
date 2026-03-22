// ---------------------------------------------------------------------------
// AsyncLocalStorage-based Request Context
// ---------------------------------------------------------------------------
// Provides a per-request context using Node.js AsyncLocalStorage. Every async
// continuation within a request scope can retrieve the correlationId without
// passing it explicitly through function arguments.
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';

export interface RequestContextStore {
  correlationId: string;
  requestId?: string;
  userId?: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();

/** Retrieve the correlationId from the current async context, or undefined if outside a request scope. */
export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

/** Retrieve the full request context store, or undefined if outside a request scope. */
export function getRequestContext(): RequestContextStore | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Express middleware that wraps downstream handlers in an AsyncLocalStorage context.
 * Must be mounted AFTER requestId (so x-request-id is available) and BEFORE requestLogger.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const correlationId = crypto.randomUUID();
  const requestId = req.headers['x-request-id'] as string | undefined;

  res.setHeader('X-Correlation-ID', correlationId);

  asyncLocalStorage.run({ correlationId, requestId }, next);
}
