import type { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [], // Strip ALL HTML tags
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape',
};

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeHtml(value.trim(), sanitizeOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = sanitizeValue(val);
  }
  return result;
}

/**
 * Sanitizes all string values in req.body to prevent XSS.
 * Only applies to POST/PUT/PATCH requests with JSON bodies.
 */
export function sanitizeInput() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object' && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.body = sanitizeObject(req.body as Record<string, unknown>);
    }
    next();
  };
}
