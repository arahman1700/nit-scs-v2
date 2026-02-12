/**
 * AI Suggestions Service — periodic analysis that generates actionable suggestions
 *
 * Runs every 6 hours. Each engine analyzes a specific area and produces
 * suggestions with optional one-click action payloads.
 */

import { prisma } from '../../utils/prisma.js';
import { logger } from '../../config/logger.js';
import { createHash } from 'crypto';

interface Suggestion {
  suggestionType: string;
  priority: number;
  title: string;
  description: string;
  actionPayload?: unknown;
  fingerprint: string;
  expiresAt: Date;
}

// ── Fingerprint Helper ─────────────────────────────────────────────────

function fingerprint(type: string, key: string): string {
  return createHash('md5').update(`${type}:${key}`).digest('hex');
}

function expiresIn(days: number): Date {
  return new Date(Date.now() + days * 86400_000);
}

// ── Engine: Slow-Moving Inventory ──────────────────────────────────────

async function analyzeSlowMoving(): Promise<Suggestion[]> {
  const rows = await prisma.$queryRaw<
    { item_id: string; item_name: string; warehouse_name: string; qty: number; days_since: number }[]
  >`
    SELECT il.item_id, i.item_name, w.warehouse_name, il.qty_on_hand as qty,
      EXTRACT(DAY FROM NOW() - MAX(lot.received_date))::int as days_since
    FROM inventory_levels il
    JOIN items i ON i.id = il.item_id
    JOIN warehouses w ON w.id = il.warehouse_id
    LEFT JOIN inventory_lots lot ON lot.item_id = il.item_id AND lot.warehouse_id = il.warehouse_id
    WHERE il.qty_on_hand > 0
    GROUP BY il.item_id, i.item_name, w.warehouse_name, il.qty_on_hand
    HAVING MAX(lot.received_date) < NOW() - INTERVAL '90 days'
    ORDER BY EXTRACT(DAY FROM NOW() - MAX(lot.received_date)) DESC
    LIMIT 20
  `;

  return rows.map(r => ({
    suggestionType: 'slow_moving',
    priority: r.days_since > 180 ? 2 : 3,
    title: `Slow-moving: ${r.item_name} in ${r.warehouse_name}`,
    description: `${r.qty} units have been in stock for ${r.days_since} days without movement. Consider transferring or scrapping.`,
    fingerprint: fingerprint('slow_moving', `${r.item_id}`),
    expiresAt: expiresIn(7),
  }));
}

// ── Engine: Pending Approval Delays ────────────────────────────────────

async function analyzeDelays(): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  const stale = await prisma.$queryRaw<
    { doc_type: string; doc_number: string; doc_id: string; days_pending: number }[]
  >`
    SELECT 'MI' as doc_type, mirv_number as doc_number, id as doc_id,
      EXTRACT(DAY FROM NOW() - created_at)::int as days_pending
    FROM mirv WHERE status = 'pending_approval' AND created_at < NOW() - INTERVAL '3 days'
    UNION ALL
    SELECT 'JO', jo_number, id, EXTRACT(DAY FROM NOW() - created_at)::int
    FROM job_orders WHERE status = 'pending_approval' AND created_at < NOW() - INTERVAL '3 days'
    UNION ALL
    SELECT 'GRN', mrrv_number, id, EXTRACT(DAY FROM NOW() - created_at)::int
    FROM mrrv WHERE status = 'pending_approval' AND created_at < NOW() - INTERVAL '3 days'
    ORDER BY days_pending DESC
    LIMIT 15
  `;

  for (const row of stale) {
    suggestions.push({
      suggestionType: 'delay',
      priority: row.days_pending > 7 ? 1 : 2,
      title: `${row.doc_type} ${row.doc_number} pending for ${row.days_pending} days`,
      description: `This document has been waiting for approval for ${row.days_pending} days. Consider following up.`,
      fingerprint: fingerprint('delay', row.doc_id),
      expiresAt: expiresIn(3),
    });
  }

  return suggestions;
}

// ── Engine: Low Stock Alerts ───────────────────────────────────────────

async function analyzeLowStock(): Promise<Suggestion[]> {
  const rows = await prisma.$queryRaw<
    { item_name: string; warehouse_name: string; qty: number; reorder_point: number; item_id: string }[]
  >`
    SELECT i.item_name, w.warehouse_name, il.qty_on_hand as qty, il.reorder_point, il.item_id
    FROM inventory_levels il
    JOIN items i ON i.id = il.item_id
    JOIN warehouses w ON w.id = il.warehouse_id
    WHERE il.reorder_point IS NOT NULL AND il.reorder_point > 0
      AND il.qty_on_hand <= il.reorder_point
    ORDER BY (il.qty_on_hand::float / NULLIF(il.reorder_point, 0)) ASC
    LIMIT 20
  `;

  return rows.map(r => ({
    suggestionType: 'reorder',
    priority: r.qty === 0 ? 1 : 2,
    title: `Low stock: ${r.item_name} in ${r.warehouse_name}`,
    description: `Current qty: ${r.qty}, reorder point: ${r.reorder_point}. Create a Material Request.`,
    actionPayload: { type: 'create_mr', params: { itemId: r.item_id } },
    fingerprint: fingerprint('reorder', r.item_id),
    expiresAt: expiresIn(3),
  }));
}

// ── Engine: SLA Breaches ───────────────────────────────────────────────

async function analyzeSlaBreaches(): Promise<Suggestion[]> {
  const breached = await prisma.$queryRaw<{ doc_type: string; doc_number: string; days_overdue: number }[]>`
    SELECT 'MI' as doc_type, mirv_number as doc_number,
      EXTRACT(DAY FROM NOW() - sla_due_date)::int as days_overdue
    FROM mirv
    WHERE sla_due_date IS NOT NULL AND sla_due_date < NOW()
      AND status NOT IN ('completed', 'issued', 'cancelled', 'rejected')
    LIMIT 10
  `;

  return breached.map(r => ({
    suggestionType: 'sla',
    priority: r.days_overdue > 3 ? 1 : 2,
    title: `SLA breached: ${r.doc_type} ${r.doc_number}`,
    description: `This document is ${r.days_overdue} day(s) past its SLA deadline.`,
    fingerprint: fingerprint('sla', `${r.doc_type}:${r.doc_number}`),
    expiresAt: expiresIn(3),
  }));
}

// ── Runner ─────────────────────────────────────────────────────────────

const ENGINES = [analyzeSlowMoving, analyzeDelays, analyzeLowStock, analyzeSlaBreaches];

export async function generateSuggestions(): Promise<number> {
  logger.info('AI Suggestions: starting analysis...');

  const all: Suggestion[] = [];
  for (const engine of ENGINES) {
    try {
      const results = await engine();
      all.push(...results);
    } catch (err) {
      logger.error({ err }, `AI Suggestions: engine failed`);
    }
  }

  // Upsert suggestions (skip existing fingerprints)
  let created = 0;
  for (const s of all) {
    try {
      await prisma.aiSuggestion.upsert({
        where: { fingerprint: s.fingerprint },
        create: {
          suggestionType: s.suggestionType,
          priority: s.priority,
          title: s.title,
          description: s.description,
          actionPayload: s.actionPayload as object,
          fingerprint: s.fingerprint,
          expiresAt: s.expiresAt,
          status: 'pending',
        },
        update: {
          priority: s.priority,
          title: s.title,
          description: s.description,
          expiresAt: s.expiresAt,
        },
      });
      created++;
    } catch (err) {
      logger.warn({ err, fingerprint: s.fingerprint }, 'AI Suggestions: upsert failed');
    }
  }

  // Clean expired suggestions
  await prisma.aiSuggestion.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  logger.info({ total: all.length, created }, 'AI Suggestions: analysis complete');
  return created;
}

// ── Query ──────────────────────────────────────────────────────────────

export async function listSuggestions(status?: string) {
  return prisma.aiSuggestion.findMany({
    where: status ? { status } : { status: { not: 'dismissed' } },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function dismissSuggestion(id: string) {
  return prisma.aiSuggestion.update({
    where: { id },
    data: { status: 'dismissed' },
  });
}

export async function applySuggestion(id: string) {
  return prisma.aiSuggestion.update({
    where: { id },
    data: { status: 'applied' },
  });
}
