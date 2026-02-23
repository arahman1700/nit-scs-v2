import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma, mockWebPush, mockGetEnv, mockLogger } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock,
    mockWebPush: {
      generateVAPIDKeys: vi.fn().mockReturnValue({ publicKey: 'gen-pub', privateKey: 'gen-priv' }),
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockResolvedValue({}),
    },
    mockGetEnv: vi.fn().mockReturnValue({}),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ logger: mockLogger }));
vi.mock('../config/env.js', () => ({ getEnv: mockGetEnv }));
vi.mock('web-push', () => ({ default: mockWebPush }));

import { createPrismaMock, type PrismaModelMock } from '../test-utils/prisma-mock.js';

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

type PushModule = typeof import('./push-notification.service.js');

const mockSubscription = {
  endpoint: 'https://push.example.com/sub-123',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

const mockPayload = {
  title: 'New GRN',
  body: 'GRN-2026-001 has been created',
  icon: '/icon.png',
  url: '/grn/123',
  tag: 'grn-created',
};

function resetPrisma(): void {
  Object.assign(mockPrisma, createPrismaMock());
  (mockPrisma as Record<string, unknown>).systemSetting = createModelMock();
  (mockPrisma as Record<string, unknown>).pushSubscription = createModelMock();
}

function resetMocks(): void {
  vi.clearAllMocks();
  resetPrisma();
  // Re-bind $transaction to use mockPrisma (not the internal createPrismaMock closure)
  // so tx.systemSetting/pushSubscription are available inside transaction callbacks
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: PrismaMock) => Promise<unknown>)(mockPrisma as PrismaMock);
    return Promise.all(arg as Promise<unknown>[]);
  });
  mockGetEnv.mockReturnValue({});
  mockWebPush.generateVAPIDKeys.mockReturnValue({ publicKey: 'gen-pub', privateKey: 'gen-priv' });
  mockWebPush.sendNotification.mockResolvedValue({});
}

/**
 * Get a fresh module instance with reset module-level state.
 * Required because push-notification.service caches VAPID config at module level.
 */
async function freshModule(): Promise<PushModule> {
  vi.resetModules();
  return import('./push-notification.service.js');
}

describe('push-notification.service', () => {
  // ─── VAPID Configuration — Environment Variables ────────────────────

  describe('getVapidPublicKey — env vars', () => {
    it('should load VAPID keys from environment variables', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({
        VAPID_PUBLIC_KEY: 'env-pub-key',
        VAPID_PRIVATE_KEY: 'env-priv-key',
        VAPID_SUBJECT: 'mailto:admin@nit-scs.com',
      });

      const mod = await freshModule();
      const publicKey = await mod.getVapidPublicKey();

      expect(publicKey).toBe('env-pub-key');
      expect(mockWebPush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:admin@nit-scs.com',
        'env-pub-key',
        'env-priv-key',
      );
      expect(mockLogger.info).toHaveBeenCalledWith('VAPID keys: loaded from environment variables');
      expect((mockPrisma as Record<string, PrismaModelMock>).systemSetting.findMany).not.toHaveBeenCalled();
      expect(mockWebPush.generateVAPIDKeys).not.toHaveBeenCalled();
    });

    it('should use default subject when VAPID_SUBJECT is missing', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({
        VAPID_PUBLIC_KEY: 'env-pub',
        VAPID_PRIVATE_KEY: 'env-priv',
      });

      const mod = await freshModule();
      await mod.getVapidPublicKey();

      expect(mockWebPush.setVapidDetails).toHaveBeenCalledWith('mailto:admin@nit-scs.com', 'env-pub', 'env-priv');
    });
  });

  // ─── VAPID Configuration — Database ─────────────────────────────────

  describe('getVapidPublicKey — database', () => {
    it('should load VAPID keys from database when env vars are missing', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({});
      (mockPrisma as Record<string, PrismaModelMock>).systemSetting.findMany.mockResolvedValue([
        { key: 'vapid_public_key', value: 'db-pub-key', userId: null },
        { key: 'vapid_private_key', value: 'db-priv-key', userId: null },
      ]);

      const mod = await freshModule();
      const publicKey = await mod.getVapidPublicKey();

      expect(publicKey).toBe('db-pub-key');
      expect(mockWebPush.setVapidDetails).toHaveBeenCalledWith('mailto:admin@nit-scs.com', 'db-pub-key', 'db-priv-key');
      expect(mockLogger.info).toHaveBeenCalledWith('VAPID keys: loaded from database (SystemSetting)');
      expect(mockWebPush.generateVAPIDKeys).not.toHaveBeenCalled();
    });

    it('should fall through to generation when only partial DB keys', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({});
      (mockPrisma as Record<string, PrismaModelMock>).systemSetting.findMany.mockResolvedValue([
        { key: 'vapid_public_key', value: 'db-pub-key', userId: null },
      ]);

      const mod = await freshModule();
      const publicKey = await mod.getVapidPublicKey();

      expect(publicKey).toBe('gen-pub');
      expect(mockWebPush.generateVAPIDKeys).toHaveBeenCalled();
    });

    it('should handle DB read errors gracefully', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({});
      (mockPrisma as Record<string, PrismaModelMock>).systemSetting.findMany.mockRejectedValue(
        new Error('DB connection failed'),
      );

      const mod = await freshModule();
      const publicKey = await mod.getVapidPublicKey();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'VAPID keys: failed to read from database — will generate new keys',
      );
      expect(publicKey).toBe('gen-pub');
      expect(mockWebPush.generateVAPIDKeys).toHaveBeenCalled();
    });
  });

  // ─── VAPID Configuration — Generation ───────────────────────────────

  describe('getVapidPublicKey — generation', () => {
    it('should generate and save VAPID keys when none exist', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({});
      (mockPrisma as Record<string, PrismaModelMock>).systemSetting.findMany.mockResolvedValue([]);

      const mod = await freshModule();
      const publicKey = await mod.getVapidPublicKey();

      expect(publicKey).toBe('gen-pub');
      expect(mockWebPush.generateVAPIDKeys).toHaveBeenCalled();
      expect(mockWebPush.setVapidDetails).toHaveBeenCalledWith('mailto:admin@nit-scs.com', 'gen-pub', 'gen-priv');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('VAPID keys: generated and saved to database for persistence');
    });

    it('should handle save failures gracefully', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({});
      (mockPrisma as Record<string, PrismaModelMock>).systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const mod = await freshModule();
      const publicKey = await mod.getVapidPublicKey();

      expect(publicKey).toBe('gen-pub');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'VAPID keys: generated but failed to save to database — keys will be ephemeral this session',
      );
    });
  });

  // ─── VAPID Caching & Concurrency ────────────────────────────────────

  describe('getVapidPublicKey — caching', () => {
    it('should cache VAPID public key after first load', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({
        VAPID_PUBLIC_KEY: 'env-pub',
        VAPID_PRIVATE_KEY: 'env-priv',
      });

      const mod = await freshModule();
      const key1 = await mod.getVapidPublicKey();
      const key2 = await mod.getVapidPublicKey();
      const key3 = await mod.getVapidPublicKey();

      expect(key1).toBe('env-pub');
      expect(key2).toBe('env-pub');
      expect(key3).toBe('env-pub');
      expect(mockWebPush.setVapidDetails).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent initialization calls', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({
        VAPID_PUBLIC_KEY: 'env-pub',
        VAPID_PRIVATE_KEY: 'env-priv',
      });

      const mod = await freshModule();
      const [key1, key2, key3] = await Promise.all([
        mod.getVapidPublicKey(),
        mod.getVapidPublicKey(),
        mod.getVapidPublicKey(),
      ]);

      expect(key1).toBe('env-pub');
      expect(key2).toBe('env-pub');
      expect(key3).toBe('env-pub');
      expect(mockWebPush.setVapidDetails).toHaveBeenCalledTimes(1);
    });
  });

  // ─── subscribe ──────────────────────────────────────────────────────

  describe('subscribe', () => {
    it('should upsert subscription with userAgent', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      const created = { id: 'sub-001', userId: 'user-001' };
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.upsert.mockResolvedValue(created);

      const mod = await freshModule();
      const result = await mod.subscribe('user-001', mockSubscription, 'Mozilla/5.0');

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.upsert).toHaveBeenCalledWith({
        where: { userId_endpoint: { userId: 'user-001', endpoint: mockSubscription.endpoint } },
        update: { p256dh: 'p256dh-key', auth: 'auth-key', userAgent: 'Mozilla/5.0', isActive: true },
        create: {
          userId: 'user-001',
          endpoint: mockSubscription.endpoint,
          p256dh: 'p256dh-key',
          auth: 'auth-key',
          userAgent: 'Mozilla/5.0',
        },
      });
      expect(result).toBe(created);
    });

    it('should handle missing userAgent', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.upsert.mockResolvedValue({});

      const mod = await freshModule();
      await mod.subscribe('user-001', mockSubscription);

      const callArgs = (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.upsert.mock.calls[0][0];
      expect(callArgs.update.userAgent).toBeNull();
      expect(callArgs.create.userAgent).toBeNull();
    });

    it('should ensure VAPID is configured before subscribing', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.upsert.mockResolvedValue({});

      const mod = await freshModule();
      await mod.subscribe('user-001', mockSubscription);

      expect(mockWebPush.setVapidDetails).toHaveBeenCalled();
    });
  });

  // ─── unsubscribe ────────────────────────────────────────────────────

  describe('unsubscribe', () => {
    it('should delete subscription by userId and endpoint', async () => {
      resetMocks();
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const mod = await freshModule();
      await mod.unsubscribe('user-001', mockSubscription.endpoint);

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-001', endpoint: mockSubscription.endpoint },
      });
    });
  });

  // ─── sendPushToUser ─────────────────────────────────────────────────

  describe('sendPushToUser', () => {
    it('should send push to all active subscriptions for user', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      const subs = [
        { id: 'sub-1', endpoint: 'https://push1.com/sub', p256dh: 'p1', auth: 'a1' },
        { id: 'sub-2', endpoint: 'https://push2.com/sub', p256dh: 'p2', auth: 'a2' },
      ];
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue(subs);

      const mod = await freshModule();
      await mod.sendPushToUser('user-001', mockPayload);

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-001', isActive: true },
      });
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should skip sending when user has no subscriptions', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue([]);

      const mod = await freshModule();
      await mod.sendPushToUser('user-001', mockPayload);

      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });

    it('should use default icon and url when not provided', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue([
        { id: 'sub-1', endpoint: 'https://push1.com/sub', p256dh: 'p1', auth: 'a1' },
      ]);

      const mod = await freshModule();
      await mod.sendPushToUser('user-001', { title: 'Test', body: 'Body' });

      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        JSON.stringify({ title: 'Test', body: 'Body', icon: '/pwa-192x192.png', url: '/', tag: undefined }),
      );
    });
  });

  // ─── sendPushToRole ─────────────────────────────────────────────────

  describe('sendPushToRole', () => {
    it('should query by role and send to all active subscriptions', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      const subs = [
        { id: 'sub-1', endpoint: 'https://push1.com/sub', p256dh: 'p1', auth: 'a1' },
        { id: 'sub-2', endpoint: 'https://push2.com/sub', p256dh: 'p2', auth: 'a2' },
      ];
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue(subs);

      const mod = await freshModule();
      await mod.sendPushToRole('WAREHOUSE_MANAGER', mockPayload);

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany).toHaveBeenCalledWith({
        where: { isActive: true, user: { systemRole: 'WAREHOUSE_MANAGER', isActive: true } },
      });
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(2);
    });
  });

  // ─── broadcastPush ──────────────────────────────────────────────────

  describe('broadcastPush', () => {
    it('should send to all active subscriptions', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      const subs = [
        { id: 'sub-1', endpoint: 'https://push1.com/sub', p256dh: 'p1', auth: 'a1' },
        { id: 'sub-2', endpoint: 'https://push2.com/sub', p256dh: 'p2', auth: 'a2' },
      ];
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue(subs);

      const mod = await freshModule();
      await mod.broadcastPush(mockPayload);

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(2);
    });
  });

  // ─── sendAndCleanup — Gone/Expired Subscriptions ────────────────────

  describe('sendAndCleanup — subscription cleanup', () => {
    it('should deactivate subscriptions that return 410 Gone', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      const subs = [
        { id: 'sub-1', endpoint: 'https://push1.com/sub', p256dh: 'p1', auth: 'a1' },
        { id: 'sub-2', endpoint: 'https://push2.com/sub', p256dh: 'p2', auth: 'a2' },
      ];
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue(subs);
      mockWebPush.sendNotification.mockResolvedValueOnce({}).mockRejectedValueOnce({ statusCode: 410 });
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.updateMany.mockResolvedValue({ count: 1 });

      const mod = await freshModule();
      await mod.sendPushToUser('user-001', mockPayload);

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub-2'] } },
        data: { isActive: false },
      });
    });

    it('should deactivate subscriptions that return 404 Not Found', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      const subs = [{ id: 'sub-1', endpoint: 'https://push1.com/sub', p256dh: 'p1', auth: 'a1' }];
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue(subs);
      mockWebPush.sendNotification.mockRejectedValueOnce({ statusCode: 404 });
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.updateMany.mockResolvedValue({ count: 1 });

      const mod = await freshModule();
      await mod.sendPushToUser('user-001', mockPayload);

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub-1'] } },
        data: { isActive: false },
      });
    });

    it('should not deactivate on other error codes (e.g. 500)', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      const subs = [{ id: 'sub-1', endpoint: 'https://push1.com/sub', p256dh: 'p1', auth: 'a1' }];
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue(subs);
      mockWebPush.sendNotification.mockRejectedValueOnce({ statusCode: 500 });

      const mod = await freshModule();
      await mod.sendPushToUser('user-001', mockPayload);

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.updateMany).not.toHaveBeenCalled();
    });

    it('should not update when all sends succeed', async () => {
      resetMocks();
      mockGetEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'k', VAPID_PRIVATE_KEY: 'k' });
      const subs = [
        { id: 'sub-1', endpoint: 'https://push1.com/sub', p256dh: 'p1', auth: 'a1' },
        { id: 'sub-2', endpoint: 'https://push2.com/sub', p256dh: 'p2', auth: 'a2' },
      ];
      (mockPrisma as Record<string, PrismaModelMock>).pushSubscription.findMany.mockResolvedValue(subs);
      mockWebPush.sendNotification.mockResolvedValue({});

      const mod = await freshModule();
      await mod.sendPushToUser('user-001', mockPayload);

      expect((mockPrisma as Record<string, PrismaModelMock>).pushSubscription.updateMany).not.toHaveBeenCalled();
    });
  });
});
