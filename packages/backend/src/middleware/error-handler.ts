import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, RequestValidationError } from '@nit-scs-v2/shared';
import { log } from '../config/logger.js';
import { Sentry } from '../config/sentry.js';

// Evaluated per-call (not captured at module load) so tests can toggle NODE_ENV
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

interface DynamicValidationError extends Error {
  statusCode: number;
  fieldErrors?: Record<string, string>;
}

function isDynamicValidationError(err: unknown): err is DynamicValidationError {
  return err instanceof Error && 'statusCode' in err;
}

/**
 * Strip sensitive keys from any response body before sending.
 * Ensures no stack traces, Prisma meta, or raw query details leak.
 */
function sanitizeResponseBody(body: Record<string, unknown>): Record<string, unknown> {
  const { stack, meta, query, ...safe } = body;
  return safe;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // In production: log full error for 5xx, message-only for 4xx
  // In development: always log full error with stack
  if (isProduction()) {
    const statusCode =
      err instanceof AppError ? err.statusCode :
      isDynamicValidationError(err) ? err.statusCode :
      err instanceof Prisma.PrismaClientKnownRequestError ? 400 :
      err instanceof Prisma.PrismaClientValidationError ? 400 :
      500;

    if (statusCode >= 500) {
      log('error', err.message, { stack: err.stack });
    } else {
      log('error', err.message, { code: (err as AppError).code });
    }
  } else {
    log('error', err.message, { stack: err.stack });
  }

  // ── Sentry context ──────────────────────────────────────────────────
  // In production, don't include params (may contain sensitive IDs)
  Sentry.setContext('request', {
    method: _req.method,
    url: _req.url,
    ...(isProduction() ? {} : { params: _req.params }),
  });

  // ── Custom AppError subclasses ────────────────────────────────────────
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      Sentry.captureException(err);
    }
    const body: Record<string, unknown> = {
      success: false,
      message: err.message,
      code: err.code,
    };
    if (err instanceof RequestValidationError && err.details) {
      body.errors = err.details;
    }
    res.status(err.statusCode).json(sanitizeResponseBody(body));
    return;
  }

  // ── DynamicValidationError (422) ──────────────────────────────────────
  if (isDynamicValidationError(err) && err.statusCode === 422) {
    res.status(422).json(sanitizeResponseBody({
      success: false,
      message: err.message,
      code: 'DYNAMIC_VALIDATION_ERROR',
      errors: err.fieldErrors,
    }));
    return;
  }

  // ── Prisma known request errors ───────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // In production, don't leak field names
        const message = isProduction()
          ? 'Duplicate value'
          : `Duplicate value for ${(err.meta?.target as string[])?.join(', ') || 'field'}`;
        res.status(409).json(sanitizeResponseBody({
          success: false,
          message,
          code: 'DUPLICATE_ENTRY',
        }));
        return;
      }
      case 'P2025':
        res.status(404).json(sanitizeResponseBody({
          success: false,
          message: 'Record not found',
          code: 'NOT_FOUND',
        }));
        return;
      case 'P2003':
        res.status(400).json(sanitizeResponseBody({
          success: false,
          message: 'Referenced record does not exist',
          code: 'FK_VIOLATION',
        }));
        return;
      case 'P2034':
        res.status(409).json(sanitizeResponseBody({
          success: false,
          message: 'Transaction conflict — please retry the operation',
          code: 'TRANSACTION_CONFLICT',
        }));
        return;
    }
  }

  // ── Prisma validation errors ──────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json(sanitizeResponseBody({
      success: false,
      message: 'Invalid data provided',
      code: 'VALIDATION_ERROR',
    }));
    return;
  }

  // ── Default 500 ───────────────────────────────────────────────────────
  Sentry.captureException(err);
  res.status(500).json(sanitizeResponseBody({
    success: false,
    message: isProduction() ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  }));
}
