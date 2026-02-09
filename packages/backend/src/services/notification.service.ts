import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../utils/prisma.js';
import { emitToUser } from '../socket/setup.js';

export interface CreateNotificationParams {
  recipientId: string;
  title: string;
  titleAr?: string;
  body?: string;
  notificationType: string;
  referenceTable?: string;
  referenceId?: string;
}

export async function createNotification(params: CreateNotificationParams, io?: SocketIOServer) {
  const notification = await prisma.notification.create({
    data: {
      recipientId: params.recipientId,
      title: params.title,
      titleAr: params.titleAr,
      body: params.body,
      notificationType: params.notificationType,
      referenceTable: params.referenceTable,
      referenceId: params.referenceId,
    },
    include: {
      recipient: { select: { fullName: true, email: true } },
    },
  });

  // Emit real-time socket event to the recipient
  if (io) {
    emitToUser(io, params.recipientId, 'notification:new', notification);
  }

  return notification;
}

export async function getNotifications(
  recipientId: string,
  options: { page: number; pageSize: number; unreadOnly?: boolean },
) {
  const where: Record<string, unknown> = { recipientId };
  if (options.unreadOnly) {
    where.isRead = false;
  }

  const [data, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { recipientId, isRead: false } }),
  ]);

  return { data, total, unreadCount };
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  return prisma.notification.count({ where: { recipientId, isRead: false } });
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });

  if (!notification) {
    throw new Error('Notification not found');
  }
  if (notification.recipientId !== userId) {
    throw new Error('Access denied');
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, isRead: false },
    data: { isRead: true },
  });

  return result.count;
}

export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });

  if (!notification) {
    throw new Error('Notification not found');
  }
  if (notification.recipientId !== userId) {
    throw new Error('Access denied');
  }

  await prisma.notification.delete({ where: { id: notificationId } });
}
