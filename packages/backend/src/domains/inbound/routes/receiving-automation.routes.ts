/**
 * Receiving Automation Routes — P6
 *
 * GRN → LPN Creation → WMS Task Generation → Putaway Assignment
 */
import { Router } from 'express';
import * as receivingService from '../services/receiving-automation.service.js';
import { NotFoundError } from '@nit-scs-v2/shared';

const router = Router();

// POST /receiving-automation/:grnId/plan — generate receiving plan
router.post('/:grnId/plan', async (req, res) => {
  try {
    const plan = await receivingService.generateReceivingPlan(req.params.grnId);
    res.json(plan);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /receiving-automation/:grnId/execute — execute a full receiving plan
router.post('/:grnId/execute', async (req, res) => {
  try {
    const plan = await receivingService.generateReceivingPlan(req.params.grnId);
    const results = await receivingService.executeReceiving(plan, req.body.createdById);
    res.json({ plan, results });
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /receiving-automation/:grnId/auto-receive — full automation in one call
router.post('/:grnId/auto-receive', async (req, res) => {
  try {
    const result = await receivingService.autoReceiveGrn(req.params.grnId, req.body.createdById);
    res.json(result);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: (err as Error).message });
  }
});

// GET /receiving-automation/asn/:asnId/duties — calculate ASN customs duties
router.get('/asn/:asnId/duties', async (req, res) => {
  try {
    const duties = await receivingService.calculateAsnDuties(req.params.asnId);
    res.json(duties);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to calculate duties' });
  }
});

export default router;
