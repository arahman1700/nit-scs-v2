import type { Request, Response, NextFunction } from 'express';

// ── Mock Prisma — classes must be defined INSIDE the factory because vi.mock is hoisted ──

vi.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    constructor(code: string, meta?: Record<string, unknown>) {
      super('Prisma error');
      this.name = 'PrismaClientKnownRequestError';
      this.code = code;
      this.meta = meta;
    }
  }

  class PrismaClientValidationError extends Error {
    constructor() {
      super('Prisma validation error');
      this.name = 'PrismaClientValidationError';
    }
  }

  return {
    Prisma: {
      PrismaClientKnownRequestError,
      PrismaClientValidationError,
    },
  };
});

vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { Prisma } from '@prisma/client';
import { errorHandler } from './error-handler.js';
import { AppError, RequestValidationError, NotFoundError } from '@nit-scs/shared';

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

const mockNext = vi.fn() as unknown as NextFunction;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NODE_ENV;
});

describe('errorHandler middleware', () => {
  describe('AppError handling', () => {
    it('returns correct statusCode and code for AppError', () => {
      const err = new AppError('Something went wrong', 422, 'BUSINESS_ERROR');
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Something went wrong',
        code: 'BUSINESS_ERROR',
      });
    });

    it('includes details for RequestValidationError', () => {
      const details = { name: 'Name is required', email: 'Invalid email' };
      const err = new RequestValidationError('Validation failed', details);
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: details,
      });
    });

    it('returns 404 for NotFoundError', () => {
      const err = new NotFoundError('User', 'abc-123');
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User with id 'abc-123' not found",
        code: 'NOT_FOUND',
      });
    });
  });

  describe('Prisma error handling', () => {
    it('returns 409 with DUPLICATE_ENTRY for P2002', () => {
      const err = new (Prisma.PrismaClientKnownRequestError as unknown as new (
        code: string,
        meta?: Record<string, unknown>,
      ) => Error)('P2002', { target: ['email'] });
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Duplicate value for email',
        code: 'DUPLICATE_ENTRY',
      });
    });

    it('returns 409 with generic field name when P2002 has no target', () => {
      const err = new (Prisma.PrismaClientKnownRequestError as unknown as new (code: string) => Error)('P2002');
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Duplicate value for field',
          code: 'DUPLICATE_ENTRY',
        }),
      );
    });

    it('returns 404 with NOT_FOUND for P2025', () => {
      const err = new (Prisma.PrismaClientKnownRequestError as unknown as new (code: string) => Error)('P2025');
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Record not found',
        code: 'NOT_FOUND',
      });
    });

    it('returns 400 with FK_VIOLATION for P2003', () => {
      const err = new (Prisma.PrismaClientKnownRequestError as unknown as new (code: string) => Error)('P2003');
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Referenced record does not exist',
        code: 'FK_VIOLATION',
      });
    });

    it('returns 400 for PrismaClientValidationError', () => {
      const err = new (Prisma.PrismaClientValidationError as unknown as new () => Error)();
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid data provided',
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('generic error handling', () => {
    it('returns 500 with INTERNAL_ERROR for generic Error', () => {
      const err = new Error('Something broke');
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Something broke',
        code: 'INTERNAL_ERROR',
      });
    });

    it('hides error message in production', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Sensitive internal details');
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('shows error message in non-production', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('Detailed debug message');
      const req = mockReq();
      const res = mockRes();

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Detailed debug message',
        }),
      );
    });
  });
});
