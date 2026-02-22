import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import * as laborStandardService from '../services/labor-standard.service.js';

const router = Router();

router.use(authenticate);

// GET /labor/standards
router.get('/standards', async (_req, res, next) => {
  try {
    const standards = await laborStandardService.listStandards();
    res.json({ data: standards });
  } catch (err) {
    next(err);
  }
});

// PUT /labor/standards/:taskType
router.put('/standards/:taskType', requirePermission('labor', 'update'), async (req, res, next) => {
  try {
    const taskType = req.params.taskType as string;
    const { standardMinutes, description, unitOfMeasure } = req.body;
    const standard = await laborStandardService.upsertStandard(taskType, standardMinutes, description, unitOfMeasure);
    res.json({ data: standard });
  } catch (err) {
    next(err);
  }
});

// GET /labor/performance
router.get('/performance', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const warehouseId = req.query.warehouseId as string | undefined;
    const report = await laborStandardService.getPerformanceReport(days, warehouseId);
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
});

export default router;
