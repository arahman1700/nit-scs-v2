import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateAuditLog, mockEmitToDocument, mockEmitToAll, mockEventBus } = vi.hoisted(() => ({
  mockCreateAuditLog: vi.fn().mockResolvedValue({}),
  mockEmitToDocument: vi.fn(),
  mockEmitToAll: vi.fn(),
  mockEventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));

vi.mock('../services/audit.service.js', () => ({
  createAuditLog: mockCreateAuditLog,
}));
vi.mock('../socket/setup.js', () => ({
  emitToDocument: mockEmitToDocument,
  emitToAll: mockEmitToAll,
}));
vi.mock('../events/event-bus.js', () => ({
  eventBus: mockEventBus,
}));

import { emitDocumentEvent, emitEntityEvent, auditAndEmit } from './routeHelpers.js';

function makeReq(overrides: Record<string, unknown> = {}) {
  const io = { emit: vi.fn() };
  return {
    app: { get: vi.fn().mockReturnValue(io) },
    user: { userId: 'user-001', role: 'admin' },
    ip: '127.0.0.1',
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── emitDocumentEvent ──────────────────────────────────────────────────

describe('emitDocumentEvent', () => {
  it('emits document-specific and generic events', () => {
    const req = makeReq();
    emitDocumentEvent(req, 'mrrv', 'doc-001', 'mrrv:submitted', { status: 'submitted' });

    expect(mockEmitToDocument).toHaveBeenCalledWith(expect.anything(), 'doc-001', 'mrrv:submitted', {
      id: 'doc-001',
      status: 'submitted',
    });
    expect(mockEmitToAll).toHaveBeenCalledWith(expect.anything(), 'document:status', {
      documentType: 'mrrv',
      documentId: 'doc-001',
      status: 'submitted',
    });
  });

  it('does nothing when io is not available', () => {
    const req = makeReq({ app: { get: vi.fn().mockReturnValue(undefined) } });
    emitDocumentEvent(req, 'mrrv', 'doc-001', 'mrrv:submitted', {});

    expect(mockEmitToDocument).not.toHaveBeenCalled();
    expect(mockEmitToAll).not.toHaveBeenCalled();
  });
});

// ── emitEntityEvent ────────────────────────────────────────────────────

describe('emitEntityEvent', () => {
  it('emits entity:created event', () => {
    const req = makeReq();
    emitEntityEvent(req, 'created', 'regions');

    expect(mockEmitToAll).toHaveBeenCalledWith(expect.anything(), 'entity:created', { entity: 'regions' });
  });

  it('merges extra data into event payload', () => {
    const req = makeReq();
    emitEntityEvent(req, 'updated', 'items', { id: 'item-001' });

    expect(mockEmitToAll).toHaveBeenCalledWith(expect.anything(), 'entity:updated', {
      entity: 'items',
      id: 'item-001',
    });
  });

  it('does nothing when io is not available', () => {
    const req = makeReq({ app: { get: vi.fn().mockReturnValue(undefined) } });
    emitEntityEvent(req, 'deleted', 'regions');

    expect(mockEmitToAll).not.toHaveBeenCalled();
  });
});

// ── auditAndEmit ───────────────────────────────────────────────────────

describe('auditAndEmit', () => {
  it('creates audit log with correct params', async () => {
    const req = makeReq();
    await auditAndEmit(req, {
      action: 'create',
      tableName: 'mrrv',
      recordId: 'rec-001',
      newValues: { status: 'draft' },
    });

    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      tableName: 'mrrv',
      recordId: 'rec-001',
      action: 'create',
      oldValues: undefined,
      newValues: { status: 'draft' },
      performedById: 'user-001',
      ipAddress: '127.0.0.1',
    });
  });

  it('emits document and generic socket events when docType and socketEvent provided', async () => {
    const req = makeReq();
    await auditAndEmit(req, {
      action: 'update',
      tableName: 'mrrv',
      recordId: 'rec-001',
      socketEvent: 'mrrv:submitted',
      docType: 'mrrv',
      socketData: { status: 'submitted' },
    });

    expect(mockEmitToDocument).toHaveBeenCalledWith(expect.anything(), 'rec-001', 'mrrv:submitted', {
      id: 'rec-001',
      status: 'submitted',
    });
    expect(mockEmitToAll).toHaveBeenCalledWith(expect.anything(), 'document:status', {
      documentType: 'mrrv',
      documentId: 'rec-001',
      status: 'submitted',
    });
  });

  it('emits entity event when entityEvent and entityName provided', async () => {
    const req = makeReq();
    await auditAndEmit(req, {
      action: 'create',
      tableName: 'mrrv',
      recordId: 'rec-001',
      entityEvent: 'created',
      entityName: 'mrrv',
    });

    expect(mockEmitToAll).toHaveBeenCalledWith(expect.anything(), 'entity:created', { entity: 'mrrv' });
  });

  it('publishes to event bus', async () => {
    const req = makeReq();
    await auditAndEmit(req, {
      action: 'update',
      tableName: 'mrrv',
      recordId: 'rec-001',
      docType: 'mrrv',
      socketEvent: 'mrrv:approved',
      socketData: { status: 'approved' },
    });

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'document:status_changed',
        entityType: 'mrrv',
        entityId: 'rec-001',
        action: 'update',
        performedById: 'user-001',
      }),
    );
  });

  it('uses document:action event type when no socketEvent', async () => {
    const req = makeReq();
    await auditAndEmit(req, {
      action: 'create',
      tableName: 'regions',
      recordId: 'reg-001',
    });

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'document:create',
        entityType: 'regions',
      }),
    );
  });

  it('skips socket events when io not available', async () => {
    const req = makeReq({ app: { get: vi.fn().mockReturnValue(undefined) } });
    await auditAndEmit(req, {
      action: 'update',
      tableName: 'mrrv',
      recordId: 'rec-001',
      socketEvent: 'mrrv:submitted',
      docType: 'mrrv',
    });

    expect(mockCreateAuditLog).toHaveBeenCalled();
    expect(mockEmitToDocument).not.toHaveBeenCalled();
  });
});
