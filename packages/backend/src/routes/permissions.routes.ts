import { Router } from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERMISSIONS_PATH = join(__dirname, '../../data/permissions.json');

// GET /api/permissions — returns custom overrides (or {} for defaults)
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const raw = await readFile(PERMISSIONS_PATH, 'utf-8').catch(() => null);
    sendSuccess(res, raw ? JSON.parse(raw) : {});
  } catch (err) {
    next(err);
  }
});

// PUT /api/permissions — admin-only, saves full permission overrides
router.put('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const dir = dirname(PERMISSIONS_PATH);
    await mkdir(dir, { recursive: true });
    await writeFile(PERMISSIONS_PATH, JSON.stringify(req.body, null, 2));
    sendSuccess(res, req.body);
  } catch (err) {
    next(err);
  }
});

export default router;
