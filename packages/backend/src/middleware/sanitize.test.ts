import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from './sanitize.js';

const mockReq = (overrides = {}) => ({ method: 'POST', headers: {}, body: {}, ...overrides }) as unknown as Request;

const mockRes = () => {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    locals: {},
  } as unknown as Response;
};

describe('sanitize middleware', () => {
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn();
    vi.clearAllMocks();
  });

  it('should call next() after sanitizing', () => {
    const middleware = sanitizeInput();
    const req = mockReq({ body: { name: 'Clean' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
  });

  it('should strip HTML tags from string values', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: { name: '<script>alert("xss")</script>John' },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.name).not.toContain('<script>');
    expect(req.body.name).not.toContain('</script>');
  });

  it('should strip bold/italic/div tags', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: { note: '<b>bold</b> <i>italic</i> <div>block</div>' },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.note).not.toContain('<b>');
    expect(req.body.note).not.toContain('<i>');
    expect(req.body.note).not.toContain('<div>');
  });

  it('should trim whitespace from strings', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: { name: '  Hello World  ' },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.name).toBe('Hello World');
  });

  it('should handle nested objects', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: {
        address: {
          street: '<em>123 Main St</em>',
          city: '  New York  ',
        },
      },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.address.street).not.toContain('<em>');
    expect(req.body.address.city).toBe('New York');
  });

  it('should handle arrays of strings', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: {
        tags: ['<b>tag1</b>', '<script>alert(1)</script>tag2', '  tag3  '],
      },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.tags[0]).not.toContain('<b>');
    expect(req.body.tags[1]).not.toContain('<script>');
    expect(req.body.tags[2]).toBe('tag3');
  });

  it('should handle arrays of objects', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: {
        items: [
          { name: '<b>Item1</b>', qty: 5 },
          { name: '  Item2  ', qty: 10 },
        ],
      },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.items[0].name).not.toContain('<b>');
    expect(req.body.items[0].qty).toBe(5); // numbers untouched
    expect(req.body.items[1].name).toBe('Item2');
  });

  it('should not modify non-string values (numbers, booleans)', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: { count: 42, active: true, price: 99.5, empty: null },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.price).toBe(99.5);
    expect(req.body.empty).toBeNull();
  });

  it('should skip sanitization for GET requests', () => {
    const middleware = sanitizeInput();
    const req = mockReq({ method: 'GET', body: { name: '<b>test</b>' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    // Body should remain unchanged since GET is skipped
    expect(req.body.name).toBe('<b>test</b>');
    expect(nextFn).toHaveBeenCalledOnce();
  });

  it('should skip sanitization for DELETE requests', () => {
    const middleware = sanitizeInput();
    const req = mockReq({ method: 'DELETE', body: { name: '<b>test</b>' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.name).toBe('<b>test</b>');
  });

  it('should sanitize PUT request bodies', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      method: 'PUT',
      body: { name: '<script>x</script>Safe' },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.name).not.toContain('<script>');
  });

  it('should sanitize PATCH request bodies', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      method: 'PATCH',
      body: { note: '<img onerror="alert(1)">text' },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.note).not.toContain('<img');
  });

  it('should handle empty body', () => {
    const middleware = sanitizeInput();
    const req = mockReq({ body: {} });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body).toEqual({});
    expect(nextFn).toHaveBeenCalledOnce();
  });

  it('should handle null body', () => {
    const middleware = sanitizeInput();
    const req = mockReq({ body: null });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
  });

  it('should handle deeply nested structures', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: {
        level1: {
          level2: {
            level3: {
              value: '<a href="evil">Click</a>',
            },
          },
        },
      },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.level1.level2.level3.value).not.toContain('<a');
  });

  it('should preserve clean strings unchanged', () => {
    const middleware = sanitizeInput();
    const req = mockReq({
      body: { name: 'John Doe', email: 'john@test.com', code: 'AB-123' },
    });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(req.body.name).toBe('John Doe');
    expect(req.body.email).toBe('john@test.com');
    expect(req.body.code).toBe('AB-123');
  });
});
