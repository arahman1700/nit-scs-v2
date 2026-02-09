import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getDataSource, listDataSources } from '../services/widget-data.service.js';
import type { QueryConfig } from '../services/widget-data.service.js';

const router = Router();

router.use(authenticate);

// GET /api/widget-data — list available data sources
router.get('/', (_req: Request, res: Response) => {
  sendSuccess(res, { dataSources: listDataSources() });
});

// GET /api/widget-data/* — fetch data from a registered source (e.g. stats/projects)
router.get('/*dataSource', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.params.dataSource;
    const key = Array.isArray(raw) ? raw.join('/') : raw;

    const fn = getDataSource(key);
    if (!fn) {
      sendError(res, 404, `Unknown data source: ${key}`);
      return;
    }

    const config: QueryConfig = {};

    // Parse query params into config
    if (req.query.start && req.query.end) {
      config.dateRange = {
        start: String(req.query.start),
        end: String(req.query.end),
      };
    }
    if (req.query.groupBy) {
      config.groupBy = String(req.query.groupBy);
    }
    if (req.query.limit) {
      config.limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 10), 100);
    }
    if (req.query.filters) {
      try {
        config.filters = JSON.parse(String(req.query.filters));
      } catch {
        // Ignore malformed filter JSON
      }
    }

    const result = await fn(config);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
