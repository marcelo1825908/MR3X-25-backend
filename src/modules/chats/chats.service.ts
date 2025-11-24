import { prisma } from '../../config/database';
import { NotFoundError, AppError } from '../../shared/errors/AppError';
import { ChatCreateDTO, MessageCreateDTO } from './chats.dto';
import { emitToChat, emitToUser } from '../../realtime/socket';

export class ChatsService {
  async getChats(userId: string) {
    const userIdBigInt = BigInt(userId);

    // Get active chats for the user
    const activeChats = await prisma.activeChat.findMany({
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
        otherParticipant,
        unreadCount: ac.unread,
        createdAt: ac.chat.createdAt,
      };
    });
  }

  async getMessages(chatId: string, userId: string) {
    const chat = await prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Verify user is participant
    if (chat.participant1Id.toString() !== userId && chat.participant2Id.toString() !== userId) {
      throw new AppError('Access denied', 403);
    }

    const messages = await prisma.message.findMany({
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
      sender: msg.sender,
      isMine: msg.senderId?.toString() === userId,
    }));
  }

  async sendMessage(chatId: string, userId: string, data: MessageCreateDTO) {
    const chat = await prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Verify user is participant
    if (chat.participant1Id.toString() !== userId && chat.participant2Id.toString() !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Determine receiver
    const receiverId = chat.participant1Id.toString() === userId 
      ? chat.participant2Id 
      : chat.participant1Id;

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId: BigInt(chatId),
        senderId: BigInt(userId),
        receiverId: receiverId,
        content: data.content,
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

    // Update unread count for receiver
    await prisma.activeChat.updateMany({
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

    // Realtime events
    emitToChat(chatId, 'chat:new-message', {
      chatId,
      message: {
        id: message.id.toString(),
        content: message.content,
        timestamp: message.messageTimestamp,
        read: message.messageRead,
        sender: message.sender,
      },
    })
    emitToUser(receiverId.toString(), 'chat:notify', { chatId, unreadIncrement: 1 })

    return {
      id: message.id.toString(),
      content: message.content,
      timestamp: message.messageTimestamp,
      read: message.messageRead,
      sender: message.sender,
    };
  }

  async createChat(userId: string, data: ChatCreateDTO) {
    const { participantId } = data;

    // Check if chat already exists
    const existingChat = await prisma.chat.findFirst({
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

    // Get participant names
    const [user, participant] = await Promise.all([
      prisma.user.findUnique({ where: { id: BigInt(userId) } }),
      prisma.user.findUnique({ where: { id: BigInt(participantId) } }),
    ]);

    if (!participant) {
      throw new NotFoundError('Participant not found');
    }

    // Create chat
    const chat = await prisma.chat.create({
      data: {
        participant1Id: BigInt(userId),
        participant2Id: BigInt(participantId),
        createdAt: new Date(),
      },
    });

    // Create active chat entries for both users
    await Promise.all([
      prisma.activeChat.create({
        data: {
          chatId: chat.id,
          userId: BigInt(userId),
          chatName: participant.name || participant.email,
          unread: 0,
        },
      }),
      prisma.activeChat.create({
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

  async getAvailableUsers(userId: string, role: string) {
    const availableUsers: any[] = []
    
    // Agency admins can chat with their agency managers
    if (role === 'AGENCY_ADMIN') {
      const agencyAdmin = await prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { agencyId: true },
      });

      if (agencyAdmin?.agencyId) {
        const managers = await prisma.user.findMany({
          where: {
            agencyId: agencyAdmin.agencyId,
            role: 'AGENCY_MANAGER',
            id: { not: BigInt(userId) }, // Exclude self
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        });
        return managers;
      }
      return [];
    }
    
    // Managers can chat with their registered brokers
    if (role === 'AGENCY_MANAGER') {
      const brokers = await prisma.user.findMany({
        where: {
          createdBy: BigInt(userId),
          role: 'BROKER',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      });
      return brokers;
    }
    
    // Brokers can chat with their associated owners and tenants
    if (role === 'BROKER') {
      // Get tenants: tenants created by this broker OR tenants in properties assigned to this broker
      const brokerIdBigInt = BigInt(userId);
      
      // Find tenants created by this broker
      const tenantsCreatedByBroker = await prisma.user.findMany({
        where: {
          ownerId: brokerIdBigInt,
          role: 'INQUILINO',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      });
      availableUsers.push(...tenantsCreatedByBroker);

      // Find tenants in properties assigned to this broker
      const properties = await prisma.property.findMany({
        where: { brokerId: brokerIdBigInt },
        select: { tenantId: true, ownerId: true },
      });
      const tenantIds = properties.map(p => p.tenantId).filter(id => id !== null) as bigint[];
      
      if (tenantIds.length > 0) {
        const tenantsInProperties = await prisma.user.findMany({
          where: {
            id: { in: tenantIds },
            role: 'INQUILINO',
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        });
        // Add tenants that aren't already in the list
        const existingIds = new Set(tenantsCreatedByBroker.map(t => t.id.toString()));
        tenantsInProperties.forEach(tenant => {
          if (!existingIds.has(tenant.id.toString())) {
            availableUsers.push(tenant);
          }
        });
      }

      // Find owners: owners of properties assigned to this broker
      const ownerIds = properties.map(p => p.ownerId).filter(id => id !== null) as bigint[];
      if (ownerIds.length > 0) {
        const owners = await prisma.user.findMany({
          where: {
            id: { in: ownerIds },
            role: 'PROPRIETARIO',
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        });
        availableUsers.push(...owners);
      }

      // Remove duplicates
      const uniqueUsers = Array.from(
        new Map(availableUsers.map(user => [user.id.toString(), user])).values()
      );
      return uniqueUsers;
    }
    
    // Independent owners can chat with their tenants (same as PROPRIETARIO but without agency limitations)
    if (role === 'INDEPENDENT_OWNER') {
      const availableUsers: any[] = [];
      
      // Get tenants
      const tenants = await prisma.user.findMany({
        where: {
          ownerId: BigInt(userId),
          role: 'INQUILINO',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      });
      availableUsers.push(...tenants);

      return availableUsers;
    }
    
    // Owners can chat with their tenants and brokers managing their properties
    if (role === 'PROPRIETARIO') {
      const availableUsers: any[] = [];
      
      // Get tenants
      const tenants = await prisma.user.findMany({
        where: {
          ownerId: BigInt(userId),
          role: 'INQUILINO',
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      });
      availableUsers.push(...tenants);

      // Get brokers from properties owned by this owner
      const properties = await prisma.property.findMany({
        where: {
          ownerId: BigInt(userId),
          brokerId: { not: null },
        },
        select: {
          brokerId: true,
        },
      });

      const brokerIds = Array.from(
        new Set(properties.map(p => p.brokerId).filter(id => id !== null) as bigint[])
      );

      if (brokerIds.length > 0) {
        const brokers = await prisma.user.findMany({
          where: {
            id: { in: brokerIds },
            role: 'BROKER',
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        });
        availableUsers.push(...brokers);
      }

      // Remove duplicates
      const uniqueUsers = Array.from(
        new Map(availableUsers.map(user => [user.id.toString(), user])).values()
      );
      return uniqueUsers;
    }
    
    // Tenants can chat with: owner + brokers managing their properties
    if (role === 'INQUILINO') {
      const tenant = await prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: {
          ownerId: true,
          tenantProperties: {
            select: { 
              brokerId: true,
            },
          },
        },
      });

      // Add owner if available
      if (tenant?.ownerId) {
        const owner = await prisma.user.findUnique({
          where: { id: tenant.ownerId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        });
        if (owner) availableUsers.push(owner);
      }

      // Add brokers from tenant properties
      const brokerIds = new Set<bigint>();
      tenant?.tenantProperties.forEach(property => {
        if (property.brokerId) brokerIds.add(property.brokerId);
      });
      
      if (brokerIds.size > 0) {
        const brokers = await prisma.user.findMany({
          where: {
            id: { in: Array.from(brokerIds) },
            role: 'BROKER',
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        });
        availableUsers.push(...brokers);
      }

      return availableUsers;
    }

    return [];
  }

  async deleteChat(chatId: string, userId: string) {
    const chat = await prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Verify user is participant
    if (chat.participant1Id.toString() !== userId && chat.participant2Id.toString() !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Delete messages
    await prisma.message.deleteMany({
      where: { chatId: BigInt(chatId) },
    });

    // Delete active chats
    await prisma.activeChat.deleteMany({
      where: { chatId: BigInt(chatId) },
    });

    // Delete chat
    await prisma.chat.delete({
      where: { id: BigInt(chatId) },
    });
  }

  async markAsRead(chatId: string, userId: string) {
    const chat = await prisma.chat.findUnique({
      where: { id: BigInt(chatId) },
    });

    if (!chat) {
      throw new NotFoundError('Chat not found');
    }

    // Verify user is participant
    if (chat.participant1Id.toString() !== userId && chat.participant2Id.toString() !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        chatId: BigInt(chatId),
        receiverId: BigInt(userId),
        messageRead: false,
      },
      data: {
        messageRead: true,
      },
    });

    // Reset unread count
    await prisma.activeChat.updateMany({
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

