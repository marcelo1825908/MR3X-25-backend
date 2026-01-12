import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateAgreementDto, AgreementStatus } from './dto/create-agreement.dto';
import { UpdateAgreementDto, SignAgreementDto, ApproveRejectAgreementDto } from './dto/update-agreement.dto';
import * as crypto from 'crypto';
import { UserContext } from './services/agreement-permission.service';
import {
  isEditableStatus,
  isDeletableStatus,
  hasBeenSigned,
  isImmutableStatus,
  AgreementStatusValue,
} from './constants/agreement-permissions.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingCycleService } from '../billing-cycle/billing-cycle.service';

@Injectable()
export class AgreementsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => BillingCycleService))
    private billingCycleService: BillingCycleService,
  ) {}

  private generateAgreementToken(): string {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `MR3X-AGR-${year}-${random}`;
  }

  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    agencyId?: string;
    propertyId?: string;
    contractId?: string;
    type?: string;
    status?: string;
    tenantId?: string;
    ownerId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    accessFilter?: any;
    userContext?: UserContext;
  }) {
    const {
      skip = 0,
      take = 10,
      agencyId,
      propertyId,
      contractId,
      type,
      status,
      tenantId,
      ownerId,
      startDate,
      endDate,
      search,
      accessFilter,
      userContext,
    } = params;

    const where: any = accessFilter ? { ...accessFilter } : {};

    if (agencyId) {
      where.agencyId = BigInt(agencyId);
    }
    if (propertyId) where.propertyId = BigInt(propertyId);
    if (contractId) where.contractId = BigInt(contractId);
    if (type) where.type = type;
    if (status) where.status = status;
    if (tenantId) where.tenantId = BigInt(tenantId);
    if (ownerId) where.ownerId = BigInt(ownerId);

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { property: { name: { contains: search.trim() } } },
        { property: { address: { contains: search.trim() } } },
        { tenant: { name: { contains: search.trim() } } },
        { owner: { name: { contains: search.trim() } } },
      ];
    }

    const [agreements, total] = await Promise.all([
      this.prisma.agreement.findMany({
        where,
        skip,
        take,
        include: {
          property: {
            select: {
              id: true,
              address: true,
              city: true,
              neighborhood: true,
              name: true,
              ownerId: true,
              agencyId: true,
              brokerId: true,
              tenantId: true,
            }
          },
          contract: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
            }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agreement.count({ where }),
    ]);

    return {
      data: agreements.map(a => this.serializeAgreement(a)),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  async findOne(id: string) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          include: {
            owner: { select: { id: true, name: true, email: true, phone: true } },
            tenant: { select: { id: true, name: true, email: true, phone: true } },
          }
        },
        contract: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            monthlyRent: true,
            tenantUser: { select: { id: true, name: true, email: true } },
            ownerUser: { select: { id: true, name: true, email: true } },
          }
        },
        tenant: { select: { id: true, name: true, email: true, phone: true, document: true } },
        owner: { select: { id: true, name: true, email: true, phone: true, document: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    return this.serializeAgreement(agreement);
  }

  async create(data: CreateAgreementDto, userId: string, clientIP?: string, userAgent?: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(data.propertyId) },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Only allow agreements for rented properties (ALUGADO)
    const propertyStatus = (property.status || '').toUpperCase().trim();
    if (propertyStatus !== 'ALUGADO' && propertyStatus !== 'RENTED') {
      throw new BadRequestException('Acordos só podem ser criados para imóveis alugados (status ALUGADO)');
    }

    if (data.contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: BigInt(data.contractId) },
      });

      if (!contract || contract.propertyId !== BigInt(data.propertyId)) {
        throw new BadRequestException('Contract not found or does not belong to this property');
      }
    }

    const agreementToken = this.generateAgreementToken();
    const contentToHash = `${data.title}|${data.type}|${data.propertyId}|${Date.now()}`;
    const agreementHash = this.generateHash(contentToHash);

    const agreement = await this.prisma.agreement.create({
      data: {
        contractId: data.contractId ? BigInt(data.contractId) : null,
        propertyId: BigInt(data.propertyId),
        agencyId: data.agencyId ? BigInt(data.agencyId) : property.agencyId,
        type: data.type,
        title: data.title,
        description: data.description || null,
        content: data.content || null,
        templateId: data.templateId || null,
        tenantId: data.tenantId ? BigInt(data.tenantId) : null,
        ownerId: data.ownerId ? BigInt(data.ownerId) : property.ownerId,
        originalAmount: data.originalAmount || null,
        negotiatedAmount: data.negotiatedAmount || null,
        fineAmount: data.fineAmount || null,
        interestPercent: data.interestPercent || null,
        interestAmount: data.interestAmount || null,
        // Auto-calculate interest if percent is provided but amount is not
        // Auto-calculate fine if percent is provided (we'll need to add finePercent to DTO)
        discountAmount: data.discountAmount || null,
        installments: data.installments || null,
        installmentValue: data.installmentValue || null,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
        newDueDate: data.newDueDate ? new Date(data.newDueDate) : null,
        moveOutDate: data.moveOutDate ? new Date(data.moveOutDate) : null,
        notes: data.notes || null,
        attachments: data.attachments || null,
        agreementToken,
        agreementHash,
        clientIP: clientIP || null,
        userAgent: userAgent || null,
        status: 'RASCUNHO',
        createdBy: BigInt(userId),
      },
    });

    // Track usage for billing
    if (agreement.agencyId) {
      try {
        await this.billingCycleService.trackUsage({
          agencyId: agreement.agencyId.toString(),
          feature: 'settlements',
          quantity: 1,
          referenceId: agreement.id.toString(),
          referenceType: 'agreement',
        });
      } catch (error) {
        // Log error but don't fail agreement creation
        console.error('Error tracking agreement usage:', error);
      }
    }

    return this.findOne(agreement.id.toString());
  }

  async update(id: string, data: UpdateAgreementDto, user?: any) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (!isEditableStatus(agreement.status)) {
      throw new ForbiddenException(
        `Agreement in status '${agreement.status}' cannot be edited. Only drafts and agreements awaiting signature can be modified.`
      );
    }

    if (isImmutableStatus(agreement.status)) {
      throw new ForbiddenException('Cannot update a completed or rejected agreement');
    }

    const updateData: any = {};

    if (data.contractId !== undefined) updateData.contractId = data.contractId ? BigInt(data.contractId) : null;
    if (data.type) updateData.type = data.type;
    if (data.title) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId ? BigInt(data.tenantId) : null;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId ? BigInt(data.ownerId) : null;
    if (data.originalAmount !== undefined) updateData.originalAmount = data.originalAmount;
    if (data.negotiatedAmount !== undefined) updateData.negotiatedAmount = data.negotiatedAmount;
    if (data.fineAmount !== undefined) updateData.fineAmount = data.fineAmount;
    if (data.interestPercent !== undefined) updateData.interestPercent = data.interestPercent;
    if (data.interestAmount !== undefined) updateData.interestAmount = data.interestAmount;
    // Auto-calculate interest if percent is provided but amount is not
    if (data.interestPercent !== undefined && data.interestPercent > 0 && !data.interestAmount && agreement.originalAmount) {
      const baseAmount = Number(agreement.originalAmount);
      const daysOverdue = agreement.effectiveDate 
        ? Math.max(0, Math.floor((new Date().getTime() - new Date(agreement.effectiveDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const monthlyRate = Number(data.interestPercent) / 100;
      const dailyRate = monthlyRate / 30;
      updateData.interestAmount = Math.round((baseAmount * dailyRate * daysOverdue) * 100) / 100;
    }
    if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
    if (data.installments !== undefined) updateData.installments = data.installments;
    if (data.installmentValue !== undefined) updateData.installmentValue = data.installmentValue;
    if (data.effectiveDate !== undefined) updateData.effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : null;
    if (data.expirationDate !== undefined) updateData.expirationDate = data.expirationDate ? new Date(data.expirationDate) : null;
    if (data.newDueDate !== undefined) updateData.newDueDate = data.newDueDate ? new Date(data.newDueDate) : null;
    if (data.moveOutDate !== undefined) updateData.moveOutDate = data.moveOutDate ? new Date(data.moveOutDate) : null;
    if (data.status) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.attachments !== undefined) updateData.attachments = data.attachments;
    if (data.asaasPaymentId !== undefined) updateData.asaasPaymentId = data.asaasPaymentId;
    if (data.asaasPaymentLink !== undefined) updateData.asaasPaymentLink = data.asaasPaymentLink;
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;

    await this.prisma.agreement.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    return this.findOne(id);
  }

  async sign(id: string, data: SignAgreementDto, userId: string, clientIP?: string, userAgent?: string) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          select: {
            id: true,
            ownerId: true,
            tenantId: true,
            name: true,
            address: true,
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (agreement.status !== AgreementStatusValue.RASCUNHO &&
        agreement.status !== AgreementStatusValue.AGUARDANDO_ASSINATURA) {
      throw new ForbiddenException(`Agreement in status '${agreement.status}' cannot be signed`);
    }

    const now = new Date();
    const updateData: any = {};
    let signedBy: 'tenant' | 'owner' | 'agency' | null = null;

    if (data.tenantSignature) {
      updateData.tenantSignature = data.tenantSignature;
      updateData.tenantSignedAt = now;
      signedBy = 'tenant';
    }
    if (data.ownerSignature) {
      updateData.ownerSignature = data.ownerSignature;
      updateData.ownerSignedAt = now;
      signedBy = 'owner';
    }
    if (data.agencySignature) {
      updateData.agencySignature = data.agencySignature;
      updateData.agencySignedAt = now;
      signedBy = 'agency';
    }

    if (clientIP) updateData.clientIP = clientIP;
    if (userAgent) updateData.userAgent = userAgent;

    await this.prisma.agreement.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    const updated = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
    });

    // Update status to ASSINADO based on signatures
    // For agreements with agency: need tenant + agency signatures
    // For agreements without agency (independent owner): need tenant + owner signatures
    if (updated?.agencyId) {
      // Agreement with agency - requires tenant and agency signatures
      if (updated?.tenantSignature && updated?.agencySignature) {
        await this.prisma.agreement.update({
          where: { id: BigInt(id) },
          data: { status: 'ASSINADO' },
        });
      }
    } else {
      // Agreement without agency (independent owner) - requires tenant and owner signatures
      if (updated?.tenantSignature && updated?.ownerSignature) {
        await this.prisma.agreement.update({
          where: { id: BigInt(id) },
          data: { status: 'ASSINADO' },
        });
      }
    }

    // Send notifications to other parties about the signature
    const ownerId = agreement.ownerId || agreement.property?.ownerId;
    const tenantId = agreement.tenantId || agreement.property?.tenantId;
    const propertyName = agreement.property?.name || agreement.property?.address || 'Imóvel';

    if (ownerId && tenantId && agreement.propertyId) {
      let notificationDescription = '';

      if (signedBy === 'tenant') {
        notificationDescription = `O Inquilino assinou o acordo "${agreement.title}" - ${propertyName}`;
      } else if (signedBy === 'owner') {
        notificationDescription = `O Proprietário assinou o acordo "${agreement.title}" - ${propertyName}`;
      } else if (signedBy === 'agency') {
        notificationDescription = `A Agência assinou o acordo "${agreement.title}" - ${propertyName}`;
      }

      if (notificationDescription) {
        await this.notificationsService.createNotification({
          description: notificationDescription,
          ownerId: ownerId,
          tenantId: tenantId,
          propertyId: agreement.propertyId,
          agencyId: agreement.agencyId || undefined,
          type: 'agreement_signed',
          recurring: 'once',
          days: 0,
        });
      }
    }

    return this.findOne(id);
  }

  async approve(id: string, userId: string) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          select: {
            id: true,
            ownerId: true,
            tenantId: true,
            name: true,
            address: true,
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (agreement.status === 'CONCLUIDO') {
      throw new BadRequestException('Agreement is already completed');
    }

    await this.prisma.agreement.update({
      where: { id: BigInt(id) },
      data: {
        status: 'CONCLUIDO',
        approvedById: BigInt(userId),
        approvedAt: new Date(),
      },
    });

    // Send notification to tenant and owner about completion
    const ownerId = agreement.ownerId || agreement.property?.ownerId;
    const tenantId = agreement.tenantId || agreement.property?.tenantId;
    const propertyName = agreement.property?.name || agreement.property?.address || 'Imóvel';

    if (ownerId && tenantId && agreement.propertyId) {
      await this.notificationsService.createNotification({
        description: `O acordo "${agreement.title}" foi concluído - ${propertyName}`,
        ownerId: ownerId,
        tenantId: tenantId,
        propertyId: agreement.propertyId,
        agencyId: agreement.agencyId || undefined,
        type: 'agreement_completed',
        recurring: 'once',
        days: 0,
      });
    }

    return this.findOne(id);
  }

  async reject(id: string, userId: string, data: ApproveRejectAgreementDto) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          select: {
            id: true,
            ownerId: true,
            tenantId: true,
            name: true,
            address: true,
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (agreement.status === 'REJEITADO') {
      throw new BadRequestException('Agreement is already rejected');
    }

    if (!data.rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    await this.prisma.agreement.update({
      where: { id: BigInt(id) },
      data: {
        status: 'REJEITADO',
        approvedById: BigInt(userId),
        approvedAt: new Date(),
        rejectionReason: data.rejectionReason,
      },
    });

    // Send notification to tenant and owner about rejection
    const ownerId = agreement.ownerId || agreement.property?.ownerId;
    const tenantId = agreement.tenantId || agreement.property?.tenantId;
    const propertyName = agreement.property?.name || agreement.property?.address || 'Imóvel';

    if (ownerId && tenantId && agreement.propertyId) {
      await this.notificationsService.createNotification({
        description: `O acordo "${agreement.title}" foi rejeitado: ${data.rejectionReason} - ${propertyName}`,
        ownerId: ownerId,
        tenantId: tenantId,
        propertyId: agreement.propertyId,
        agencyId: agreement.agencyId || undefined,
        type: 'agreement_rejected',
        recurring: 'once',
        days: 0,
      });
    }

    return this.findOne(id);
  }

  async cancel(id: string, userId: string) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (agreement.status === 'CONCLUIDO') {
      throw new ForbiddenException('Cannot cancel a completed agreement');
    }

    await this.prisma.agreement.update({
      where: { id: BigInt(id) },
      data: {
        status: 'CANCELADO',
      },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (!isDeletableStatus(agreement.status)) {
      throw new ForbiddenException(
        `Agreement in status '${agreement.status}' cannot be deleted. Only drafts can be deleted.`
      );
    }

    if (hasBeenSigned(agreement)) {
      throw new ForbiddenException(
        'Agreements that have been signed by any party cannot be deleted'
      );
    }

    await this.prisma.agreement.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Agreement deleted successfully' };
  }

  async updateStatus(id: string, status: AgreementStatus) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (isImmutableStatus(agreement.status)) {
      throw new ForbiddenException(
        `Cannot change status of agreement in '${agreement.status}' state`
      );
    }

    await this.prisma.agreement.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    return this.findOne(id);
  }

  async sendForSignature(id: string) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          select: {
            id: true,
            ownerId: true,
            tenantId: true,
            name: true,
            address: true,
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (agreement.status !== 'RASCUNHO') {
      throw new BadRequestException('Only draft agreements can be sent for signature');
    }

    await this.prisma.agreement.update({
      where: { id: BigInt(id) },
      data: { status: 'AGUARDANDO_ASSINATURA' },
    });

    // Create notifications for tenant and owner
    // Use agreement's direct tenantId/ownerId, fallback to property's
    const ownerId = agreement.ownerId || agreement.property?.ownerId;
    const tenantId = agreement.tenantId || agreement.property?.tenantId;

    if (ownerId && tenantId && agreement.propertyId) {
      const propertyName = agreement.property?.name || agreement.property?.address || 'Imóvel';
      const notificationDescription = `Novo acordo "${agreement.title}" enviado para assinatura - ${propertyName}`;

      await this.notificationsService.createNotification({
        description: notificationDescription,
        ownerId: ownerId,
        tenantId: tenantId,
        propertyId: agreement.propertyId,
        agencyId: agreement.agencyId || undefined,
        type: 'agreement',
        recurring: 'once',
        days: 0,
      });
    }

    return this.findOne(id);
  }

  async findAllTemplates(params: { agencyId?: string; type?: string; isDefault?: boolean }) {
    const { agencyId, type, isDefault } = params;

    const where: any = { isActive: true };
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (type) where.type = type;
    if (isDefault !== undefined) where.isDefault = isDefault;

    const templates = await this.prisma.agreementTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return templates.map(t => this.serializeTemplate(t));
  }

  async findOneTemplate(id: string) {
    const template = await this.prisma.agreementTemplate.findUnique({
      where: { id: BigInt(id) },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.serializeTemplate(template);
  }

  async createTemplate(data: any, userId: string) {
    const template = await this.prisma.agreementTemplate.create({
      data: {
        name: data.name,
        description: data.description || null,
        type: data.type,
        content: data.content,
        agencyId: data.agencyId ? BigInt(data.agencyId) : null,
        createdBy: BigInt(userId),
        isDefault: data.isDefault || false,
      },
    });

    return this.serializeTemplate(template);
  }

  async updateTemplate(id: string, data: any) {
    const template = await this.prisma.agreementTemplate.findUnique({
      where: { id: BigInt(id) },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const updated = await this.prisma.agreementTemplate.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        content: data.content,
        isDefault: data.isDefault,
        isActive: data.isActive,
      },
    });

    return this.serializeTemplate(updated);
  }

  async removeTemplate(id: string) {
    const template = await this.prisma.agreementTemplate.findUnique({
      where: { id: BigInt(id) },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.agreementTemplate.update({
      where: { id: BigInt(id) },
      data: { isActive: false },
    });

    return { message: 'Template deleted successfully' };
  }

  async getStatistics(params: { accessFilter?: any }) {
    const { accessFilter } = params;

    const where: any = accessFilter ? { ...accessFilter } : {};

    const [total, draft, awaitingSignature, signed, completed, rejected, cancelled] = await Promise.all([
      this.prisma.agreement.count({ where }),
      this.prisma.agreement.count({ where: { ...where, status: 'RASCUNHO' } }),
      this.prisma.agreement.count({ where: { ...where, status: 'AGUARDANDO_ASSINATURA' } }),
      this.prisma.agreement.count({ where: { ...where, status: 'ASSINADO' } }),
      this.prisma.agreement.count({ where: { ...where, status: 'CONCLUIDO' } }),
      this.prisma.agreement.count({ where: { ...where, status: 'REJEITADO' } }),
      this.prisma.agreement.count({ where: { ...where, status: 'CANCELADO' } }),
    ]);

    return {
      total,
      draft,
      awaitingSignature,
      signed,
      completed,
      rejected,
      cancelled,
    };
  }

  private serializeAgreement(agreement: any) {
    const serialized: any = {
      ...agreement,
      id: agreement.id.toString(),
      contractId: agreement.contractId?.toString() || null,
      propertyId: agreement.propertyId.toString(),
      agencyId: agreement.agencyId?.toString() || null,
      tenantId: agreement.tenantId?.toString() || null,
      ownerId: agreement.ownerId?.toString() || null,
      approvedById: agreement.approvedById?.toString() || null,
      createdBy: agreement.createdBy?.toString() || null,
      originalAmount: agreement.originalAmount?.toString() || null,
      negotiatedAmount: agreement.negotiatedAmount?.toString() || null,
      fineAmount: agreement.fineAmount?.toString() || null,
      discountAmount: agreement.discountAmount?.toString() || null,
      installmentValue: agreement.installmentValue?.toString() || null,
      effectiveDate: agreement.effectiveDate?.toISOString() || null,
      expirationDate: agreement.expirationDate?.toISOString() || null,
      newDueDate: agreement.newDueDate?.toISOString() || null,
      moveOutDate: agreement.moveOutDate?.toISOString() || null,
      tenantSignedAt: agreement.tenantSignedAt?.toISOString() || null,
      ownerSignedAt: agreement.ownerSignedAt?.toISOString() || null,
      agencySignedAt: agreement.agencySignedAt?.toISOString() || null,
      approvedAt: agreement.approvedAt?.toISOString() || null,
      createdAt: agreement.createdAt?.toISOString() || null,
      updatedAt: agreement.updatedAt?.toISOString() || null,
    };

    if (agreement.property) {
      serialized.property = {
        ...agreement.property,
        id: agreement.property.id.toString(),
        ownerId: agreement.property.ownerId?.toString() || null,
        agencyId: agreement.property.agencyId?.toString() || null,
        brokerId: agreement.property.brokerId?.toString() || null,
        tenantId: agreement.property.tenantId?.toString() || null,
      };

      if (agreement.property.owner) {
        serialized.property.owner = {
          ...agreement.property.owner,
          id: agreement.property.owner.id.toString(),
        };
      }
      if (agreement.property.tenant) {
        serialized.property.tenant = {
          ...agreement.property.tenant,
          id: agreement.property.tenant.id.toString(),
        };
      }
    }

    if (agreement.contract) {
      serialized.contract = {
        ...agreement.contract,
        id: agreement.contract.id.toString(),
        monthlyRent: agreement.contract.monthlyRent?.toString() || null,
        startDate: agreement.contract.startDate?.toISOString() || null,
        endDate: agreement.contract.endDate?.toISOString() || null,
      };

      if (agreement.contract.tenantUser) {
        serialized.contract.tenantUser = {
          ...agreement.contract.tenantUser,
          id: agreement.contract.tenantUser.id.toString(),
        };
      }
      if (agreement.contract.ownerUser) {
        serialized.contract.ownerUser = {
          ...agreement.contract.ownerUser,
          id: agreement.contract.ownerUser.id.toString(),
        };
      }
    }

    ['tenant', 'owner', 'approvedBy', 'createdByUser'].forEach(rel => {
      if (agreement[rel]) {
        serialized[rel] = {
          ...agreement[rel],
          id: agreement[rel].id.toString(),
        };
      }
    });

    return serialized;
  }

  private serializeTemplate(template: any) {
    return {
      ...template,
      id: template.id.toString(),
      agencyId: template.agencyId?.toString() || null,
      createdBy: template.createdBy?.toString() || null,
      createdAt: template.createdAt?.toISOString() || null,
      updatedAt: template.updatedAt?.toISOString() || null,
    };
  }
}
