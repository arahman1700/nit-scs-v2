import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  RequestValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  BusinessRuleError,
  RateLimitError,
} from './errors.js';

// ── AppError ────────────────────────────────────────────────────────────

describe('AppError', () => {
  it('sets message, statusCode, and code', () => {
    const err = new AppError('Something went wrong', 500, 'INTERNAL');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL');
  });

  it('isOperational defaults to true', () => {
    const err = new AppError('test', 500, 'TEST');
    expect(err.isOperational).toBe(true);
  });

  it('is an instance of Error', () => {
    const err = new AppError('test', 500, 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct name', () => {
    const err = new AppError('test', 500, 'TEST');
    expect(err.name).toBe('AppError');
  });

  it('has a stack trace', () => {
    const err = new AppError('test', 500, 'TEST');
    expect(err.stack).toBeDefined();
  });
});

// ── NotFoundError ───────────────────────────────────────────────────────

describe('NotFoundError', () => {
  it('has default message', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Resource not found');
  });

  it('formats message with resource name', () => {
    const err = new NotFoundError('User');
    expect(err.message).toBe('User not found');
  });

  it('formats message with resource and id', () => {
    const err = new NotFoundError('User', '123');
    expect(err.message).toBe("User with id '123' not found");
  });

  it('has statusCode 404', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it('has code NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.code).toBe('NOT_FOUND');
  });

  it('extends AppError', () => {
    const err = new NotFoundError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });
});

// ── RequestValidationError ──────────────────────────────────────────────

describe('RequestValidationError', () => {
  it('has statusCode 400', () => {
    const err = new RequestValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
  });

  it('has code VALIDATION_ERROR', () => {
    const err = new RequestValidationError('Invalid input');
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('stores details', () => {
    const details = { name: 'Name is required', email: 'Invalid email' };
    const err = new RequestValidationError('Validation failed', details);
    expect(err.details).toEqual(details);
  });

  it('details is undefined when not provided', () => {
    const err = new RequestValidationError('Validation failed');
    expect(err.details).toBeUndefined();
  });

  it('extends AppError', () => {
    const err = new RequestValidationError('test');
    expect(err).toBeInstanceOf(AppError);
  });
});

// ── AuthenticationError ─────────────────────────────────────────────────

describe('AuthenticationError', () => {
  it('has default message', () => {
    const err = new AuthenticationError();
    expect(err.message).toBe('Authentication required');
  });

  it('accepts custom message', () => {
    const err = new AuthenticationError('Token expired');
    expect(err.message).toBe('Token expired');
  });

  it('has statusCode 401', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
  });

  it('has code AUTHENTICATION_ERROR', () => {
    const err = new AuthenticationError();
    expect(err.code).toBe('AUTHENTICATION_ERROR');
  });

  it('extends AppError', () => {
    const err = new AuthenticationError();
    expect(err).toBeInstanceOf(AppError);
  });
});

// ── AuthorizationError ──────────────────────────────────────────────────

describe('AuthorizationError', () => {
  it('has default message', () => {
    const err = new AuthorizationError();
    expect(err.message).toBe('Insufficient permissions');
  });

  it('accepts custom message', () => {
    const err = new AuthorizationError('Admin role required');
    expect(err.message).toBe('Admin role required');
  });

  it('has statusCode 403', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
  });

  it('has code AUTHORIZATION_ERROR', () => {
    const err = new AuthorizationError();
    expect(err.code).toBe('AUTHORIZATION_ERROR');
  });

  it('extends AppError', () => {
    const err = new AuthorizationError();
    expect(err).toBeInstanceOf(AppError);
  });
});

// ── ConflictError ───────────────────────────────────────────────────────

describe('ConflictError', () => {
  it('has statusCode 409', () => {
    const err = new ConflictError('Duplicate entry');
    expect(err.statusCode).toBe(409);
  });

  it('has code CONFLICT', () => {
    const err = new ConflictError('Duplicate entry');
    expect(err.code).toBe('CONFLICT');
  });

  it('sets the message', () => {
    const err = new ConflictError('Resource already exists');
    expect(err.message).toBe('Resource already exists');
  });

  it('extends AppError', () => {
    const err = new ConflictError('test');
    expect(err).toBeInstanceOf(AppError);
  });
});

// ── BusinessRuleError ───────────────────────────────────────────────────

describe('BusinessRuleError', () => {
  it('has statusCode 422', () => {
    const err = new BusinessRuleError('Cannot exceed budget');
    expect(err.statusCode).toBe(422);
  });

  it('has code BUSINESS_RULE_VIOLATION', () => {
    const err = new BusinessRuleError('Cannot exceed budget');
    expect(err.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('sets the message', () => {
    const err = new BusinessRuleError('Insufficient stock');
    expect(err.message).toBe('Insufficient stock');
  });

  it('extends AppError', () => {
    const err = new BusinessRuleError('test');
    expect(err).toBeInstanceOf(AppError);
  });
});

// ── RateLimitError ──────────────────────────────────────────────────────

describe('RateLimitError', () => {
  it('has default message', () => {
    const err = new RateLimitError();
    expect(err.message).toBe('Too many requests');
  });

  it('accepts custom message', () => {
    const err = new RateLimitError('Slow down');
    expect(err.message).toBe('Slow down');
  });

  it('has statusCode 429', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
  });

  it('has code RATE_LIMIT_EXCEEDED', () => {
    const err = new RateLimitError();
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('extends AppError', () => {
    const err = new RateLimitError();
    expect(err).toBeInstanceOf(AppError);
  });
});

// ── Cross-cutting instanceof checks ────────────────────────────────────

describe('instanceof chain', () => {
  const errors = [
    new NotFoundError(),
    new RequestValidationError('test'),
    new AuthenticationError(),
    new AuthorizationError(),
    new ConflictError('test'),
    new BusinessRuleError('test'),
    new RateLimitError(),
  ];

  it('all subclasses are instanceof AppError', () => {
    for (const err of errors) {
      expect(err).toBeInstanceOf(AppError);
    }
  });

  it('all subclasses are instanceof Error', () => {
    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('all subclasses have isOperational = true', () => {
    for (const err of errors) {
      expect(err.isOperational).toBe(true);
    }
  });
});
