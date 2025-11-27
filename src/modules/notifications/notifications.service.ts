import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export interface NotificationDto {
  id: string;
  description: string;
  type: string;
  recurring: string;
  days: number;
  creationDate: Date;
  lastExecutionDate: Date | null;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  tenant?: {
    id: string;
    name: string;
    email: string;
  };
  property?: {
    id: string;
    name: string;
  };
  read: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async getNotifications(userId: bigint): Promise<{ items: NotificationDto[]; total: number }> {
    try {
      const [notifications, total] = await Promise.all([
        this.prisma.notification.findMany({
          where: {
            OR: [
              { ownerId: userId },
              { tenantId: userId },
            ],
          },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            tenant: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { creationDate: 'desc' },
          take: 50,
        }),
        this.prisma.notification.count({
          where: {
            OR: [
              { ownerId: userId },
              { tenantId: userId },
            ],
          },
        }),
      ]);

      const items: NotificationDto[] = notifications.map((n) => ({
        id: n.id.toString(),
        description: n.description,
        type: n.type,
        recurring: n.recurring,
        days: n.days,
        creationDate: n.creationDate,
        lastExecutionDate: n.lastExecutionDate,
        owner: n.owner ? {
          id: n.owner.id.toString(),
          name: n.owner.name || '',
          email: n.owner.email,
        } : undefined,
        tenant: n.tenant ? {
          id: n.tenant.id.toString(),
          name: n.tenant.name || '',
          email: n.tenant.email,
        } : undefined,
        property: n.property ? {
          id: n.property.id.toString(),
          name: n.property.name || '',
        } : undefined,
        read: n.lastExecutionDate !== null,
      }));

      return { items, total };
    } catch (error) {
      this.logger.error('Error fetching notifications:', error);
      // Return empty array if there's an error (e.g., table doesn't exist yet)
      return { items: [], total: 0 };
    }
  }

  async markAsRead(notificationId: bigint, userId: bigint): Promise<void> {
    try {
      await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          OR: [
            { ownerId: userId },
            { tenantId: userId },
          ],
        },
        data: {
          lastExecutionDate: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead(userId: bigint): Promise<void> {
    try {
      await this.prisma.notification.updateMany({
        where: {
          OR: [
            { ownerId: userId },
            { tenantId: userId },
          ],
          lastExecutionDate: null,
        },
        data: {
          lastExecutionDate: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error marking all notifications as read:', error);
    }
  }

  async getUnreadCount(userId: bigint): Promise<number> {
    try {
      return await this.prisma.notification.count({
        where: {
          OR: [
            { ownerId: userId },
            { tenantId: userId },
          ],
          lastExecutionDate: null,
        },
      });
    } catch (error) {
      this.logger.error('Error getting unread count:', error);
      return 0;
    }
  }

  async deleteNotification(notificationId: bigint, userId: bigint): Promise<void> {
    try {
      await this.prisma.notification.deleteMany({
        where: {
          id: notificationId,
          OR: [
            { ownerId: userId },
            { tenantId: userId },
          ],
        },
      });
    } catch (error) {
      this.logger.error('Error deleting notification:', error);
    }
  }
}
