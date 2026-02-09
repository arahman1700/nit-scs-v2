import type { Request } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { emitToDocument, emitToAll } from '../socket/setup.js';
import { createAuditLog, type AuditEntry } from '../services/audit.service.js';
import { clientIp } from './helpers.js';
import { eventBus } from '../events/event-bus.js';

/**
 * Emit standardized socket events for a document status change.
 * Emits both a document-specific event and the generic `document:status` event.
 */
export function emitDocumentEvent(
  req: Request,
  docType: string,
  docId: string,
  event: string,
  data: Record<string, unknown>,
): void {
  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;
  emitToDocument(io, docId, event, { id: docId, ...data });
  emitToAll(io, 'document:status', { documentType: docType, documentId: docId, ...data });
}

/**
 * Emit a generic entity event (entity:created / entity:updated / entity:deleted).
 */
export function emitEntityEvent(
  req: Request,
  action: 'created' | 'updated' | 'deleted',
  entity: string,
  extra?: Record<string, unknown>,
): void {
  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;
  emitToAll(io, `entity:${action}`, { entity, ...extra });
}

/**
 * Create an audit log entry and emit socket events in one call.
 * Combines the repeated audit + socket pattern found in every route handler.
 */
export async function auditAndEmit(
  req: Request,
  params: {
    action: AuditEntry['action'];
    tableName: string;
    recordId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    /** Optional: emit a document-level socket event (e.g. 'mrrv:submitted') */
    socketEvent?: string;
    /** Optional: document type for document:status event (e.g. 'mrrv') */
    docType?: string;
    /** Optional: extra data merged into the socket event payload */
    socketData?: Record<string, unknown>;
    /** Optional: emit entity event (entity:created / entity:updated) */
    entityEvent?: 'created' | 'updated' | 'deleted';
    /** Entity name for entity event (e.g. 'mrrv') */
    entityName?: string;
  },
): Promise<void> {
  // Create audit log
  await createAuditLog({
    tableName: params.tableName,
    recordId: params.recordId,
    action: params.action,
    oldValues: params.oldValues,
    newValues: params.newValues,
    performedById: req.user!.userId,
    ipAddress: clientIp(req),
  });

  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;

  // Emit document-specific event
  if (params.socketEvent && params.docType) {
    emitToDocument(io, params.recordId, params.socketEvent, {
      id: params.recordId,
      ...params.socketData,
    });
    emitToAll(io, 'document:status', {
      documentType: params.docType,
      documentId: params.recordId,
      ...params.socketData,
    });
  }

  // Emit generic entity event
  if (params.entityEvent && params.entityName) {
    emitToAll(io, `entity:${params.entityEvent}`, { entity: params.entityName });
  }

  // Publish to system event bus (consumed by workflow rule engine)
  const eventType = params.socketEvent ? `document:status_changed` : `document:${params.action}`;
  eventBus.publish({
    type: eventType,
    entityType: params.docType || params.tableName,
    entityId: params.recordId,
    action: params.action,
    payload: { oldValues: params.oldValues, newValues: params.newValues, ...params.socketData },
    performedById: req.user!.userId,
    timestamp: new Date().toISOString(),
  });
}
