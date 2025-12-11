import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateExtrajudicialNotificationDto } from './dto/create-extrajudicial-notification.dto';
import {
  UpdateExtrajudicialNotificationDto,
  SignExtrajudicialNotificationDto,
  RespondExtrajudicialNotificationDto,
  ResolveExtrajudicialNotificationDto,
  ForwardToJudicialDto,
  SendNotificationDto,
} from './dto/update-extrajudicial-notification.dto';
import * as crypto from 'crypto';

@Injectable()
export class ExtrajudicialNotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique notification token
   */
  private generateNotificationToken(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `MR3X-NOT-${year}-${random}`;
  }

  /**
   * Generate notification number
   */
  private generateNotificationNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `MR3X-NOT-${year}-${random}`;
  }

  /**
   * Generate protocol number
   */
  private generateProtocolNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PROT-${dateStr}-${random}`;
  }

  /**
   * Calculate deadline date
   */
  private calculateDeadlineDate(deadlineDays: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + deadlineDays);
    return date;
  }

  /**
   * Generate document hash
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create a new extrajudicial notification
   */
  async create(data: CreateExtrajudicialNotificationDto, userId: string, clientIP?: string, userAgent?: string) {
    // Validate property exists
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(data.propertyId) },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Calculate deadline date
    const deadlineDate = this.calculateDeadlineDate(data.deadlineDays);

    const notification = await this.prisma.extrajudicialNotification.create({
      data: {
        contractId: data.contractId ? BigInt(data.contractId) : null,
        propertyId: BigInt(data.propertyId),
        agreementId: data.agreementId ? BigInt(data.agreementId) : null,
        inspectionId: data.inspectionId ? BigInt(data.inspectionId) : null,
        agencyId: data.agencyId ? BigInt(data.agencyId) : property.agencyId,

        notificationToken: this.generateNotificationToken(),
        notificationNumber: this.generateNotificationNumber(),
        protocolNumber: this.generateProtocolNumber(),

        type: data.type as any,
        status: 'RASCUNHO',
        priority: data.priority || 'NORMAL',

        creditorId: BigInt(data.creditorId),
        creditorName: data.creditorName,
        creditorDocument: data.creditorDocument,
        creditorAddress: data.creditorAddress || null,
        creditorEmail: data.creditorEmail || null,
        creditorPhone: data.creditorPhone || null,

        debtorId: BigInt(data.debtorId),
        debtorName: data.debtorName,
        debtorDocument: data.debtorDocument,
        debtorAddress: data.debtorAddress || null,
        debtorEmail: data.debtorEmail || null,
        debtorPhone: data.debtorPhone || null,

        title: data.title,
        subject: data.subject,
        description: data.description,
        legalBasis: data.legalBasis,
        demandedAction: data.demandedAction,

        principalAmount: data.principalAmount || null,
        fineAmount: data.fineAmount || null,
        interestAmount: data.interestAmount || null,
        correctionAmount: data.correctionAmount || null,
        lawyerFees: data.lawyerFees || null,
        totalAmount: data.totalAmount,

        deadlineDays: data.deadlineDays,
        deadlineDate,
        gracePeriodDays: data.gracePeriodDays || null,
        consequencesText: data.consequencesText || null,

        clientIP: clientIP || null,
        userAgent: userAgent || null,
        notes: data.notes || null,
        createdBy: BigInt(userId),
      },
    });

    // Create audit entry
    await this.createAudit(notification.id.toString(), 'CREATED', userId, clientIP, userAgent, {
      action: 'Notification created',
    });

    return this.findOne(notification.id.toString());
  }

  /**
   * Find all notifications with filters
   * Now includes notifications where user is the debtor (so they can see notifications sent TO them)
   */
  async findAll(params: {
    skip?: number;
    take?: number;
    agencyId?: string;
    propertyId?: string;
    contractId?: string;
    creditorId?: string;
    debtorId?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    createdById?: string;
    userId?: string; // Current user ID to show notifications where they are debtor
  }) {
    const {
      skip = 0,
      take = 10,
      agencyId,
      propertyId,
      contractId,
      creditorId,
      debtorId,
      type,
      status,
      startDate,
      endDate,
      createdById,
      userId,
    } = params;

    const where: any = {};

    // Build OR condition for visibility:
    // User can see notifications they created OR notifications where they are the debtor (after sent)
    if (userId && !agencyId && !createdById) {
      where.OR = [
        { createdBy: BigInt(userId) },
        {
          debtorId: BigInt(userId),
          status: { notIn: ['RASCUNHO'] } // Debtors can only see after it's sent
        },
        {
          creditorId: BigInt(userId),
        }
      ];
    } else {
      if (agencyId) where.agencyId = BigInt(agencyId);
      if (createdById) where.createdBy = BigInt(createdById);
    }

    if (propertyId) where.propertyId = BigInt(propertyId);
    if (contractId) where.contractId = BigInt(contractId);
    if (creditorId) where.creditorId = BigInt(creditorId);
    if (debtorId) where.debtorId = BigInt(debtorId);
    if (type) where.type = type;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [notifications, total] = await Promise.all([
      this.prisma.extrajudicialNotification.findMany({
        where,
        skip,
        take,
        include: {
          property: {
            select: { id: true, address: true, city: true, name: true },
          },
          contract: {
            select: { id: true, status: true, startDate: true, endDate: true },
          },
          creditor: {
            select: { id: true, name: true, email: true },
          },
          debtor: {
            select: { id: true, name: true, email: true },
          },
          createdByUser: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.extrajudicialNotification.count({ where }),
    ]);

    // Add userRole field to each notification to indicate if current user is creditor or debtor
    const notificationsWithRole = notifications.map(n => {
      const serialized = this.serializeNotification(n);
      if (userId) {
        const userIdBigInt = BigInt(userId);
        if (n.creditorId === userIdBigInt || n.createdBy === userIdBigInt) {
          serialized.userRole = 'CREDITOR';
        } else if (n.debtorId === userIdBigInt) {
          serialized.userRole = 'DEBTOR';
        } else {
          serialized.userRole = 'VIEWER';
        }
      }
      return serialized;
    });

    return {
      data: notificationsWithRole,
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  /**
   * Find one notification by ID
   */
  async findOne(id: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          include: {
            owner: { select: { id: true, name: true, email: true, phone: true } },
            tenant: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        contract: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            monthlyRent: true,
          },
        },
        agreement: {
          select: { id: true, title: true, status: true, type: true },
        },
        inspection: {
          select: { id: true, type: true, status: true, date: true },
        },
        creditor: { select: { id: true, name: true, email: true, phone: true, document: true } },
        debtor: { select: { id: true, name: true, email: true, phone: true, document: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        resolvedByUser: { select: { id: true, name: true, email: true } },
        audits: {
          orderBy: { performedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.serializeNotification(notification);
  }

  /**
   * Find notification by token (for external access)
   */
  async findByToken(token: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { notificationToken: token },
      include: {
        property: {
          select: { id: true, address: true, city: true, name: true },
        },
        creditor: { select: { id: true, name: true } },
        debtor: { select: { id: true, name: true } },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.serializeNotification(notification);
  }

  /**
   * Update notification
   */
  async update(id: string, data: UpdateExtrajudicialNotificationDto, userId: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Only allow updates to draft notifications
    if (notification.status !== 'RASCUNHO') {
      throw new ForbiddenException('Can only update draft notifications');
    }

    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.priority) updateData.priority = data.priority;
    if (data.title) updateData.title = data.title;
    if (data.subject) updateData.subject = data.subject;
    if (data.description) updateData.description = data.description;
    if (data.legalBasis) updateData.legalBasis = data.legalBasis;
    if (data.demandedAction) updateData.demandedAction = data.demandedAction;
    if (data.principalAmount !== undefined) updateData.principalAmount = data.principalAmount;
    if (data.fineAmount !== undefined) updateData.fineAmount = data.fineAmount;
    if (data.interestAmount !== undefined) updateData.interestAmount = data.interestAmount;
    if (data.correctionAmount !== undefined) updateData.correctionAmount = data.correctionAmount;
    if (data.lawyerFees !== undefined) updateData.lawyerFees = data.lawyerFees;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.consequencesText !== undefined) updateData.consequencesText = data.consequencesText;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.deadlineDays) {
      updateData.deadlineDays = data.deadlineDays;
      updateData.deadlineDate = this.calculateDeadlineDate(data.deadlineDays);
    }

    if (data.gracePeriodDays !== undefined) {
      updateData.gracePeriodDays = data.gracePeriodDays;
    }

    await this.prisma.extrajudicialNotification.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    await this.createAudit(id, 'UPDATED', userId, null, null, {
      fields: Object.keys(updateData),
    });

    return this.findOne(id);
  }

  /**
   * Send notification
   */
  async send(id: string, data: SendNotificationDto, userId: string, clientIP?: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.status !== 'RASCUNHO' && notification.status !== 'AGUARDANDO_ENVIO') {
      throw new BadRequestException('Notification already sent');
    }

    await this.prisma.extrajudicialNotification.update({
      where: { id: BigInt(id) },
      data: {
        status: 'ENVIADO',
        sentAt: new Date(),
        sentVia: data.sentVia || 'EMAIL',
      },
    });

    await this.createAudit(id, 'SENT', userId, clientIP, null, {
      sentVia: data.sentVia || 'EMAIL',
    });

    // TODO: Implement actual email/WhatsApp sending

    return this.findOne(id);
  }

  /**
   * Mark notification as viewed
   */
  async markAsViewed(id: string, clientIP?: string, userAgent?: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Only update if not already viewed
    if (!notification.viewedAt) {
      await this.prisma.extrajudicialNotification.update({
        where: { id: BigInt(id) },
        data: {
          status: 'VISUALIZADO',
          viewedAt: new Date(),
          viewedIP: clientIP,
          viewedUserAgent: userAgent,
        },
      });

      await this.createAudit(id, 'VIEWED', notification.debtorId.toString(), clientIP, userAgent, {});
    }

    return this.findOne(id);
  }

  /**
   * Sign notification
   * Validates that only the correct party can sign their respective role
   */
  async sign(id: string, data: SignExtrajudicialNotificationDto, userId: string, clientIP?: string, userAgent?: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const userIdBigInt = BigInt(userId);
    const now = new Date();
    const updateData: any = {};

    // Validate creditor signature - only the creditor or creator can sign as creditor
    if (data.creditorSignature) {
      const isCreditor = notification.creditorId === userIdBigInt;
      const isCreator = notification.createdBy === userIdBigInt;

      if (!isCreditor && !isCreator) {
        throw new ForbiddenException('Apenas o credor (notificante) pode assinar como credor');
      }

      if (notification.creditorSignedAt) {
        throw new BadRequestException('O credor ja assinou esta notificacao');
      }

      updateData.creditorSignature = data.creditorSignature;
      updateData.creditorSignedAt = now;
      updateData.creditorSignedIP = clientIP;
      updateData.creditorSignedAgent = userAgent;
      if (data.geoLat) updateData.creditorGeoLat = data.geoLat;
      if (data.geoLng) updateData.creditorGeoLng = data.geoLng;
    }

    // Validate debtor signature - only the debtor can sign as debtor
    if (data.debtorSignature) {
      const isDebtor = notification.debtorId === userIdBigInt;

      if (!isDebtor) {
        throw new ForbiddenException('Apenas o devedor (notificado) pode assinar como devedor');
      }

      if (notification.debtorSignedAt) {
        throw new BadRequestException('O devedor ja assinou esta notificacao');
      }

      // Debtor can only sign if notification has been sent
      if (notification.status === 'RASCUNHO') {
        throw new BadRequestException('A notificacao deve ser enviada antes que o devedor possa assinar');
      }

      updateData.debtorSignature = data.debtorSignature;
      updateData.debtorSignedAt = now;
      updateData.debtorSignedIP = clientIP;
      updateData.debtorSignedAgent = userAgent;
      if (data.geoLat) updateData.debtorGeoLat = data.geoLat;
      if (data.geoLng) updateData.debtorGeoLng = data.geoLng;
    }

    if (data.witness1Signature) {
      updateData.witness1Signature = data.witness1Signature;
      updateData.witness1Name = data.witness1Name;
      updateData.witness1Document = data.witness1Document;
      updateData.witness1SignedAt = now;
    }

    if (data.witness2Signature) {
      updateData.witness2Signature = data.witness2Signature;
      updateData.witness2Name = data.witness2Name;
      updateData.witness2Document = data.witness2Document;
      updateData.witness2SignedAt = now;
    }

    // Update notification with signatures
    await this.prisma.extrajudicialNotification.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    const signerType = data.creditorSignature ? 'CREDITOR' : data.debtorSignature ? 'DEBTOR' : 'WITNESS';
    await this.createAudit(id, `SIGNED_BY_${signerType}`, userId, clientIP, userAgent, {});

    return this.findOne(id);
  }

  /**
   * Respond to notification (debtor)
   */
  async respond(id: string, data: RespondExtrajudicialNotificationDto, userId: string, clientIP?: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const newStatus = data.accepted ? 'RESOLVIDO' : 'RESPONDIDO';

    await this.prisma.extrajudicialNotification.update({
      where: { id: BigInt(id) },
      data: {
        status: newStatus,
        responseAt: new Date(),
        responseText: data.responseText,
        responseAccepted: data.accepted,
      },
    });

    await this.createAudit(id, 'RESPONDED', userId, clientIP, null, {
      accepted: data.accepted,
    });

    return this.findOne(id);
  }

  /**
   * Resolve notification
   */
  async resolve(id: string, data: ResolveExtrajudicialNotificationDto, userId: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.extrajudicialNotification.update({
      where: { id: BigInt(id) },
      data: {
        status: 'RESOLVIDO',
        resolvedAt: new Date(),
        resolvedBy: BigInt(userId),
        resolutionMethod: data.resolutionMethod,
        resolutionNotes: data.resolutionNotes,
      },
    });

    await this.createAudit(id, 'RESOLVED', userId, null, null, {
      method: data.resolutionMethod,
    });

    return this.findOne(id);
  }

  /**
   * Forward to judicial process
   */
  async forwardToJudicial(id: string, data: ForwardToJudicialDto, userId: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.extrajudicialNotification.update({
      where: { id: BigInt(id) },
      data: {
        status: 'ENCAMINHADO_JUDICIAL',
        judicialForwardedAt: new Date(),
        judicialProcessNumber: data.judicialProcessNumber,
        judicialCourt: data.judicialCourt,
        judicialNotes: data.judicialNotes,
      },
    });

    await this.createAudit(id, 'FORWARDED_TO_JUDICIAL', userId, null, null, {
      processNumber: data.judicialProcessNumber,
      court: data.judicialCourt,
    });

    return this.findOne(id);
  }

  /**
   * Cancel notification
   */
  async cancel(id: string, userId: string, reason?: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.status === 'ENCAMINHADO_JUDICIAL') {
      throw new ForbiddenException('Cannot cancel notification that was forwarded to judicial process');
    }

    await this.prisma.extrajudicialNotification.update({
      where: { id: BigInt(id) },
      data: {
        status: 'CANCELADO',
        notes: reason ? `${notification.notes || ''}\nCancelled: ${reason}` : notification.notes,
      },
    });

    await this.createAudit(id, 'CANCELLED', userId, null, null, { reason });

    return this.findOne(id);
  }

  /**
   * Delete notification (only drafts)
   */
  async remove(id: string) {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(id) },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.status !== 'RASCUNHO') {
      throw new ForbiddenException('Can only delete draft notifications');
    }

    // Delete audits first
    await this.prisma.extrajudicialNotificationAudit.deleteMany({
      where: { notificationId: BigInt(id) },
    });

    await this.prisma.extrajudicialNotification.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Notification deleted successfully' };
  }

  /**
   * Get statistics
   */
  async getStatistics(params: { agencyId?: string; createdById?: string }) {
    const { agencyId, createdById } = params;

    const where: any = {};
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (createdById) where.createdBy = BigInt(createdById);

    const [total, draft, generated, sent, viewed, responded, resolved, expired, judicial] = await Promise.all([
      this.prisma.extrajudicialNotification.count({ where }),
      this.prisma.extrajudicialNotification.count({ where: { ...where, status: 'RASCUNHO' } }),
      this.prisma.extrajudicialNotification.count({ where: { ...where, status: 'GERADO' } }),
      this.prisma.extrajudicialNotification.count({ where: { ...where, status: 'ENVIADO' } }),
      this.prisma.extrajudicialNotification.count({ where: { ...where, status: 'VISUALIZADO' } }),
      this.prisma.extrajudicialNotification.count({ where: { ...where, status: 'RESPONDIDO' } }),
      this.prisma.extrajudicialNotification.count({ where: { ...where, status: 'RESOLVIDO' } }),
      this.prisma.extrajudicialNotification.count({ where: { ...where, status: 'PRAZO_EXPIRADO' } }),
      this.prisma.extrajudicialNotification.count({ where: { ...where, status: 'ENCAMINHADO_JUDICIAL' } }),
    ]);

    return {
      total,
      draft,
      generated,
      sent,
      viewed,
      responded,
      resolved,
      expired,
      judicial,
    };
  }

  /**
   * Create audit entry
   */
  private async createAudit(
    notificationId: string,
    action: string,
    performedBy: string,
    clientIP?: string | null,
    userAgent?: string | null,
    details?: any,
  ) {
    await this.prisma.extrajudicialNotificationAudit.create({
      data: {
        notificationId: BigInt(notificationId),
        action,
        performedBy: BigInt(performedBy),
        details: details ? JSON.stringify(details) : null,
        clientIP: clientIP || null,
        userAgent: userAgent || null,
      },
    });
  }

  /**
   * Serialize notification for response
   */
  private serializeNotification(notification: any): any {
    const serialized: any = {
      ...notification,
      id: notification.id.toString(),
      contractId: notification.contractId?.toString() || null,
      propertyId: notification.propertyId.toString(),
      agreementId: notification.agreementId?.toString() || null,
      inspectionId: notification.inspectionId?.toString() || null,
      agencyId: notification.agencyId?.toString() || null,
      creditorId: notification.creditorId.toString(),
      debtorId: notification.debtorId.toString(),
      createdBy: notification.createdBy.toString(),
      resolvedBy: notification.resolvedBy?.toString() || null,
      principalAmount: notification.principalAmount?.toString() || null,
      fineAmount: notification.fineAmount?.toString() || null,
      interestAmount: notification.interestAmount?.toString() || null,
      correctionAmount: notification.correctionAmount?.toString() || null,
      lawyerFees: notification.lawyerFees?.toString() || null,
      totalAmount: notification.totalAmount?.toString() || null,
      deadlineDate: notification.deadlineDate?.toISOString() || null,
      sentAt: notification.sentAt?.toISOString() || null,
      deliveredAt: notification.deliveredAt?.toISOString() || null,
      viewedAt: notification.viewedAt?.toISOString() || null,
      responseAt: notification.responseAt?.toISOString() || null,
      creditorSignedAt: notification.creditorSignedAt?.toISOString() || null,
      debtorSignedAt: notification.debtorSignedAt?.toISOString() || null,
      witness1SignedAt: notification.witness1SignedAt?.toISOString() || null,
      witness2SignedAt: notification.witness2SignedAt?.toISOString() || null,
      pdfGeneratedAt: notification.pdfGeneratedAt?.toISOString() || null,
      resolvedAt: notification.resolvedAt?.toISOString() || null,
      judicialForwardedAt: notification.judicialForwardedAt?.toISOString() || null,
      createdAt: notification.createdAt?.toISOString() || null,
      updatedAt: notification.updatedAt?.toISOString() || null,
    };

    // Serialize relations
    if (notification.property) {
      serialized.property = {
        ...notification.property,
        id: notification.property.id.toString(),
      };
      if (notification.property.owner) {
        serialized.property.owner = {
          ...notification.property.owner,
          id: notification.property.owner.id.toString(),
        };
      }
      if (notification.property.tenant) {
        serialized.property.tenant = {
          ...notification.property.tenant,
          id: notification.property.tenant.id.toString(),
        };
      }
    }

    if (notification.contract) {
      serialized.contract = {
        ...notification.contract,
        id: notification.contract.id.toString(),
        monthlyRent: notification.contract.monthlyRent?.toString() || null,
      };
    }

    if (notification.agreement) {
      serialized.agreement = {
        ...notification.agreement,
        id: notification.agreement.id.toString(),
      };
    }

    if (notification.inspection) {
      serialized.inspection = {
        ...notification.inspection,
        id: notification.inspection.id.toString(),
      };
    }

    ['creditor', 'debtor', 'createdByUser', 'resolvedByUser'].forEach(rel => {
      if (notification[rel]) {
        serialized[rel] = {
          ...notification[rel],
          id: notification[rel].id.toString(),
        };
      }
    });

    if (notification.audits) {
      serialized.audits = notification.audits.map((a: any) => ({
        ...a,
        id: a.id.toString(),
        notificationId: a.notificationId.toString(),
        performedBy: a.performedBy.toString(),
        performedAt: a.performedAt?.toISOString() || null,
        details: a.details ? JSON.parse(a.details) : null,
      }));
    }

    return serialized;
  }
}
