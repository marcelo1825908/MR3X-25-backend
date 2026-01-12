import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export interface NotificationDto {
  id: string;
  source: 'PAYMENT_REMINDER' | 'EXTRAJUDICIAL' | 'CONTRACT' | 'AGREEMENT' | 'INSPECTION' | 'PAYMENT' | 'TICKET' | 'SUPPORT' | 'PLAN' | 'BILLING' | 'SECURITY';
  description: string;
  title?: string;
  type: string;
  recurring?: string;
  days?: number;
  creationDate: Date;
  lastExecutionDate: Date | null;
  read: boolean;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string;
  actionLabel?: string;
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
    address?: string;
  };
  metadata?: {
    contractId?: string;
    agreementId?: string;
    inspectionId?: string;
    paymentId?: string;
    extrajudicialNotificationId?: string;
    ticketId?: string;
    planName?: string;
    billingEvent?: string;
    securityEvent?: string;
    [key: string]: any;
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Build where conditions based on user role
   * - Owner roles: only see notifications where they are the owner
   * - Tenant roles: only see notifications where they are the tenant
   * - Agency roles: only see notifications for their agency
   * - Admin roles: see all notifications
   */
  private buildWhereConditions(userId: bigint, agencyId?: bigint, userRole?: string): any {
    const ownerRoles = ['PROPRIETARIO', 'INDEPENDENT_OWNER'];
    const tenantRoles = ['INQUILINO'];
    const agencyRoles = ['AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'];
    const adminRoles = ['ADMIN', 'CEO'];

    if (adminRoles.includes(userRole || '')) {
      // Admins can see all notifications
      return {};
    }

    if (ownerRoles.includes(userRole || '')) {
      // Owners only see their own notifications (where they are the owner)
      return { ownerId: userId };
    }

    if (tenantRoles.includes(userRole || '')) {
      // Tenants only see their own notifications (where they are the tenant)
      return { tenantId: userId };
    }

    if (agencyRoles.includes(userRole || '') && agencyId) {
      // Agency users see notifications for their agency
      return { agencyId: agencyId };
    }

    // Default: only show notifications where user is directly involved
    return {
      OR: [
        { ownerId: userId },
        { tenantId: userId },
      ],
    };
  }

  /**
   * Get all platform notifications aggregated from multiple sources
   * Sources: Payment reminders, Extrajudicial notifications, Contracts, Agreements, Inspections, Payments
   */
  async getNotifications(userId: bigint, agencyId?: bigint, userRole?: string): Promise<{ items: NotificationDto[]; total: number }> {
    try {
      const allNotifications: NotificationDto[] = [];

      // 1. Payment Reminder Notifications
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);
      const paymentReminders = await this.prisma.notification.findMany({
        where: whereConditions,
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
              address: true,
            },
          },
        },
        orderBy: { creationDate: 'desc' },
        take: 50,
      });

      paymentReminders.forEach((n) => {
        allNotifications.push({
          id: `payment_reminder_${n.id}`,
          source: 'PAYMENT_REMINDER',
          description: n.description,
          type: n.type,
          recurring: n.recurring,
          days: n.days,
          creationDate: n.creationDate,
          lastExecutionDate: n.lastExecutionDate,
          read: n.lastExecutionDate !== null,
          priority: 'NORMAL',
          actionUrl: `/dashboard/payments`,
          actionLabel: 'Ver Pagamentos',
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
            address: n.property.address || undefined,
          } : undefined,
          metadata: {
            notificationId: n.id.toString(),
          },
        });
      });

      // 2. Extrajudicial Notifications
      const extrajudicialWhere: any = {};
      if (userRole === 'INQUILINO') {
        extrajudicialWhere.debtorId = userId;
      } else if (['PROPRIETARIO', 'INDEPENDENT_OWNER'].includes(userRole || '')) {
        extrajudicialWhere.creditorId = userId;
      } else if (agencyId) {
        extrajudicialWhere.agencyId = agencyId;
      } else if (!['CEO', 'ADMIN'].includes(userRole || '')) {
        extrajudicialWhere.OR = [
          { creditorId: userId },
          { debtorId: userId },
        ];
      }

      const extrajudicialNotifications = await this.prisma.extrajudicialNotification.findMany({
        where: {
          ...extrajudicialWhere,
          status: { notIn: ['CANCELADO', 'RESOLVIDO'] },
        },
        include: {
          property: {
            select: {
              id: true,
              address: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      extrajudicialNotifications.forEach((n) => {
        const isUnread = !n.viewedAt && n.status === 'ENVIADO';
        allNotifications.push({
          id: `extrajudicial_${n.id}`,
          source: 'EXTRAJUDICIAL',
          title: n.title,
          description: n.description || n.subject,
          type: n.type,
          creationDate: n.createdAt,
          lastExecutionDate: n.viewedAt || null,
          read: !isUnread,
          priority: n.priority === 'URGENT' ? 'URGENT' : n.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
          actionUrl: `/dashboard/extrajudicial-notifications/${n.id}`,
          actionLabel: 'Ver Notificação',
          property: n.property ? {
            id: n.property.id.toString(),
            name: n.property.address || '',
            address: n.property.address || undefined,
          } : undefined,
          metadata: {
            extrajudicialNotificationId: n.id.toString(),
            status: n.status,
            deadlineDate: n.deadlineDate?.toISOString(),
          },
        });
      });

      // 3. Contract Notifications (pending signatures, updates)
      const contractWhere: any = { deleted: false };
      if (userRole === 'INQUILINO') {
        contractWhere.tenantId = userId;
        contractWhere.status = { not: 'ENCERRADO' };
      } else if (['PROPRIETARIO', 'INDEPENDENT_OWNER'].includes(userRole || '')) {
        contractWhere.OR = [
          { ownerId: userId },
          { property: { ownerId: userId } },
        ];
        contractWhere.status = { not: 'ENCERRADO' };
      } else if (agencyId) {
        contractWhere.agencyId = agencyId;
        contractWhere.status = { not: 'ENCERRADO' };
      } else if (!['CEO', 'ADMIN'].includes(userRole || '')) {
        contractWhere.OR = [
          { tenantId: userId },
          { ownerId: userId },
        ];
        contractWhere.status = { not: 'ENCERRADO' };
      }

      const contracts = await this.prisma.contract.findMany({
        where: contractWhere,
        include: {
          property: {
            select: {
              id: true,
              address: true,
            },
          },
          tenantUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          ownerUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      contracts.forEach((c) => {
        const needsSignature = (userRole === 'INQUILINO' && !c.tenantSignature) ||
          (['PROPRIETARIO', 'INDEPENDENT_OWNER'].includes(userRole || '') && !c.ownerSignature) ||
          (agencyId && c.agencyId && !c.agencySignature);
        
        if (needsSignature || c.status === 'PENDENTE') {
          allNotifications.push({
            id: `contract_${c.id}`,
            source: 'CONTRACT',
            title: 'Contrato aguardando assinatura',
            description: `Contrato do imóvel ${c.property?.address || 'N/A'} aguarda sua assinatura`,
            type: 'contract_signature_pending',
            creationDate: c.createdAt,
            lastExecutionDate: c.tenantSignedAt || c.ownerSignedAt || null,
            read: !needsSignature,
            priority: 'HIGH',
            actionUrl: `/dashboard/contracts/${c.id}`,
            actionLabel: 'Assinar Contrato',
            tenant: c.tenantUser ? {
              id: c.tenantUser.id.toString(),
              name: c.tenantUser.name || '',
              email: c.tenantUser.email,
            } : undefined,
            owner: c.ownerUser ? {
              id: c.ownerUser.id.toString(),
              name: c.ownerUser.name || '',
              email: c.ownerUser.email,
            } : undefined,
            property: c.property ? {
              id: c.property.id.toString(),
              name: c.property.address || '',
              address: c.property.address || undefined,
            } : undefined,
            metadata: {
              contractId: c.id.toString(),
              status: c.status,
            },
          });
        }
      });

      // 4. Agreement Notifications (pending signatures, updates)
      const agreementWhere: any = {};
      if (userRole === 'INQUILINO') {
        agreementWhere.tenantId = userId;
        agreementWhere.status = { notIn: ['REJECTED', 'COMPLETED'] };
      } else if (['PROPRIETARIO', 'INDEPENDENT_OWNER'].includes(userRole || '')) {
        agreementWhere.ownerId = userId;
        agreementWhere.status = { notIn: ['REJECTED', 'COMPLETED'] };
      } else if (agencyId) {
        agreementWhere.agencyId = agencyId;
        agreementWhere.status = { notIn: ['REJECTED', 'COMPLETED'] };
      } else if (!['CEO', 'ADMIN'].includes(userRole || '')) {
        agreementWhere.OR = [
          { tenantId: userId },
          { ownerId: userId },
        ];
        agreementWhere.status = { notIn: ['REJECTED', 'COMPLETED'] };
      }

      const agreements = await this.prisma.agreement.findMany({
        where: agreementWhere,
        include: {
          property: {
            select: {
              id: true,
              address: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      agreements.forEach((a) => {
        const needsSignature = (userRole === 'INQUILINO' && !a.tenantSignature) ||
          (['PROPRIETARIO', 'INDEPENDENT_OWNER'].includes(userRole || '') && !a.ownerSignature);
        
        if (needsSignature || a.status === 'PENDING') {
          allNotifications.push({
            id: `agreement_${a.id}`,
            source: 'AGREEMENT',
            title: 'Acordo aguardando assinatura',
            description: a.title || `Acordo relacionado ao imóvel ${a.property?.address || 'N/A'}`,
            type: 'agreement_signature_pending',
            creationDate: a.createdAt,
            lastExecutionDate: a.tenantSignedAt || a.ownerSignedAt || null,
            read: !needsSignature,
            priority: 'HIGH',
            actionUrl: `/dashboard/agreements/${a.id}`,
            actionLabel: 'Ver Acordo',
            tenant: a.tenant ? {
              id: a.tenant.id.toString(),
              name: a.tenant.name || '',
              email: a.tenant.email || '',
            } : undefined,
            owner: a.owner ? {
              id: a.owner.id.toString(),
              name: a.owner.name || '',
              email: a.owner.email || '',
            } : undefined,
            property: a.property ? {
              id: a.property.id.toString(),
              name: a.property.address || '',
              address: a.property.address || undefined,
            } : undefined,
            metadata: {
              agreementId: a.id.toString(),
              status: a.status,
            },
          });
        }
      });

      // 5. Support Ticket Notifications
      const ticketWhere: any = {};
      if (userRole === 'INQUILINO' || ['PROPRIETARIO', 'INDEPENDENT_OWNER'].includes(userRole || '')) {
        ticketWhere.requesterId = userId;
      } else if (agencyId) {
        ticketWhere.agencyId = agencyId;
      } else if (!['CEO', 'ADMIN', 'PLATFORM_MANAGER'].includes(userRole || '')) {
        ticketWhere.requesterId = userId;
      }

      const supportTickets = await this.prisma.supportTicket.findMany({
        where: {
          ...ticketWhere,
          status: { notIn: ['CLOSED', 'CANCELLED', 'RESOLVED'] },
        },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              createdAt: true,
              authorId: true,
            },
          },
        },
        orderBy: { lastActivityAt: 'desc' },
        take: 20,
      });

      supportTickets.forEach((ticket) => {
        const hasUnreadMessages = ticket.messages.some(m => 
          m.authorId.toString() !== userId.toString() && 
          new Date(m.createdAt) > new Date(ticket.lastActivityAt.getTime() - 60000)
        );
        
        allNotifications.push({
          id: `ticket_${ticket.id}`,
          source: 'TICKET',
          title: `Ticket: ${ticket.subject}`,
          description: ticket.description.substring(0, 200) + (ticket.description.length > 200 ? '...' : ''),
          type: ticket.category,
          creationDate: ticket.createdAt,
          lastExecutionDate: ticket.lastActivityAt,
          read: !hasUnreadMessages && ticket.status !== 'OPEN',
          priority: ticket.priority === 'URGENT' ? 'URGENT' : ticket.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
          actionUrl: `/dashboard/tickets/${ticket.id}`,
          actionLabel: 'Ver Ticket',
          metadata: {
            ticketId: ticket.id.toString(),
            token: ticket.token,
            status: ticket.status,
            category: ticket.category,
            priority: ticket.priority,
            assignedToId: ticket.assignedToId?.toString(),
          },
        });
      });

      // 6. Plan Change Notifications (for Admin/CEO/Platform Manager)
      if (['CEO', 'ADMIN', 'PLATFORM_MANAGER', 'AGENCY_ADMIN'].includes(userRole || '')) {
        const planModificationRequests = await this.prisma.planModificationRequest.findMany({
          where: {
            status: { in: ['PENDING', 'APPROVED', 'REJECTED'] },
            ...(userRole === 'AGENCY_ADMIN' && agencyId ? {
              requestedBy: {
                agencyId: agencyId,
              },
            } : {}),
          },
          include: {
            requestedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                agencyId: true,
                agency: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        planModificationRequests.forEach((request) => {
          const isUnread = request.status === 'PENDING' && 
            (userRole === 'CEO' || userRole === 'ADMIN' || userRole === 'PLATFORM_MANAGER');
          
          const agencyName = request.requestedBy.agency?.name || 'N/A';
          const agencyId = request.requestedBy.agency?.id?.toString();
          
          allNotifications.push({
            id: `plan_request_${request.id}`,
            source: 'PLAN',
            title: `Solicitação de Modificação de Plano`,
            description: `Agência ${agencyName} solicitou modificação do plano ${request.planName}`,
            type: 'plan_modification_request',
            creationDate: request.createdAt,
            lastExecutionDate: request.createdAt,
            read: !isUnread,
            priority: request.status === 'PENDING' ? 'HIGH' : 'NORMAL',
            actionUrl: `/dashboard/plans?request=${request.id}`,
            actionLabel: 'Ver Solicitação',
            metadata: {
              requestId: request.id.toString(),
              planName: request.planName,
              status: request.status,
              agencyId: agencyId,
            },
          });
        });
      }

      // 7. Billing Event Notifications
      if (['CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER'].includes(userRole || '')) {
        const billingWhere: any = {};
        if (userRole === 'AGENCY_ADMIN' && agencyId) {
          billingWhere.agencyId = agencyId;
        } else if (userRole === 'INDEPENDENT_OWNER') {
          billingWhere.userId = userId;
        }

        // Get recent microtransactions (billing events)
        const recentBillingEvents = await this.prisma.microtransaction.findMany({
          where: {
            ...billingWhere,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
            status: { in: ['PAID', 'PENDING', 'FAILED'] },
          },
          include: {
            agency: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        recentBillingEvents.forEach((event) => {
          const isUnread = event.status === 'PENDING' || event.status === 'FAILED';
          
          allNotifications.push({
            id: `billing_${event.id}`,
            source: 'BILLING',
            title: `Evento de Faturamento: ${event.type}`,
            description: `${event.description || event.type} - ${event.status === 'PAID' ? 'Pago' : event.status === 'PENDING' ? 'Pendente' : 'Falhou'}`,
            type: event.type,
            creationDate: event.createdAt,
            lastExecutionDate: event.paidAt || event.createdAt,
            read: !isUnread,
            priority: event.status === 'FAILED' ? 'HIGH' : event.status === 'PENDING' ? 'NORMAL' : 'LOW',
            actionUrl: `/dashboard/billing`,
            actionLabel: 'Ver Faturamento',
            metadata: {
              billingEventId: event.id.toString(),
              type: event.type,
              status: event.status,
              amount: event.amount?.toString(),
              agencyId: event.agencyId?.toString(),
            },
          });
        });
      }

      // 8. Security Alert Notifications (for Admin/CEO)
      if (['CEO', 'ADMIN', 'PLATFORM_MANAGER'].includes(userRole || '')) {
        // Get recent security-related audit logs
        const securityAlerts = await this.prisma.auditLog.findMany({
          where: {
            event: { in: ['LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'PERMISSION_CHANGE', 'USER_DELETE', 'USER_SUSPEND'] },
            timestamp: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { timestamp: 'desc' },
          take: 20,
        });

        securityAlerts.forEach((alert) => {
          const isSecurityCritical = ['PASSWORD_CHANGE', 'PERMISSION_CHANGE', 'USER_DELETE', 'USER_SUSPEND'].includes(alert.event);
          
          allNotifications.push({
            id: `security_${alert.id}`,
            source: 'SECURITY',
            title: `Alerta de Segurança: ${alert.event}`,
            description: `${alert.user?.name || 'Usuário'} - ${alert.event}${alert.ip ? ` (IP: ${alert.ip})` : ''}`,
            type: alert.event.toLowerCase(),
            creationDate: alert.timestamp,
            lastExecutionDate: alert.timestamp,
            read: false, // Security alerts are always unread until explicitly marked
            priority: isSecurityCritical ? 'URGENT' : 'HIGH',
            actionUrl: `/dashboard/audit?logId=${alert.id}`,
            actionLabel: 'Ver Log',
            metadata: {
              auditLogId: alert.id.toString(),
              event: alert.event,
              entity: alert.entity,
              ip: alert.ip,
              userAgent: alert.userAgent,
            },
          });
        });
      }

      // Sort all notifications by creation date (newest first)
      allNotifications.sort((a, b) => {
        const dateA = new Date(a.creationDate).getTime();
        const dateB = new Date(b.creationDate).getTime();
        return dateB - dateA;
      });

      // Limit to 100 most recent
      const limitedNotifications = allNotifications.slice(0, 100);

      return { items: limitedNotifications, total: allNotifications.length };
    } catch (error) {
      this.logger.error('Error fetching notifications:', error);
      return { items: [], total: 0 };
    }
  }

  async markAsRead(notificationId: bigint, userId: bigint, agencyId?: bigint, userRole?: string): Promise<void> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          ...whereConditions,
        },
        data: {
          lastExecutionDate: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead(userId: bigint, agencyId?: bigint, userRole?: string): Promise<void> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      await this.prisma.notification.updateMany({
        where: {
          ...whereConditions,
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

  async getUnreadCount(userId: bigint, agencyId?: bigint, userRole?: string): Promise<number> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      return await this.prisma.notification.count({
        where: {
          ...whereConditions,
          lastExecutionDate: null,
        },
      });
    } catch (error) {
      this.logger.error('Error getting unread count:', error);
      return 0;
    }
  }

  async deleteNotification(notificationId: bigint, userId: bigint, agencyId?: bigint, userRole?: string): Promise<void> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      await this.prisma.notification.deleteMany({
        where: {
          id: notificationId,
          ...whereConditions,
        },
      });
    } catch (error) {
      this.logger.error('Error deleting notification:', error);
    }
  }

  async createNotification(data: {
    description: string;
    ownerId: bigint;
    tenantId: bigint;
    propertyId: bigint;
    agencyId?: bigint;
    type: string;
    recurring?: string;
    days?: number;
  }): Promise<void> {
    try {
      this.logger.debug(`Creating notification - ownerId: ${data.ownerId}, tenantId: ${data.tenantId}, agencyId: ${data.agencyId}, type: ${data.type}`);

      await this.prisma.notification.create({
        data: {
          description: data.description,
          ownerId: data.ownerId,
          tenantId: data.tenantId,
          propertyId: data.propertyId,
          agencyId: data.agencyId || null,
          type: data.type,
          recurring: data.recurring || 'once',
          days: data.days || 0,
          creationDate: new Date(),
          lastExecutionDate: null,
        },
      });
      this.logger.log(`Notification created: ${data.description} (ownerId: ${data.ownerId}, tenantId: ${data.tenantId})`);
    } catch (error) {
      this.logger.error('Error creating notification:', error);
    }
  }
}
