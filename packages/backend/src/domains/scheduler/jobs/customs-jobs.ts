/**
 * Customs Jobs — expiry warning detection for customs documents.
 *
 * Self-registers one job:
 * - customs_expiry: every 24h (lock: 23h)
 *
 * Checks for customs documents expiring in 7, 3, and 1 days and
 * publishes `customs:document_expiring` events for each.
 */

import { registerJob } from '../../../utils/job-registry.js';
import type { JobContext } from '../../../utils/job-registry.js';
import { eventBus } from '../../../events/event-bus.js';

// ── Customs Expiry Check ─────────────────────────────────────────────────

export async function checkCustomsExpiry(ctx: JobContext): Promise<void> {
  try {
    const now = new Date();
    const checkWindows = [
      { daysUntilExpiry: 7, label: '7 days' },
      { daysUntilExpiry: 3, label: '3 days' },
      { daysUntilExpiry: 1, label: '1 day' },
    ];

    let totalPublished = 0;

    for (const window of checkWindows) {
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + window.daysUntilExpiry);
      windowStart.setHours(0, 0, 0, 0);

      const windowEnd = new Date(windowStart);
      windowEnd.setHours(23, 59, 59, 999);

      const expiringDocs = await ctx.prisma.customsDocument.findMany({
        where: {
          status: { in: ['pending', 'received', 'verified'] },
          expiryDate: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
        select: {
          id: true,
          documentType: true,
          shipmentId: true,
          expiryDate: true,
          documentNumber: true,
        },
      });

      for (const doc of expiringDocs) {
        // Avoid duplicate notifications within 23 hours
        const recentlyNotified = await ctx.hasRecentNotification(
          'customs_document',
          doc.id,
          `Customs Document Expiring`,
          new Date(now.getTime() - 23 * 60 * 60 * 1000),
        );
        if (recentlyNotified) continue;

        eventBus.publish({
          type: 'customs:document_expiring',
          entityType: 'customs_document',
          entityId: doc.id,
          action: 'expiry_warning',
          payload: {
            daysUntilExpiry: window.daysUntilExpiry,
            documentType: doc.documentType,
            shipmentId: doc.shipmentId,
            expiryDate: doc.expiryDate?.toISOString() ?? null,
            documentNumber: doc.documentNumber ?? null,
          },
          timestamp: now.toISOString(),
        });

        totalPublished++;
      }
    }

    if (totalPublished > 0) {
      ctx.log('info', `[Scheduler] Customs expiry: published ${totalPublished} document_expiring event(s)`);
    }
  } catch (err) {
    ctx.log('error', `[Scheduler] Customs expiry check failed: ${(err as Error).message}`);
  }
}

// ── Register Job ──────────────────────────────────────────────────────────

// Customs document expiry check — every 24 hours (lock: 23 hours)
registerJob({
  name: 'customs_expiry',
  intervalMs: 24 * 60 * 60 * 1000,
  lockTtlSec: 82800,
  handler: checkCustomsExpiry,
});
