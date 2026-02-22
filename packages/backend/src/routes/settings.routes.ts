import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import { sendSuccess } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';
import {
  getAllSlaHours,
  upsertSettings,
  invalidateConfigCache,
  getDocPrefix,
  getThreshold,
} from '../services/system-config.service.js';
import { DOC_PREFIXES, SLA_HOURS } from '@nit-scs-v2/shared/constants';

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

// PUT /api/settings — upsert global settings (requires settings update permission)
router.put('/', authenticate, requirePermission('settings', 'update'), async (req, res, next) => {
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

// ── Admin: SLA Configuration ─────────────────────────────────────────────

// GET /api/settings/sla — returns all SLA hours (merged DB + defaults)
router.get('/sla', authenticate, requirePermission('settings', 'read'), async (_req, res, next) => {
  try {
    const sla = await getAllSlaHours();
    sendSuccess(res, sla);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/sla — update SLA hours (requires settings update permission)
router.put('/sla', authenticate, requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const entries: Array<{ key: string; value: string; category: string }> = [];
    for (const [key, value] of Object.entries(body)) {
      const num = Number(value);
      if (!isNaN(num) && num > 0) {
        entries.push({ key, value: String(num), category: 'sla' });
      }
    }
    if (entries.length > 0) {
      await upsertSettings(entries);
    }
    const sla = await getAllSlaHours();
    sendSuccess(res, sla);
  } catch (err) {
    next(err);
  }
});

// ── Admin: Document Prefix Configuration ─────────────────────────────────

// GET /api/settings/doc-prefixes — returns all document prefixes (merged DB + defaults)
router.get('/doc-prefixes', authenticate, requirePermission('settings', 'read'), async (_req, res, next) => {
  try {
    const prefixes: Record<string, string> = {};
    for (const docType of Object.keys(DOC_PREFIXES)) {
      prefixes[docType] = await getDocPrefix(docType);
    }
    sendSuccess(res, prefixes);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/doc-prefixes — update document prefixes (requires settings update)
router.put('/doc-prefixes', authenticate, requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const entries: Array<{ key: string; value: string; category: string }> = [];
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' && value.length > 0 && value.length <= 10) {
        entries.push({ key, value: value.toUpperCase(), category: 'doc_prefix' });
      }
    }
    if (entries.length > 0) {
      await upsertSettings(entries);
    }
    // Return merged result
    const prefixes: Record<string, string> = {};
    invalidateConfigCache('doc_prefix');
    for (const docType of Object.keys(DOC_PREFIXES)) {
      prefixes[docType] = await getDocPrefix(docType);
    }
    sendSuccess(res, prefixes);
  } catch (err) {
    next(err);
  }
});

// ── Admin: Threshold Configuration ───────────────────────────────────────

// GET /api/settings/thresholds — returns key thresholds
router.get('/thresholds', authenticate, requirePermission('settings', 'read'), async (_req, res, next) => {
  try {
    const thresholds: Record<string, number> = {
      insurance_threshold_sar: await getThreshold('insurance_threshold_sar'),
      over_delivery_tolerance: await getThreshold('over_delivery_tolerance'),
      backdate_limit_days: await getThreshold('backdate_limit_days'),
    };
    sendSuccess(res, thresholds);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/thresholds — update thresholds (requires settings update)
router.put('/thresholds', authenticate, requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const entries: Array<{ key: string; value: string; category: string }> = [];
    for (const [key, value] of Object.entries(body)) {
      const num = Number(value);
      if (!isNaN(num) && num >= 0) {
        entries.push({ key, value: String(num), category: 'threshold' });
      }
    }
    if (entries.length > 0) {
      await upsertSettings(entries);
    }
    const thresholds: Record<string, number> = {
      insurance_threshold_sar: await getThreshold('insurance_threshold_sar'),
      over_delivery_tolerance: await getThreshold('over_delivery_tolerance'),
      backdate_limit_days: await getThreshold('backdate_limit_days'),
    };
    sendSuccess(res, thresholds);
  } catch (err) {
    next(err);
  }
});

export default router;
