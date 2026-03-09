/**
 * Integration tests for equipment delivery & return note routes.
 */

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../../../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../../../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../../../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../system/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/equipment-note.service.js', () => ({
  listDeliveryNotes: vi.fn(),
  getDeliveryNoteById: vi.fn(),
  createDeliveryNote: vi.fn(),
  updateDeliveryNote: vi.fn(),
  confirmDeliveryNote: vi.fn(),
  cancelDeliveryNote: vi.fn(),
  listReturnNotes: vi.fn(),
  getReturnNoteById: vi.fn(),
  createReturnNote: vi.fn(),
  updateReturnNote: vi.fn(),
  inspectReturnNote: vi.fn(),
  confirmReturnNote: vi.fn(),
  disputeReturnNote: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as svc from '../services/equipment-note.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const LOGISTICS_TOKEN = signTestToken({ userId: 'log-1', systemRole: 'logistics_coordinator' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// DELIVERY NOTES
// ═══════════════════════════════════════════════════════════════════════

describe('GET /api/v1/equipment-notes/delivery', () => {
  it('should return 200 with delivery notes', async () => {
    vi.mocked(svc.listDeliveryNotes).mockResolvedValue({ data: [{ id: 'dn-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/equipment-notes/delivery').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/equipment-notes/delivery');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/equipment-notes/delivery', () => {
  const validBody = {
    jobOrderId: '00000000-0000-0000-0000-000000000001',
    deliveryDate: '2026-03-10T09:00:00Z',
    receivedById: '00000000-0000-0000-0000-000000000002',
    equipmentDescription: 'CAT 320 Excavator',
    conditionOnDelivery: 'good',
  };

  it('should return 201 on create', async () => {
    vi.mocked(svc.createDeliveryNote).mockResolvedValue({ id: 'dn-1' } as never);

    const res = await request
      .post('/api/v1/equipment-notes/delivery')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request
      .post('/api/v1/equipment-notes/delivery')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/equipment-notes/delivery/:id/confirm', () => {
  it('should return 200 on confirm', async () => {
    vi.mocked(svc.confirmDeliveryNote).mockResolvedValue({ id: 'dn-1', status: 'confirmed' } as never);

    const res = await request
      .post('/api/v1/equipment-notes/delivery/dn-1/confirm')
      .set('Authorization', `Bearer ${LOGISTICS_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/equipment-notes/delivery/:id/cancel', () => {
  it('should return 200 on cancel', async () => {
    vi.mocked(svc.cancelDeliveryNote).mockResolvedValue({ id: 'dn-1', status: 'cancelled' } as never);

    const res = await request
      .post('/api/v1/equipment-notes/delivery/dn-1/cancel')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// RETURN NOTES
// ═══════════════════════════════════════════════════════════════════════

describe('GET /api/v1/equipment-notes/return', () => {
  it('should return 200 with return notes', async () => {
    vi.mocked(svc.listReturnNotes).mockResolvedValue({ data: [{ id: 'rn-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/equipment-notes/return').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/equipment-notes/return', () => {
  const validBody = {
    jobOrderId: '00000000-0000-0000-0000-000000000001',
    deliveryNoteId: '00000000-0000-0000-0000-000000000003',
    returnDate: '2026-03-15T09:00:00Z',
    returnedById: '00000000-0000-0000-0000-000000000002',
    conditionOnReturn: 'good',
  };

  it('should return 201 on create', async () => {
    vi.mocked(svc.createReturnNote).mockResolvedValue({ id: 'rn-1' } as never);

    const res = await request
      .post('/api/v1/equipment-notes/return')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });
});

describe('POST /api/v1/equipment-notes/return/:id/inspect', () => {
  it('should return 200 on inspect', async () => {
    vi.mocked(svc.inspectReturnNote).mockResolvedValue({ id: 'rn-1', status: 'inspected' } as never);

    const res = await request
      .post('/api/v1/equipment-notes/return/rn-1/inspect')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/equipment-notes/return/:id/confirm', () => {
  it('should return 200 on confirm', async () => {
    vi.mocked(svc.confirmReturnNote).mockResolvedValue({ id: 'rn-1', status: 'confirmed' } as never);

    const res = await request
      .post('/api/v1/equipment-notes/return/rn-1/confirm')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/equipment-notes/return/:id/dispute', () => {
  it('should return 200 on dispute', async () => {
    vi.mocked(svc.disputeReturnNote).mockResolvedValue({ id: 'rn-1', status: 'disputed' } as never);

    const res = await request
      .post('/api/v1/equipment-notes/return/rn-1/dispute')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ reason: 'Equipment damaged' });

    expect(res.status).toBe(200);
  });
});
