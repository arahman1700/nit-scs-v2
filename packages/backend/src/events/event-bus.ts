import { EventEmitter } from 'events';
import { log } from '../config/logger.js';

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
   */
  publish(event: SystemEvent): void {
    log('debug', `[EventBus] ${event.type} — ${event.entityType}:${event.entityId}`);
    this.emit(event.type, event);
    this.emit('*', event);
  }
}

/** Singleton event bus — import this everywhere */
export const eventBus = SystemEventBus.getInstance();
