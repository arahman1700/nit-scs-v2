/**
 * Carrier Service Routes — P6
 */
import { Router } from 'express';
import * as carrierService from '../services/carrier.service.js';
import { NotFoundError } from '@nit-scs-v2/shared';

const router = Router();

// GET /carriers — list
router.get('/', async (req, res) => {
  try {
    const result = await carrierService.getCarriers({
      mode: req.query.mode as string,
      isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      carrierName: req.query.carrierName as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch carriers' });
  }
});

// GET /carriers/best-rate — find best carrier for mode
router.get('/best-rate', async (req, res) => {
  try {
    const { mode, weightKg } = req.query;
    if (!mode) return res.status(400).json({ error: 'mode query parameter required' });
    const rates = await carrierService.findBestRate(mode as string, weightKg ? Number(weightKg) : undefined);
    res.json({ rates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to find rates' });
  }
});

// GET /carriers/:id
router.get('/:id', async (req, res) => {
  try {
    const carrier = await carrierService.getCarrierById(req.params.id);
    res.json(carrier);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch carrier' });
  }
});

// POST /carriers
router.post('/', async (req, res) => {
  try {
    const carrier = await carrierService.createCarrier(req.body);
    res.status(201).json(carrier);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Service code already exists' });
    res.status(400).json({ error: err.message || 'Failed to create carrier' });
  }
});

// PUT /carriers/:id
router.put('/:id', async (req, res) => {
  try {
    const carrier = await carrierService.updateCarrier(req.params.id, req.body);
    res.json(carrier);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: (err as Error).message });
  }
});

// DELETE /carriers/:id
router.delete('/:id', async (req, res) => {
  try {
    await carrierService.deleteCarrier(req.params.id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete carrier' });
  }
});

export default router;
