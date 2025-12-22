import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class ChatsService {
  constructor(private prisma: PrismaService) {}

  async getChats(userId: string) {
    const userIdBigInt = BigInt(userId);

    const activeChats = await this.prisma.activeChat.findMany({
      where: {
        userId: userIdBigInt,
      },
      include: {
        chat: {
          include: {
            participant1: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            participant2: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        chat: {
          createdAt: 'desc',
        },
      },
    });

    return activeChats.map(ac => {
      const otherParticipant = ac.chat.participant1.id.toString() === userId
        ? ac.chat.participant2
        : ac.chat.participant1;

      return {
        id: ac.chatId.toString(),
        name: ac.chatName,
        otherParticipant: {
          id: otherParticipant.id.toString(),
          name: otherParticipant.name,
          email: otherParticipant.email,
        },
        unreadCount: ac.unread,
        createdAt: ac.chat.createdAt,
      };
    });
  }

  async getMessages(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.participant1Id.toString() !== userId && chat.participant2Id.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        chatId: BigInt(chatId),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        messageTimestamp: 'asc',
      },
    });

    return messages.map(msg => ({
      id: msg.id.toString(),
      content: msg.content,
      timestamp: msg.messageTimestamp,
      read: msg.messageRead,
      sender: msg.sender ? {
        id: msg.sender.id.toString(),
        name: msg.sender.name,
        email: msg.sender.email,
      } : null,
      isMine: msg.senderId?.toString() === userId,
    }));
  }

  async sendMessage(chatId: string, userId: string, content: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.participant1Id.toString() !== userId && chat.participant2Id.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const receiverId = chat.participant1Id.toString() === userId
      ? chat.participant2Id
      : chat.participant1Id;

    const message = await this.prisma.message.create({
      data: {
        chatId: BigInt(chatId),
        senderId: BigInt(userId),
        receiverId: receiverId,
        content: content,
        messageTimestamp: new Date(),
        messageRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.prisma.activeChat.updateMany({
      where: {
        chatId: BigInt(chatId),
        userId: receiverId,
      },
      data: {
        unread: {
          increment: 1,
        },
      },
    });

    return {
      id: message.id.toString(),
      content: message.content,
      timestamp: message.messageTimestamp,
      read: message.messageRead,
      sender: message.sender ? {
        id: message.sender.id.toString(),
        name: message.sender.name,
        email: message.sender.email,
      } : null,
    };
  }

  async createChat(userId: string, participantId: string) {
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        OR: [
          { participant1Id: BigInt(userId), participant2Id: BigInt(participantId) },
          { participant1Id: BigInt(participantId), participant2Id: BigInt(userId) },
        ],
      },
    });

    if (existingChat) {
      return { id: existingChat.id.toString() };
    }

    const [user, participant] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: BigInt(userId) } }),
      this.prisma.user.findUnique({ where: { id: BigInt(participantId) } }),
    ]);

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const chat = await this.prisma.chat.create({
      data: {
        participant1Id: BigInt(userId),
        participant2Id: BigInt(participantId),
        createdAt: new Date(),
      },
    });

    await Promise.all([
      this.prisma.activeChat.create({
        data: {
          chatId: chat.id,
          userId: BigInt(userId),
          chatName: participant.name || participant.email,
          unread: 0,
        },
      }),
      this.prisma.activeChat.create({
        data: {
          chatId: chat.id,
          userId: BigInt(participantId),
          chatName: user?.name || user?.email || 'Unknown',
          unread: 0,
        },
      }),
    ]);

    return { id: chat.id.toString() };
  }

  async getAvailableUsers(userId: string, role: string, userAgencyId?: string) {
    const userIdBigInt = BigInt(userId);
    
    // Normalize role to uppercase for comparison
    const normalizedRole = role?.toUpperCase();

    if (normalizedRole === 'CEO') {
      const adminUsers = await this.prisma.user.findMany({
        where: {
          id: { not: userIdBigInt },
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      return adminUsers.map(u => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
      }));
    }

    if (normalizedRole === 'ADMIN') {
      const createdUsers = await this.prisma.user.findMany({
        where: {
          id: { not: userIdBigInt },
          createdBy: userIdBigInt,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      const agencyAdmins = await this.prisma.user.findMany({
        where: {
          id: { not: userIdBigInt },
          role: 'AGENCY_ADMIN',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      const allUsers = [...createdUsers, ...agencyAdmins];
      const uniqueUsers = allUsers.filter((user, index, self) =>
        index === self.findIndex(u => u?.id?.toString() === user?.id?.toString())
      );

      return uniqueUsers.map(u => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
      }));
    }

    if (normalizedRole === 'AGENCY_ADMIN' && userAgencyId) {
      const agencyUsers = await this.prisma.user.findMany({
        where: {
          agencyId: BigInt(userAgencyId),
          id: { not: userIdBigInt },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      const agencyContracts = await this.prisma.contract.findMany({
        where: {
          agencyId: BigInt(userAgencyId),
          deleted: false,
        },
        select: {
          tenantId: true,
          tenantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      });

      const tenantUsers = agencyContracts
        .filter(c => c.tenantUser && c.tenantUser.id.toString() !== userId)
        .map(c => c.tenantUser);

      const allUsers = [...agencyUsers, ...tenantUsers];
      const uniqueUsers = allUsers.filter((user, index, self) =>
        index === self.findIndex(u => u?.id?.toString() === user?.id?.toString())
      );

      return uniqueUsers.filter(u => u).map(u => ({
        id: u!.id.toString(),
        name: u!.name,
        email: u!.email,
        phone: u!.phone,
        role: u!.role,
      }));
    }

    if (normalizedRole === 'AGENCY_MANAGER' && userAgencyId) {
      const agencyUsers = await this.prisma.user.findMany({
        where: {
          agencyId: BigInt(userAgencyId),
          id: { not: userIdBigInt },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      return agencyUsers.map(u => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
      }));
    }

    if (normalizedRole === 'REPRESENTATIVE') {
      // REPRESENTATIVE can chat only with ADMIN users
      const adminUsers = await this.prisma.user.findMany({
        where: {
          id: { not: userIdBigInt },
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      return adminUsers.map(u => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
      }));
    }

    if (normalizedRole === 'BROKER' && userAgencyId) {
      const agencyUsers = await this.prisma.user.findMany({
        where: {
          agencyId: BigInt(userAgencyId),
          id: { not: userIdBigInt },
          status: 'ACTIVE',
          role: { in: ['AGENCY_ADMIN', 'AGENCY_MANAGER'] },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      const brokerProperties = await this.prisma.property.findMany({
        where: {
          brokerId: userIdBigInt,
        },
        select: {
          contracts: {
            where: { deleted: false },
            select: {
              tenantUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      const tenantUsers = brokerProperties
        .flatMap(p => p.contracts)
        .filter(c => c.tenantUser)
        .map(c => c.tenantUser);

      const allUsers = [...agencyUsers, ...tenantUsers];
      const uniqueUsers = allUsers.filter((user, index, self) =>
        index === self.findIndex(u => u?.id?.toString() === user?.id?.toString())
      );

      return uniqueUsers.filter(u => u).map(u => ({
        id: u!.id.toString(),
        name: u!.name,
        email: u!.email,
        phone: u!.phone,
        role: u!.role,
      }));
    }

    if (normalizedRole === 'INQUILINO') {
      const tenantContracts = await this.prisma.contract.findMany({
        where: {
          tenantId: userIdBigInt,
          deleted: false,
        },
        select: {
          ownerUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
            },
          },
          agency: {
            select: {
              users: {
                where: {
                  role: { in: ['AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'] },
                  status: 'ACTIVE',
                },
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      const owners = tenantContracts
        .filter(c => c.ownerUser)
        .map(c => c.ownerUser);

      const agencyUsers = tenantContracts
        .flatMap(c => c.agency?.users || []);

      const allUsers = [...owners, ...agencyUsers];
      const uniqueUsers = allUsers.filter((user, index, self) =>
        index === self.findIndex(u => u?.id?.toString() === user?.id?.toString())
      );

      return uniqueUsers.filter(u => u).map(u => ({
        id: u!.id.toString(),
        name: u!.name,
        email: u!.email,
        phone: u!.phone,
        role: u!.role,
      }));
    }

    if (normalizedRole === 'PROPRIETARIO' || normalizedRole === 'INDEPENDENT_OWNER') {
      // Get all tenants registered by this owner (not just those with contracts)
      const ownerTenants = await this.prisma.user.findMany({
        where: {
          ownerId: userIdBigInt,
          role: 'INQUILINO',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      // Also get agency users from contracts (if any contracts exist with agencies)
      const ownerContracts = await this.prisma.contract.findMany({
        where: {
          ownerId: userIdBigInt,
          deleted: false,
        },
        select: {
          agency: {
            select: {
              users: {
                where: {
                  role: { in: ['AGENCY_ADMIN', 'AGENCY_MANAGER'] },
                  status: 'ACTIVE',
                },
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      const agencyUsers = ownerContracts
        .flatMap(c => c.agency?.users || []);

      const allUsers = [...ownerTenants, ...agencyUsers];
      const uniqueUsers = allUsers.filter((user, index, self) =>
        index === self.findIndex(u => u?.id?.toString() === user?.id?.toString())
      );

      return uniqueUsers.filter(u => u).map(u => ({
        id: u!.id.toString(),
        name: u!.name,
        email: u!.email,
        phone: u!.phone,
        role: u!.role,
      }));
    }

    return [];
  }

  async deleteChat(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.participant1Id.toString() !== userId && chat.participant2Id.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.message.deleteMany({
      where: { chatId: BigInt(chatId) },
    });

    await this.prisma.activeChat.deleteMany({
      where: { chatId: BigInt(chatId) },
    });

    await this.prisma.chat.delete({
      where: { id: BigInt(chatId) },
    });
  }

  async markAsRead(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.participant1Id.toString() !== userId && chat.participant2Id.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.message.updateMany({
      where: {
        chatId: BigInt(chatId),
        receiverId: BigInt(userId),
        messageRead: false,
      },
      data: {
        messageRead: true,
      },
    });

    await this.prisma.activeChat.updateMany({
      where: {
        chatId: BigInt(chatId),
        userId: BigInt(userId),
      },
      data: {
        unread: 0,
      },
    });
  }
}
