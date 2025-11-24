import { prisma } from '../../config/database';
import { NotFoundError, AppError, ForbiddenError } from '../../shared/errors/AppError';
import { NotificationCreateDTO, NotificationUpdateDTO } from './notifications.dto';

export class NotificationsService {
  async getNotifications(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: {
        ownerId: BigInt(userId),
      },
      include: {
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
            address: true,
          },
        },
      },
      orderBy: {
        creationDate: 'desc',
      },
    });

    return notifications;
  }

  async createNotification(userId: string, data: NotificationCreateDTO) {
    if (!data.tenantId && !data.propertyId) {
      throw new AppError('Either tenantId or propertyId must be provided', 400);
    }

    let tenantId: bigint;
    let propertyId: bigint;

    if (data.propertyId) {
      // Get property and its tenant
      const property = await prisma.property.findFirst({
        where: {
          id: BigInt(data.propertyId),
          ownerId: BigInt(userId),
          deleted: false,
        },
      });

      if (!property) {
        throw new NotFoundError('Property not found');
      }

      if (!property.tenantId) {
        throw new AppError('Property has no tenant assigned', 400);
      }

      propertyId = property.id;
      tenantId = property.tenantId;
    } else if (data.tenantId) {
      // Get tenant's property
      const tenant = await prisma.user.findFirst({
        where: {
          id: BigInt(data.tenantId),
          ownerId: BigInt(userId),
        },
      });

      if (!tenant) {
        throw new NotFoundError('Tenant not found');
      }

      const property = await prisma.property.findFirst({
        where: {
          tenantId: tenant.id,
          ownerId: BigInt(userId),
          deleted: false,
        },
      });

      if (!property) {
        throw new AppError('Tenant has no property assigned', 400);
      }

      tenantId = tenant.id;
      propertyId = property.id;
    } else {
      throw new AppError('Invalid request', 400);
    }

    // Generate description
    const description = `${data.type} notification - ${data.days} days - ${data.recurring ? 'Recurring' : 'One-time'}`;

    const notification = await prisma.notification.create({
      data: {
        ownerId: BigInt(userId),
        tenantId,
        propertyId,
        type: data.type,
        days: data.days,
        recurring: data.recurring ? 'YES' : 'NO',
        description,
        creationDate: new Date(),
      },
      include: {
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
            address: true,
          },
        },
      },
    });

    return notification;
  }

  async updateNotification(notificationId: string, userId: string, data: NotificationUpdateDTO) {
    const existing = await prisma.notification.findUnique({
      where: { id: BigInt(notificationId) },
    });

    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    if (existing.ownerId.toString() !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const notification = await prisma.notification.update({
      where: { id: BigInt(notificationId) },
      data: {
        type: data.type,
        days: data.days,
        recurring: data.recurring,
        description: data.description,
      },
    });

    return notification;
  }

  async deleteNotification(notificationId: string, userId: string) {
    const existing = await prisma.notification.findUnique({
      where: { id: BigInt(notificationId) },
    });

    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    if (existing.ownerId.toString() !== userId) {
      throw new ForbiddenError('Access denied');
    }

    await prisma.notification.delete({
      where: { id: BigInt(notificationId) },
    });
  }

  async getUserNotifications(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: {
        ownerId: BigInt(userId),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        creationDate: 'desc',
      },
    });

    // Group by tenant
    const grouped = notifications.reduce((acc: any, notif) => {
      const tenantId = notif.tenantId.toString();
      if (!acc[tenantId]) {
        acc[tenantId] = {
          tenant: notif.tenant,
          notifications: [],
        };
      }
      acc[tenantId].notifications.push(notif);
      return acc;
    }, {});

    return Object.values(grouped);
  }

  async getPropertyNotifications(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: {
        ownerId: BigInt(userId),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        creationDate: 'desc',
      },
    });

    // Group by property
    const grouped = notifications.reduce((acc: any, notif) => {
      const propertyId = notif.propertyId.toString();
      if (!acc[propertyId]) {
        acc[propertyId] = {
          property: notif.property,
          notifications: [],
        };
      }
      acc[propertyId].notifications.push(notif);
      return acc;
    }, {});

    return Object.values(grouped);
  }

  async getUserNotificationsById(userId: string, tenantId: string) {
    const notifications = await prisma.notification.findMany({
      where: {
        ownerId: BigInt(userId),
        tenantId: BigInt(tenantId),
      },
      include: {
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
            address: true,
          },
        },
      },
    });

    return notifications;
  }

  async getPropertyNotificationsById(userId: string, propertyId: string) {
    const notifications = await prisma.notification.findMany({
      where: {
        ownerId: BigInt(userId),
        propertyId: BigInt(propertyId),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    return notifications;
  }

  async deleteUserNotification(userId: string, tenantId: string) {
    const result = await prisma.notification.deleteMany({
      where: {
        ownerId: BigInt(userId),
        tenantId: BigInt(tenantId),
      },
    });

    return result;
  }

  async deletePropertyNotification(userId: string, propertyId: string) {
    const result = await prisma.notification.deleteMany({
      where: {
        ownerId: BigInt(userId),
        propertyId: BigInt(propertyId),
      },
    });

    return result;
  }
}

