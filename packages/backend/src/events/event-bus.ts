import { EventEmitter } from 'events';
import { z } from 'zod';
import { log } from '../config/logger.js';
import { eventBusEventsTotal } from '../infrastructure/metrics/prometheus.js';
import { trackDocumentOperation } from '../infrastructure/metrics/business-metrics.js';

/**
 * Typed event payload that flows through the system event bus.
 * Every domain action (auditAndEmit, approval, inventory) publishes one of these.
 */
export interface SystemEvent {
  /** Event type from the catalog (e.g. 'document:status_changed') */
  type: string;
  /** Entity/document type (e.g. 'mirv', 'jo', 'mrrv') */
  entityType: string;
  /** Primary key of the affected record */
  entityId: string;
  /** Action verb (e.g. 'create', 'update', 'status_change', 'approve') */
  action: string;
  /** Arbitrary payload — old/new values, amounts, etc. */
  payload: Record<string, unknown>;
  /** Employee ID who performed the action (may be undefined for system-generated events) */
  performedById?: string;
  /** ISO timestamp */
  timestamp: string;
}

const systemEventSchema = z.object({
  type: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.string().min(1),
  payload: z.record(z.unknown()),
  performedById: z.string().optional(),
  timestamp: z.string(),
});

// ── EventBus Instrumentation ──────────────────────────────────────────────────

export interface EventErrorEntry {
  type: string;
  message: string;
  timestamp: string;
}

export interface EventStats {
  totalPublished: number;
  publishedByType: Record<string, number>;
  errors: EventErrorEntry[];
  lastPublished: string | null;
}

const MAX_ERROR_ENTRIES = 100;

const stats: EventStats = {
  totalPublished: 0,
  publishedByType: {},
  errors: [],
  lastPublished: null,
};

/** Returns a snapshot of the current EventBus statistics. */
export function getEventBusStats(): EventStats {
  return { ...stats, publishedByType: { ...stats.publishedByType }, errors: [...stats.errors] };
}

/** Record an error that occurred while processing an event. Keeps the last 100 entries. */
export function recordEventError(type: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  stats.errors.push({ type, message, timestamp: new Date().toISOString() });
  if (stats.errors.length > MAX_ERROR_ENTRIES) {
    stats.errors = stats.errors.slice(-MAX_ERROR_ENTRIES);
  }
}

// ── EventBus Class ────────────────────────────────────────────────────────────

class SystemEventBus extends EventEmitter {
  private static instance: SystemEventBus;

  private constructor() {
    super();
    // Increase limit — we may have many rule listeners
    this.setMaxListeners(100);
  }

  static getInstance(): SystemEventBus {
    if (!SystemEventBus.instance) {
      SystemEventBus.instance = new SystemEventBus();
    }
    return SystemEventBus.instance;
  }

  /**
   * Publish a system event. Emits both the specific event type
   * and a wildcard '*' event (used by the rule engine).
   * Validates the event shape with Zod; logs a warning if malformed but still publishes.
   */
  publish(event: SystemEvent): void {
    const result = systemEventSchema.safeParse(event);
    if (!result.success) {
      log('warn', `[EventBus] Malformed event: ${result.error.issues.map(i => i.message).join(', ')}`, {
        eventType: event.type,
        entityType: event.entityType,
      });
    }
    // Instrumentation: track stats
    stats.totalPublished++;
    stats.publishedByType[event.type] = (stats.publishedByType[event.type] ?? 0) + 1;
    stats.lastPublished = event.timestamp;

    log('debug', `[EventBus] ${event.type} — ${event.entityType}:${event.entityId}`);
    eventBusEventsTotal.inc({ event_type: event.type });

    // Track document-level business metrics
    if (event.action === 'create' || event.action === 'approve' || event.action === 'status_change') {
      trackDocumentOperation(event.entityType, event.action);
    }

    this.emit(event.type, event);
    this.emit('*', event);
  }
}

/** Singleton event bus — import this everywhere */
export const eventBus = SystemEventBus.getInstance();
