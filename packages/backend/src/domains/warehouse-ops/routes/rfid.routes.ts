/**
 * RFID Tag Routes — P6
 */
import { Router } from 'express';
import * as rfidService from '../services/rfid.service.js';
import { NotFoundError } from '@nit-scs-v2/shared';

const router = Router();

// GET /rfid — list tags
router.get('/', async (req, res) => {
  try {
    const result = await rfidService.getTags({
      warehouseId: req.query.warehouseId as string,
      tagType: req.query.tagType as string,
      isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      lpnId: req.query.lpnId as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch RFID tags' });
  }
});

// GET /rfid/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await rfidService.getStats(req.query.warehouseId as string);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch RFID stats' });
  }
});

// GET /rfid/epc/:epc — lookup by EPC
router.get('/epc/:epc', async (req, res) => {
  try {
    const tag = await rfidService.getTagByEpc(req.params.epc);
    res.json(tag);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch tag' });
  }
});

// GET /rfid/:id
router.get('/:id', async (req, res) => {
  try {
    const tag = await rfidService.getTagById(req.params.id);
    res.json(tag);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to fetch tag' });
  }
});

// POST /rfid — register new tag
router.post('/', async (req, res) => {
  try {
    const tag = await rfidService.registerTag(req.body);
    res.status(201).json(tag);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'EPC already registered' });
    res.status(400).json({ error: err.message || 'Failed to register tag' });
  }
});

// POST /rfid/scan — record a single scan event
router.post('/scan', async (req, res) => {
  try {
    const { epc, readerId } = req.body;
    if (!epc || !readerId) return res.status(400).json({ error: 'epc and readerId required' });
    const tag = await rfidService.recordScan(epc, readerId);
    res.json(tag);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /rfid/bulk-scan — process multiple scan events
router.post('/bulk-scan', async (req, res) => {
  try {
    const { scans } = req.body;
    if (!Array.isArray(scans)) return res.status(400).json({ error: 'scans array required' });
    const results = await rfidService.bulkScan(scans);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process bulk scan' });
  }
});

// PATCH /rfid/:id/associate-lpn — link tag to LPN
router.patch('/:id/associate-lpn', async (req, res) => {
  try {
    const { lpnId } = req.body;
    if (!lpnId) return res.status(400).json({ error: 'lpnId required' });
    const tag = await rfidService.associateWithLpn(req.params.id, lpnId);
    res.json(tag);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(400).json({ error: (err as Error).message });
  }
});

// PATCH /rfid/:id/deactivate
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const tag = await rfidService.deactivate(req.params.id);
    res.json(tag);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to deactivate tag' });
  }
});

export default router;
