import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma, mockEmitToUser } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock,
    mockEmitToUser: vi.fn(),
  };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../socket/setup.js', () => ({ emitToUser: mockEmitToUser }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type CreateNotificationParams,
} from './notification.service.js';

describe('notification.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    mockEmitToUser.mockClear();
  });

  const baseParams: CreateNotificationParams = {
    recipientId: 'user-001',
    title: 'New MRRV',
    titleAr: 'MRRV جديد',
    body: 'A new MRRV has been created',
    notificationType: 'mrrv_created',
    referenceTable: 'mrrv',
    referenceId: 'mrrv-001',
  };

  // ---------------------------------------------------------------------------
  // createNotification
  // ---------------------------------------------------------------------------
  describe('createNotification', () => {
    it('should create notification with correct data and include', async () => {
      const created = { id: 'notif-1', ...baseParams };
      mockPrisma.notification.create.mockResolvedValue(created);

      const result = await createNotification(baseParams);

      expect(mockPrisma.notification.create).toHaveBeenCalledOnce();
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          recipientId: 'user-001',
          title: 'New MRRV',
          titleAr: 'MRRV جديد',
          body: 'A new MRRV has been created',
          notificationType: 'mrrv_created',
          referenceTable: 'mrrv',
          referenceId: 'mrrv-001',
        },
        include: {
          recipient: { select: { fullName: true, email: true } },
        },
      });
      expect(result).toBe(created);
    });

    it('should emit socket event when io is provided', async () => {
      const created = { id: 'notif-2', ...baseParams };
      mockPrisma.notification.create.mockResolvedValue(created);
      const fakeIo = {} as any;

      await createNotification(baseParams, fakeIo);

      expect(mockEmitToUser).toHaveBeenCalledOnce();
      expect(mockEmitToUser).toHaveBeenCalledWith(fakeIo, 'user-001', 'notification:new', created);
    });

    it('should not emit socket event when io is not provided', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-3' });

      await createNotification(baseParams);

      expect(mockEmitToUser).not.toHaveBeenCalled();
    });

    it('should handle optional fields being undefined', async () => {
      const minimalParams: CreateNotificationParams = {
        recipientId: 'user-002',
        title: 'Simple notification',
        notificationType: 'info',
      };
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-4' });

      await createNotification(minimalParams);

      const callArgs = mockPrisma.notification.create.mock.calls[0][0];
      expect(callArgs.data.titleAr).toBeUndefined();
      expect(callArgs.data.body).toBeUndefined();
      expect(callArgs.data.referenceTable).toBeUndefined();
      expect(callArgs.data.referenceId).toBeUndefined();
    });

    it('should return the created notification', async () => {
      const created = { id: 'notif-5', title: 'Test' };
      mockPrisma.notification.create.mockResolvedValue(created);

      const result = await createNotification(baseParams);

      expect(result).toBe(created);
    });
  });

  // ---------------------------------------------------------------------------
  // getNotifications
  // ---------------------------------------------------------------------------
  describe('getNotifications', () => {
    it('should query with recipientId in where clause', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await getNotifications('user-001', { page: 1, pageSize: 10 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recipientId: 'user-001' } }),
      );
    });

    it('should add isRead:false filter when unreadOnly is true', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await getNotifications('user-001', { page: 1, pageSize: 10, unreadOnly: true });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 'user-001', isRead: false },
        }),
      );
    });

    it('should not include isRead when unreadOnly is falsy', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await getNotifications('user-001', { page: 1, pageSize: 10 });

      const callArgs = mockPrisma.notification.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({ recipientId: 'user-001' });
      expect(callArgs.where).not.toHaveProperty('isRead');
    });

    it('should apply correct pagination for page 1', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await getNotifications('user-001', { page: 1, pageSize: 20 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    });

    it('should apply correct pagination for page 3', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await getNotifications('user-001', { page: 3, pageSize: 10 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('should order by createdAt desc', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await getNotifications('user-001', { page: 1, pageSize: 10 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should return { data, total, unreadCount }', async () => {
      const notifications = [{ id: 'n-1' }, { id: 'n-2' }];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);
      mockPrisma.notification.count.mockResolvedValueOnce(50).mockResolvedValueOnce(12);

      const result = await getNotifications('user-001', { page: 1, pageSize: 10 });

      expect(result).toEqual({ data: notifications, total: 50, unreadCount: 12 });
    });

    it('should always query unread count with recipientId and isRead:false', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);

      await getNotifications('user-001', { page: 1, pageSize: 10 });

      // The second count call is for unread count
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 'user-001', isRead: false },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getUnreadCount
  // ---------------------------------------------------------------------------
  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(7);

      const result = await getUnreadCount('user-001');

      expect(result).toBe(7);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 'user-001', isRead: false },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await getUnreadCount('user-001');

      expect(result).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // markAsRead
  // ---------------------------------------------------------------------------
  describe('markAsRead', () => {
    it('should mark notification as read when user owns it', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        recipientId: 'user-001',
      });
      mockPrisma.notification.update.mockResolvedValue({});

      await markAsRead('notif-1', 'user-001');

      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
    });

    it('should throw NotFoundError when notification does not exist', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(markAsRead('notif-missing', 'user-001')).rejects.toThrow('not found');
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('should throw AuthorizationError when user does not own the notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        recipientId: 'user-002',
      });

      await expect(markAsRead('notif-1', 'user-001')).rejects.toThrow('You do not have access to this notification');
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // markAllAsRead
  // ---------------------------------------------------------------------------
  describe('markAllAsRead', () => {
    it('should update all unread notifications for user and return count', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await markAllAsRead('user-001');

      expect(result).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: 'user-001', isRead: false },
        data: { isRead: true },
      });
    });

    it('should return 0 when no unread notifications exist', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await markAllAsRead('user-001');

      expect(result).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteNotification
  // ---------------------------------------------------------------------------
  describe('deleteNotification', () => {
    it('should delete the notification when user owns it', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        recipientId: 'user-001',
      });
      mockPrisma.notification.delete.mockResolvedValue({});

      await deleteNotification('notif-1', 'user-001');

      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
    });

    it('should throw NotFoundError when notification does not exist', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(deleteNotification('notif-missing', 'user-001')).rejects.toThrow('not found');
      expect(mockPrisma.notification.delete).not.toHaveBeenCalled();
    });

    it('should throw AuthorizationError when user does not own the notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        recipientId: 'user-other',
      });

      await expect(deleteNotification('notif-1', 'user-001')).rejects.toThrow(
        'You do not have access to this notification',
      );
      expect(mockPrisma.notification.delete).not.toHaveBeenCalled();
    });
  });
});
