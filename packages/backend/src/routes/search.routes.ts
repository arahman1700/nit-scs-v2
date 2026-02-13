// ---------------------------------------------------------------------------
// Global Search Routes — GET /search?q=...&types=grn,mi&limit=20
// ---------------------------------------------------------------------------

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { globalSearch } from '../services/search.service.js';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string;
    if (!q || q.length < 2) {
      sendError(res, 400, 'Query must be at least 2 characters');
      return;
    }
    const types = req.query.types ? (req.query.types as string).split(',') : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const results = await globalSearch(q, { types, limit });
    sendSuccess(res, results);
  } catch (err) {
    next(err);
  }
});

export default router;
