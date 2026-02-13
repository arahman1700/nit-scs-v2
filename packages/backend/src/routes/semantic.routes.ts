import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listMeasures,
  listDimensions,
  getMeasureCatalog,
  getCompatibleDimensions,
  executeSemanticQuery,
} from '../services/semantic-layer.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /measures — List measures with optional category filter
router.get('/measures', async (req, res, next) => {
  try {
    const category = req.query.category as string | undefined;
    const measures = await listMeasures(category);
    res.json({ success: true, data: measures });
  } catch (err) {
    next(err);
  }
});

// GET /dimensions — List dimensions with optional entityType filter
router.get('/dimensions', async (req, res, next) => {
  try {
    const entityType = req.query.entityType as string | undefined;
    const dimensions = await listDimensions(entityType);
    res.json({ success: true, data: dimensions });
  } catch (err) {
    next(err);
  }
});

// GET /catalog — Get measures grouped by category
router.get('/catalog', async (req, res, next) => {
  try {
    const catalog = await getMeasureCatalog();
    res.json({ success: true, data: catalog });
  } catch (err) {
    next(err);
  }
});

// GET /measures/:key/dimensions — Get compatible dimensions for a measure
router.get('/measures/:key/dimensions', async (req, res, next) => {
  try {
    const dimensions = await getCompatibleDimensions(req.params.key as string);
    res.json({ success: true, data: dimensions });
  } catch (err) {
    next(err);
  }
});

// POST /query — Execute a semantic query
router.post('/query', async (req, res, next) => {
  try {
    const result = await executeSemanticQuery(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
