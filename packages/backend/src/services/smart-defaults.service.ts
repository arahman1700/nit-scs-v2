/**
 * Smart Defaults Service
 * Tracks user activity and provides intelligent default suggestions based on
 * historical patterns. Uses audit log data to learn user preferences.
 *
 * Features:
 * - Most-used warehouse/project/supplier per user
 * - Recently used items
 * - Suggested line items based on MR → MI patterns
 */
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── In-Memory Cache (per user, 10 min TTL) ─────────────────────────────

interface UserDefaults {
  warehouses: Array<{ id: string; name: string; count: number }>;
  projects: Array<{ id: string; name: string; count: number }>;
  suppliers: Array<{ id: string; name: string; count: number }>;
  recentItems: Array<{ id: string; code: string; description: string; lastUsed: Date }>;
}

const defaultsCache = new Map<string, { data: UserDefaults; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedDefaults(userId: string): UserDefaults | null {
  const entry = defaultsCache.get(userId);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.data;
  return null;
}

// ── Most-Used Warehouses ────────────────────────────────────────────────

async function getMostUsedWarehouses(userId: string, limit = 5) {
  try {
    const results = await prisma.$queryRaw<Array<{ id: string; warehouseName: string; usage_count: bigint }>>`
      SELECT w.id, w."warehouseName", COUNT(*)::bigint AS usage_count
      FROM audit_log al
      JOIN warehouses w ON (al.new_values->>'warehouseId') = w.id::text
      WHERE al.performed_by_id = ${userId}::uuid
        AND al.action = 'create'
        AND al.new_values->>'warehouseId' IS NOT NULL
        AND al.performed_at > NOW() - INTERVAL '90 days'
      GROUP BY w.id, w."warehouseName"
      ORDER BY usage_count DESC
      LIMIT ${limit}
    `;
    return results.map(r => ({
      id: r.id,
      name: r.warehouseName,
      count: Number(r.usage_count),
    }));
  } catch (err) {
    log('warn', `[SmartDefaults] Failed to get warehouses for ${userId}: ${(err as Error).message}`);
    return [];
  }
}

// ── Most-Used Projects ──────────────────────────────────────────────────

async function getMostUsedProjects(userId: string, limit = 5) {
  try {
    const results = await prisma.$queryRaw<Array<{ id: string; projectName: string; usage_count: bigint }>>`
      SELECT p.id, p."projectName", COUNT(*)::bigint AS usage_count
      FROM audit_log al
      JOIN projects p ON (al.new_values->>'projectId') = p.id::text
      WHERE al.performed_by_id = ${userId}::uuid
        AND al.action = 'create'
        AND al.new_values->>'projectId' IS NOT NULL
        AND al.performed_at > NOW() - INTERVAL '90 days'
      GROUP BY p.id, p."projectName"
      ORDER BY usage_count DESC
      LIMIT ${limit}
    `;
    return results.map(r => ({
      id: r.id,
      name: r.projectName,
      count: Number(r.usage_count),
    }));
  } catch (err) {
    log('warn', `[SmartDefaults] Failed to get projects for ${userId}: ${(err as Error).message}`);
    return [];
  }
}

// ── Most-Used Suppliers ─────────────────────────────────────────────────

async function getMostUsedSuppliers(userId: string, limit = 5) {
  try {
    const results = await prisma.$queryRaw<Array<{ id: string; supplierName: string; usage_count: bigint }>>`
      SELECT s.id, s."supplierName", COUNT(*)::bigint AS usage_count
      FROM audit_log al
      JOIN suppliers s ON (al.new_values->>'supplierId') = s.id::text
      WHERE al.performed_by_id = ${userId}::uuid
        AND al.action = 'create'
        AND al.new_values->>'supplierId' IS NOT NULL
        AND al.performed_at > NOW() - INTERVAL '90 days'
      GROUP BY s.id, s."supplierName"
      ORDER BY usage_count DESC
      LIMIT ${limit}
    `;
    return results.map(r => ({
      id: r.id,
      name: r.supplierName,
      count: Number(r.usage_count),
    }));
  } catch (err) {
    log('warn', `[SmartDefaults] Failed to get suppliers for ${userId}: ${(err as Error).message}`);
    return [];
  }
}

// ── Recently Used Items ─────────────────────────────────────────────────

async function getRecentItems(userId: string, limit = 10) {
  try {
    // Find items from recent MR/MI/GRN line items
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        itemCode: string;
        itemDescription: string;
        last_used: Date;
      }>
    >`
      SELECT DISTINCT ON (i.id) i.id, i."itemCode", i."itemDescription",
        GREATEST(
          (SELECT MAX(ml."createdAt") FROM mrf_lines ml WHERE ml."itemId" = i.id),
          (SELECT MAX(il."createdAt") FROM mirv_lines il WHERE il."itemId" = i.id),
          (SELECT MAX(gl."createdAt") FROM mrrv_lines gl WHERE gl."itemId" = i.id)
        ) AS last_used
      FROM items i
      WHERE i.id IN (
        SELECT DISTINCT ml."itemId" FROM mrf_lines ml
        JOIN material_requisitions mr ON ml."mrfId" = mr.id
        WHERE mr."requestedById" = ${userId}::uuid
          AND mr."createdAt" > NOW() - INTERVAL '90 days'
        UNION
        SELECT DISTINCT il."itemId" FROM mirv_lines il
        JOIN mirv m ON il."mirvId" = m.id
        WHERE m."requestedById" = ${userId}::uuid
          AND m."createdAt" > NOW() - INTERVAL '90 days'
      )
      ORDER BY i.id, last_used DESC NULLS LAST
      LIMIT ${limit}
    `;
    return results.map(r => ({
      id: r.id,
      code: r.itemCode,
      description: r.itemDescription,
      lastUsed: r.last_used,
    }));
  } catch (err) {
    log('warn', `[SmartDefaults] Failed to get recent items for ${userId}: ${(err as Error).message}`);
    return [];
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Get all smart defaults for a user.
 * Cached for 10 minutes per user.
 */
export async function getUserDefaults(userId: string): Promise<UserDefaults> {
  const cached = getCachedDefaults(userId);
  if (cached) return cached;

  const [warehouses, projects, suppliers, recentItems] = await Promise.all([
    getMostUsedWarehouses(userId),
    getMostUsedProjects(userId),
    getMostUsedSuppliers(userId),
    getRecentItems(userId),
  ]);

  const data: UserDefaults = { warehouses, projects, suppliers, recentItems };
  defaultsCache.set(userId, { data, timestamp: Date.now() });
  return data;
}

/**
 * Suggest a default warehouse for a user (their most-used one).
 * Returns null if no history available.
 */
export async function suggestWarehouse(userId: string): Promise<string | null> {
  const defaults = await getUserDefaults(userId);
  return defaults.warehouses[0]?.id ?? null;
}

/**
 * Suggest a default project for a user (their most-used one).
 * Returns null if no history available.
 */
export async function suggestProject(userId: string): Promise<string | null> {
  const defaults = await getUserDefaults(userId);
  return defaults.projects[0]?.id ?? null;
}

/** Clear cached defaults for a user (call after significant actions). */
export function invalidateUserDefaults(userId: string): void {
  defaultsCache.delete(userId);
}
