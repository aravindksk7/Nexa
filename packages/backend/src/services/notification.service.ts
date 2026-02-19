import { prisma } from '../lib/prisma.js';

type NotificationType = 'QUALITY_ALERT' | 'WORKFLOW_ACTION' | 'ASSET_UPDATE' | 'SYSTEM';

const VALID_TYPES: NotificationType[] = ['QUALITY_ALERT', 'WORKFLOW_ACTION', 'ASSET_UPDATE', 'SYSTEM'];

export { VALID_TYPES };

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  async createNotification(input: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  }

  async listNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    const { unreadOnly = false, limit = 50, offset = 0 } = options ?? {};
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          ...(unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({
        where: {
          userId,
          ...(unreadOnly ? { isRead: false } : {}),
        },
      }),
    ]);
    const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });
    return { notifications, total, unreadCount };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new Error('Notification not found or unauthorized');
    return prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { count: result.count };
  }

  async deleteNotification(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new Error('Notification not found or unauthorized');
    await prisma.notification.delete({ where: { id } });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }
}

export const notificationService = new NotificationService();
