import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response.js';

// Express 5: req.query is read-only. Store validated data on res.locals instead.
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      if (source === 'query') {
        res.locals.validatedQuery = data;
      } else if (source === 'params') {
        res.locals.validatedParams = data;
      } else {
        req.body = data;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendError(res, 400, 'Validation failed', errors);
        return;
      }
      next(err);
    }
  };
}
