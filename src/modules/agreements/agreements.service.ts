import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class AgreementsService {
  constructor(private prisma: PrismaService) {}

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
    accessFilter?: any;      // Permission-based filter from AgreementPermissionService
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
      accessFilter,
      userContext,
    } = params;

    // Start with permission-based filter
    const where: any = accessFilter ? { ...accessFilter } : {};

    // Apply additional filters (these narrow down the permission-based results)
    if (agencyId) {
      // Only apply if user has permission to view this agency's data
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
    // Validate property exists
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(data.propertyId) },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // If contract is provided, validate it exists and belongs to the property
    if (data.contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: BigInt(data.contractId) },
      });

      if (!contract || contract.propertyId !== BigInt(data.propertyId)) {
        throw new BadRequestException('Contract not found or does not belong to this property');
      }
    }

    // Generate token and hash
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

    return this.findOne(agreement.id.toString());
  }

  async update(id: string, data: UpdateAgreementDto, user?: any) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    // Check status-based restrictions
    if (!isEditableStatus(agreement.status)) {
      throw new ForbiddenException(
        `Agreement in status '${agreement.status}' cannot be edited. Only drafts and agreements awaiting signature can be modified.`
      );
    }

    // Check if immutable
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
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    // Check if agreement can be signed
    if (agreement.status !== AgreementStatusValue.RASCUNHO &&
        agreement.status !== AgreementStatusValue.AGUARDANDO_ASSINATURA) {
      throw new ForbiddenException(`Agreement in status '${agreement.status}' cannot be signed`);
    }

    const now = new Date();
    const updateData: any = {};

    if (data.tenantSignature) {
      updateData.tenantSignature = data.tenantSignature;
      updateData.tenantSignedAt = now;
    }
    if (data.ownerSignature) {
      updateData.ownerSignature = data.ownerSignature;
      updateData.ownerSignedAt = now;
    }
    if (data.agencySignature) {
      updateData.agencySignature = data.agencySignature;
      updateData.agencySignedAt = now;
    }

    // Store client information for audit
    if (clientIP) updateData.clientIP = clientIP;
    if (userAgent) updateData.userAgent = userAgent;

    // Update status to awaiting signature if it was in draft
    if (agreement.status === 'RASCUNHO') {
      updateData.status = 'AGUARDANDO_ASSINATURA';
    }

    await this.prisma.agreement.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    // Check if all required signatures are present and update status
    const updated = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
    });

    // If tenant and agency signed (minimum required), mark as signed
    if (updated?.tenantSignature && updated?.agencySignature) {
      await this.prisma.agreement.update({
        where: { id: BigInt(id) },
        data: { status: 'ASSINADO' },
      });
    }

    return this.findOne(id);
  }

  async approve(id: string, userId: string) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
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

    return this.findOne(id);
  }

  async reject(id: string, userId: string, data: ApproveRejectAgreementDto) {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(id) },
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

    // Check if agreement is in deletable status
    if (!isDeletableStatus(agreement.status)) {
      throw new ForbiddenException(
        `Agreement in status '${agreement.status}' cannot be deleted. Only drafts can be deleted.`
      );
    }

    // Check if agreement has been signed (prevents deletion even in draft)
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

    // Validate status transition
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

    // TODO: Send notification to parties for signature

    return this.findOne(id);
  }

  // Templates methods
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

  // Statistics for dashboard
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

    // Serialize property
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

    // Serialize contract
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

    // Serialize user relations
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
