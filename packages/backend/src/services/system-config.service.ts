/**
 * System Configuration Service
 * Provides cached DB-backed configuration with hardcoded fallbacks.
 * All configurable values (DOC_PREFIXES, SLA_HOURS, thresholds, etc.) can be
 * overridden via the SystemSetting table without code changes.
 *
 * Cache Strategy: 2-minute in-memory TTL per category. Invalidated on write.
 */
import { prisma } from '../utils/prisma.js';
import { DOC_PREFIXES, SLA_HOURS, INSURANCE_THRESHOLD_SAR } from '@nit-scs-v2/shared/constants';
import { log } from '../config/logger.js';

// ── Cache Infrastructure ────────────────────────────────────────────────

interface CacheEntry {
  data: Record<string, string>;
  timestamp: number;
}

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map<string, CacheEntry>();

function isCacheValid(key: string): boolean {
  const entry = cache.get(key);
  return entry !== undefined && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/** Invalidate all or a specific category of cached settings. */
export function invalidateConfigCache(category?: string): void {
  if (category) {
    cache.delete(category);
  } else {
    cache.clear();
  }
  log('info', `[SystemConfig] Cache invalidated${category ? `: ${category}` : ' (all)'}`);
}

// ── Core Fetcher ────────────────────────────────────────────────────────

/**
 * Fetch all global settings for a given category from DB.
 * Returns a flat key→value map.
 */
async function fetchCategory(category: string): Promise<Record<string, string>> {
  if (isCacheValid(category)) return cache.get(category)!.data;

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { category, userId: null },
    });

    const data: Record<string, string> = {};
    for (const row of rows) {
      data[row.key] = row.value;
    }

    cache.set(category, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    log('warn', `[SystemConfig] Failed to fetch category '${category}': ${(err as Error).message}`);
    return cache.get(category)?.data ?? {};
  }
}

// ── Document Number Prefixes ────────────────────────────────────────────

/**
 * Get the document prefix for a given document type.
 * Checks DB first (category='doc_prefix'), falls back to shared constants.
 */
export async function getDocPrefix(documentType: string): Promise<string> {
  const overrides = await fetchCategory('doc_prefix');
  return overrides[documentType] ?? DOC_PREFIXES[documentType] ?? documentType.toUpperCase();
}

/**
 * Get the document number format pattern.
 * Default: '{PREFIX}-{YYYY}-{NNNN}'
 * Configurable via SystemSetting key='doc_number_format'.
 */
export async function getDocNumberFormat(): Promise<string> {
  const config = await fetchCategory('doc_number');
  return config['doc_number_format'] ?? '{PREFIX}-{YYYY}-{NNNN}';
}

/**
 * Get the minimum padding width for sequential numbers.
 * Default: 4 (e.g. 0001)
 */
export async function getDocNumberPadding(): Promise<number> {
  const config = await fetchCategory('doc_number');
  const padding = config['doc_number_padding'];
  return padding ? parseInt(padding, 10) : 4;
}

// ── SLA Configuration ───────────────────────────────────────────────────

/**
 * Get SLA hours for a given SLA key.
 * Checks DB first (category='sla'), falls back to shared constants.
 */
export async function getSlaHours(slaKey: string): Promise<number> {
  const overrides = await fetchCategory('sla');
  if (overrides[slaKey]) {
    const parsed = parseFloat(overrides[slaKey]);
    if (!isNaN(parsed)) return parsed;
  }
  return SLA_HOURS[slaKey] ?? 24; // Default to 24 hours if unknown key
}

/**
 * Get all SLA configurations (merged DB overrides + defaults).
 */
export async function getAllSlaHours(): Promise<Record<string, number>> {
  const overrides = await fetchCategory('sla');
  const merged = { ...SLA_HOURS };
  for (const [key, value] of Object.entries(overrides)) {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) merged[key] = parsed;
  }
  return merged;
}

// ── Threshold Configuration ─────────────────────────────────────────────

/**
 * Get a numeric threshold value.
 * Checks DB first (category='threshold'), falls back to known defaults.
 */
export async function getThreshold(key: string): Promise<number> {
  const overrides = await fetchCategory('threshold');
  if (overrides[key]) {
    const parsed = parseFloat(overrides[key]);
    if (!isNaN(parsed)) return parsed;
  }

  // Known defaults
  const defaults: Record<string, number> = {
    insurance_threshold_sar: INSURANCE_THRESHOLD_SAR,
    over_delivery_tolerance: 10,
    backdate_limit_days: 7,
  };
  return defaults[key] ?? 0;
}

// ── General Settings ────────────────────────────────────────────────────

/**
 * Get a single setting value by key (any category).
 * Checks all categories, returns first match or the provided default.
 */
export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const row = await prisma.systemSetting.findFirst({
      where: { key, userId: null },
    });
    return row?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Get a setting with user-level override support.
 */
export async function getUserSetting(key: string, userId: string, defaultValue: string = ''): Promise<string> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key,
        OR: [{ userId: null }, { userId }],
      },
      orderBy: { updatedAt: 'asc' },
    });

    // Last one wins (user override comes after global due to sort)
    return rows.length > 0 ? rows[rows.length - 1].value : defaultValue;
  } catch {
    return defaultValue;
  }
}

// ── Bulk Write ──────────────────────────────────────────────────────────

/**
 * Upsert a system setting (global, no userId).
 */
export async function upsertSetting(key: string, value: string, category: string = 'general'): Promise<void> {
  const existing = await prisma.systemSetting.findFirst({
    where: { key, userId: null },
  });

  if (existing) {
    await prisma.systemSetting.update({
      where: { id: existing.id },
      data: { value, category },
    });
  } else {
    await prisma.systemSetting.create({
      data: { key, value, category },
    });
  }

  invalidateConfigCache(category);
}

/**
 * Upsert multiple settings atomically.
 */
export async function upsertSettings(entries: Array<{ key: string; value: string; category: string }>): Promise<void> {
  const categories = new Set<string>();

  await prisma.$transaction(async tx => {
    for (const { key, value, category } of entries) {
      categories.add(category);
      const existing = await tx.systemSetting.findFirst({
        where: { key, userId: null },
      });
      if (existing) {
        await tx.systemSetting.update({
          where: { id: existing.id },
          data: { value, category },
        });
      } else {
        await tx.systemSetting.create({
          data: { key, value, category },
        });
      }
    }
  });

  for (const cat of categories) invalidateConfigCache(cat);
}
