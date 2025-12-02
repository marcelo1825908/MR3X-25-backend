import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class SalesMessageService {
  constructor(private prisma: PrismaService) {}

  // Get all messages for a user (inbox)
  async getMessages(userId: bigint) {
    const messages = await this.prisma.salesMessage.findMany({
      where: {
        recipientId: userId,
        isDeleted: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        replies: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return messages.map((msg) => ({
      id: msg.id.toString(),
      senderId: msg.senderId.toString(),
      senderName: msg.sender.name || msg.sender.email,
      senderRole: msg.sender.role,
      recipientId: msg.recipientId.toString(),
      subject: msg.subject,
      content: msg.content,
      isRead: msg.isRead,
      isStarred: msg.isStarred,
      createdAt: msg.createdAt.toISOString(),
      readAt: msg.readAt?.toISOString() || null,
      replies: msg.replies.map((reply) => ({
        id: reply.id.toString(),
        senderId: reply.senderId.toString(),
        senderName: reply.sender.name || 'User',
        senderRole: reply.sender.role,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
      })),
    }));
  }

  // Create a new message
  async createMessage(
    senderId: bigint,
    recipientId: bigint,
    subject: string,
    content: string,
  ) {
    const message = await this.prisma.salesMessage.create({
      data: {
        senderId,
        recipientId,
        subject,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return {
      id: message.id.toString(),
      senderId: message.senderId.toString(),
      senderName: message.sender.name || message.sender.email,
      senderRole: message.sender.role,
      recipientId: message.recipientId.toString(),
      subject: message.subject,
      content: message.content,
      isRead: message.isRead,
      isStarred: message.isStarred,
      createdAt: message.createdAt.toISOString(),
      readAt: null,
      replies: [],
    };
  }

  // Mark message as read
  async markAsRead(messageId: bigint, userId: bigint) {
    const message = await this.prisma.salesMessage.updateMany({
      where: {
        id: messageId,
        recipientId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      id: messageId.toString(),
      isRead: true,
      readAt: new Date().toISOString(),
    };
  }

  // Toggle star status
  async toggleStar(messageId: bigint, userId: bigint) {
    // First get current star status
    const currentMessage = await this.prisma.salesMessage.findFirst({
      where: {
        id: messageId,
        recipientId: userId,
      },
    });

    if (!currentMessage) {
      throw new Error('Message not found');
    }

    const updated = await this.prisma.salesMessage.update({
      where: { id: messageId },
      data: {
        isStarred: !currentMessage.isStarred,
      },
    });

    return {
      id: messageId.toString(),
      isStarred: updated.isStarred,
    };
  }

  // Delete message (soft delete)
  async deleteMessage(messageId: bigint, userId: bigint) {
    await this.prisma.salesMessage.updateMany({
      where: {
        id: messageId,
        recipientId: userId,
      },
      data: {
        isDeleted: true,
      },
    });

    return {
      success: true,
      message: 'Message deleted successfully',
    };
  }

  // Reply to a message
  async replyToMessage(messageId: bigint, senderId: bigint, content: string) {
    // First verify the message exists
    const message = await this.prisma.salesMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    const reply = await this.prisma.salesMessageReply.create({
      data: {
        messageId,
        senderId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return {
      id: reply.id.toString(),
      senderId: reply.senderId.toString(),
      senderName: reply.sender.name || 'User',
      senderRole: reply.sender.role,
      content: reply.content,
      createdAt: reply.createdAt.toISOString(),
    };
  }

  // Get notifications for a user
  async getNotifications(userId: bigint) {
    const notifications = await this.prisma.salesNotification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return notifications.map((n) => ({
      id: n.id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  // Create a notification
  async createNotification(
    userId: bigint,
    type: string,
    title: string,
    message: string,
    link?: string,
  ) {
    const notification = await this.prisma.salesNotification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
      },
    });

    return {
      id: notification.id.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: bigint, userId: bigint) {
    await this.prisma.salesNotification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });

    return { success: true };
  }
}
