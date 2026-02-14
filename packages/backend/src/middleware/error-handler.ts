import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, RequestValidationError } from '@nit-scs-v2/shared';
import { log } from '../config/logger.js';
import { Sentry } from '../config/sentry.js';

interface DynamicValidationError extends Error {
  statusCode: number;
  fieldErrors?: Record<string, string>;
}

function isDynamicValidationError(err: unknown): err is DynamicValidationError {
  return err instanceof Error && 'statusCode' in err;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  log('error', err.message, { stack: err.stack });

  // ── Sentry context ──────────────────────────────────────────────────
  Sentry.setContext('request', { method: _req.method, url: _req.url, params: _req.params });

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
    res.status(err.statusCode).json(body);
    return;
  }

  // ── DynamicValidationError (422) ──────────────────────────────────────
  if (isDynamicValidationError(err) && err.statusCode === 422) {
    res.status(422).json({
      success: false,
      message: err.message,
      code: 'DYNAMIC_VALIDATION_ERROR',
      errors: err.fieldErrors,
    });
    return;
  }

  // ── Prisma known request errors ───────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        res.status(409).json({
          success: false,
          message: `Duplicate value for ${target}`,
          code: 'DUPLICATE_ENTRY',
        });
        return;
      }
      case 'P2025':
        res.status(404).json({
          success: false,
          message: 'Record not found',
          code: 'NOT_FOUND',
        });
        return;
      case 'P2003':
        res.status(400).json({
          success: false,
          message: 'Referenced record does not exist',
          code: 'FK_VIOLATION',
        });
        return;
    }
  }

  // ── Prisma validation errors ──────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: 'Invalid data provided',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // ── Default 500 ───────────────────────────────────────────────────────
  Sentry.captureException(err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
}
