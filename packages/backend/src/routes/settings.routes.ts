import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';

const router = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  vatRate: '15',
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  dateFormat: 'DD/MM/YYYY',
  overDeliveryTolerance: '10',
  backdateLimit: '7',
};

// GET /api/settings — returns all global settings merged with per-user overrides
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const rows = await prisma.systemSetting.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
      },
      orderBy: { updatedAt: 'asc' },
    });

    // Merge: defaults → global (userId=null) → per-user overrides
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings — upsert global settings (admin/manager only)
router.put('/', authenticate, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const entries = Object.entries(body).filter(
      ([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
    );

    for (const [key, value] of entries) {
      // Find existing global setting (userId IS NULL)
      const existing = await prisma.systemSetting.findFirst({
        where: { key, userId: null },
      });

      if (existing) {
        await prisma.systemSetting.update({
          where: { id: existing.id },
          data: { value: String(value) },
        });
      } else {
        await prisma.systemSetting.create({
          data: { key, value: String(value), category: 'general' },
        });
      }
    }

    // Return merged result
    const all = await prisma.systemSetting.findMany({ where: { userId: null } });
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of all) {
      settings[row.key] = row.value;
    }

    sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/user — upsert per-user preference overrides
router.put('/user', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = req.body as Record<string, unknown>;
    const entries = Object.entries(body).filter(
      ([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
    );

    for (const [key, value] of entries) {
      const existing = await prisma.systemSetting.findFirst({
        where: { key, userId },
      });

      if (existing) {
        await prisma.systemSetting.update({
          where: { id: existing.id },
          data: { value: String(value) },
        });
      } else {
        await prisma.systemSetting.create({
          data: { key, value: String(value), userId, category: 'user_preference' },
        });
      }
    }

    sendSuccess(res, { updated: entries.length });
  } catch (err) {
    next(err);
  }
});

export default router;
