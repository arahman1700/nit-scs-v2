import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

interface CachedRule {
  id: string;
  workflowId: string;
  name: string;
  triggerEvent: string;
  conditions: unknown;
  actions: unknown;
  stopOnMatch: boolean;
  sortOrder: number;
  workflow: {
    id: string;
    entityType: string;
    priority: number;
  };
}

let cache: CachedRule[] = [];
let lastFetch = 0;
const TTL_MS = 60_000; // 60 seconds

/**
 * Get all active rules, cached with a 60s TTL.
 * Rules are pre-sorted by workflow priority (desc) then rule sortOrder (asc).
 */
export async function getActiveRules(): Promise<CachedRule[]> {
  const now = Date.now();
  if (now - lastFetch < TTL_MS && cache.length > 0) {
    return cache;
  }

  try {
    const rules = await prisma.workflowRule.findMany({
      where: {
        isActive: true,
        workflow: { isActive: true },
      },
      include: {
        workflow: {
          select: { id: true, entityType: true, priority: true },
        },
      },
      orderBy: [{ workflow: { priority: 'desc' } }, { sortOrder: 'asc' }],
    });

    cache = rules;
    lastFetch = now;
    log('debug', `[RuleCache] Refreshed: ${rules.length} active rules`);
    return cache;
  } catch (err) {
    log('error', `[RuleCache] Failed to refresh: ${err}`);
    // Return stale cache on error rather than breaking
    return cache;
  }
}

/**
 * Invalidate the cache — call this when workflows or rules are created/updated/deleted.
 */
export function invalidateRuleCache(): void {
  lastFetch = 0;
  cache = [];
  log('debug', '[RuleCache] Invalidated');
}
