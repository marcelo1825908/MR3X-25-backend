import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateInspectionDto, InspectionStatus } from './dto/create-inspection.dto';
import { UpdateInspectionDto, SignInspectionDto, ApproveRejectInspectionDto } from './dto/update-inspection.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingCycleService } from '../billing-cycle/billing-cycle.service';
import * as crypto from 'crypto';

@Injectable()
export class InspectionsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => BillingCycleService))
    private billingCycleService: BillingCycleService,
  ) {}

  private generateInspectionToken(): string {
    const year = new Date().getFullYear();
    const random1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const random2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `MR3X-VST-${year}-${random1}-${random2}`;
  }

  private hasSignatures(inspection: any): boolean {
    return !!(
      inspection.tenantSignature ||
      inspection.ownerSignature ||
      inspection.agencySignature ||
      inspection.inspectorSignature
    );
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    agencyId?: string;
    propertyId?: string;
    contractId?: string;
    type?: string;
    status?: string;
    inspectorId?: string;
    createdById?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    userRole?: string;
    userId?: string;
  }) {
    const {
      skip = 0,
      take = 10,
      agencyId,
      propertyId,
      contractId,
      type,
      status,
      inspectorId,
      createdById,
      startDate,
      endDate,
      search,
      userRole,
      userId,
    } = params;

    const where: any = {};

    if (agencyId) where.agencyId = BigInt(agencyId);
    if (propertyId) where.propertyId = BigInt(propertyId);
    if (contractId) where.contractId = BigInt(contractId);
    if (type) where.type = type;
    if (status) where.status = status;
    if (inspectorId) where.inspectorId = BigInt(inspectorId);
    if (createdById) where.createdBy = BigInt(createdById);

    // Role-based filtering: only show inspections for properties/contracts the user is responsible for
    let roleFilter: any = null;
    if (userRole === 'INQUILINO' && userId) {
      // Tenant only sees inspections that have been sent AND where they are the tenant
      where.sentAt = { not: null };
      // Note: Inspection doesn't have a direct contract relation, only contractId
      // So we filter through property.tenantId only
      roleFilter = [
        { property: { tenantId: BigInt(userId) } },
      ];
    } else if (userRole === 'PROPRIETARIO' && userId) {
      // Owner only sees inspections that have been sent AND where they are the owner
      where.sentAt = { not: null };
      // Note: Inspection doesn't have a direct contract relation, only contractId
      // So we filter through property.ownerId only
      roleFilter = [
        { property: { ownerId: BigInt(userId) } },
      ];
    } else if (userRole === 'BROKER' && userId) {
      // Brokers only see inspections for properties they are assigned to
      where.property = { brokerId: BigInt(userId) };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // Build final AND conditions
    const andConditions: any[] = [];

    if (roleFilter) {
      andConditions.push({ OR: roleFilter });
    }

    if (search && search.trim()) {
      andConditions.push({
        OR: [
          { property: { name: { contains: search.trim() } } },
          { property: { address: { contains: search.trim() } } },
          { inspector: { name: { contains: search.trim() } } },
          { notes: { contains: search.trim() } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [inspections, total] = await Promise.all([
      this.prisma.inspection.findMany({
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
            }
          },
          inspector: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          assignedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          template: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inspection.count({ where }),
    ]);

    return {
      data: inspections.map(i => this.serializeInspection(i)),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  async findOne(id: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          include: {
            owner: { select: { id: true, name: true, email: true, phone: true } },
            tenant: { select: { id: true, name: true, email: true, phone: true } },
          }
        },
        inspector: { select: { id: true, name: true, email: true, phone: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        template: true,
        items: true,
      },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    return this.serializeInspection(inspection);
  }

  async create(data: CreateInspectionDto, userId: string, assignedById?: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(data.propertyId) },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Only allow inspections for rented properties (ALUGADO)
    const propertyStatus = (property.status || '').toUpperCase().trim();
    if (propertyStatus !== 'ALUGADO' && propertyStatus !== 'RENTED') {
      throw new BadRequestException('Vistorias só podem ser criadas para imóveis alugados (status ALUGADO)');
    }

    if (data.contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: BigInt(data.contractId) },
      });

      if (!contract || contract.propertyId !== BigInt(data.propertyId)) {
        throw new BadRequestException('Contract not found or does not belong to this property');
      }
    }

    // Validate inspector: must be a broker (with CRECI) or engineer (with CREA)
    const inspector = await this.prisma.user.findUnique({
      where: { id: BigInt(data.inspectorId) },
      select: {
        id: true,
        role: true,
        creci: true,
        document: true,
      },
    });

    if (!inspector) {
      throw new NotFoundException('Inspector not found');
    }

    // Allow brokers (with CRECI) and engineers (with CREA - we'll check document/role)
    const isBroker = inspector.role === 'BROKER' && inspector.creci;
    const isEngineer = inspector.role === 'BUILDING_MANAGER' || (inspector.document && inspector.document.length > 11); // Engineers typically have longer documents
    
    // For now, allow any user with proper role, but log if missing CRECI/CREA
    if (inspector.role === 'BROKER' && !inspector.creci) {
      // Warning: broker without CRECI - but allow for now
      console.warn(`Warning: Inspector ${data.inspectorId} is a broker but has no CRECI registered`);
    }

    const token = this.generateInspectionToken();

    const inspection = await this.prisma.inspection.create({
      data: {
        propertyId: BigInt(data.propertyId),
        contractId: data.contractId ? BigInt(data.contractId) : null,
        agencyId: data.agencyId ? BigInt(data.agencyId) : property.agencyId,
        token: token,
        type: data.type,
        date: new Date(data.date),
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        inspectorId: BigInt(data.inspectorId),
        assignedById: assignedById ? BigInt(assignedById) : BigInt(userId),
        rooms: data.rooms || null,
        photos: data.photos || null,
        notes: data.notes || null,
        templateId: data.templateId ? BigInt(data.templateId) : null,
        location: data.location || null,
        status: 'RASCUNHO',
        createdBy: BigInt(userId),
      },
    });

    if (data.items && data.items.length > 0) {
      await this.prisma.inspectionItem.createMany({
        data: data.items.map(item => ({
          inspectionId: inspection.id,
          room: item.room,
          item: item.item,
          condition: item.condition,
          description: item.description || null,
          photos: item.photos ? JSON.stringify(item.photos) : null,
          needsRepair: item.needsRepair || false,
          repairCost: item.repairCost || null,
          responsible: item.responsible || null,
        })),
      });
    }

    // Track usage for billing
    if (inspection.agencyId) {
      try {
        await this.billingCycleService.trackUsage({
          agencyId: inspection.agencyId.toString(),
          feature: 'inspections',
          quantity: 1,
          referenceId: inspection.id.toString(),
          referenceType: 'inspection',
        });
      } catch (error) {
        // Log error but don't fail inspection creation
        console.error('Error tracking inspection usage:', error);
      }
    }

    return this.findOne(inspection.id.toString());
  }

  async update(id: string, data: UpdateInspectionDto) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(id) },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    if (inspection.status === 'APROVADA' || inspection.status === 'REJEITADA') {
      throw new ForbiddenException('Cannot update an approved or rejected inspection');
    }

    if (this.hasSignatures(inspection)) {
      throw new ForbiddenException(
        'Não é possível editar o termo de vistoria após a assinatura das partes. ' +
        'Isso garante a integridade do documento e previne fraudes.'
      );
    }

    const updateData: any = {};

    if (data.contractId !== undefined) updateData.contractId = data.contractId ? BigInt(data.contractId) : null;
    if (data.type) updateData.type = data.type;
    if (data.date) updateData.date = new Date(data.date);
    if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
    if (data.inspectorId) updateData.inspectorId = BigInt(data.inspectorId);
    if (data.rooms !== undefined) updateData.rooms = data.rooms;
    if (data.photos !== undefined) updateData.photos = data.photos;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status) updateData.status = data.status;
    if (data.templateId !== undefined) updateData.templateId = data.templateId ? BigInt(data.templateId) : null;
    if (data.location !== undefined) updateData.location = data.location;

    await this.prisma.inspection.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    if (data.items) {
      await this.prisma.inspectionItem.deleteMany({
        where: { inspectionId: BigInt(id) },
      });

      if (data.items.length > 0) {
        await this.prisma.inspectionItem.createMany({
          data: data.items.map(item => ({
            inspectionId: BigInt(id),
            room: item.room,
            item: item.item,
            condition: item.condition,
            description: item.description || null,
            photos: item.photos ? JSON.stringify(item.photos) : null,
            needsRepair: item.needsRepair || false,
            repairCost: item.repairCost || null,
            responsible: item.responsible || null,
          })),
        });
      }
    }

    return this.findOne(id);
  }

  async sign(id: string, data: SignInspectionDto, userId: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          include: {
            owner: true,
            tenant: true,
          }
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
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
    if (data.inspectorSignature) {
      updateData.inspectorSignature = data.inspectorSignature;
      updateData.inspectorSignedAt = now;
    }

    if (inspection.status === 'RASCUNHO' || inspection.status === 'EM_ANDAMENTO') {
      updateData.status = 'AGUARDANDO_ASSINATURA';
    }

    await this.prisma.inspection.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    // Create notification for inspection signature
    if (inspection.property?.ownerId && inspection.property?.tenantId && inspection.propertyId) {
      const propertyName = inspection.property?.name || inspection.property?.address || 'Imóvel';
      let signedByLabel = '';
      if (data.tenantSignature) signedByLabel = 'O Inquilino';
      else if (data.ownerSignature) signedByLabel = 'O Proprietário';
      else if (data.agencySignature) signedByLabel = 'A Agência';
      else if (data.inspectorSignature) signedByLabel = 'O Vistoriador';
      
      if (signedByLabel) {
        await this.notificationsService.createNotification({
          description: `${signedByLabel} assinou a vistoria - ${propertyName}`,
          ownerId: inspection.property.ownerId,
          tenantId: inspection.property.tenantId,
          propertyId: inspection.propertyId,
          agencyId: inspection.agencyId || undefined,
          type: 'inspection_signed',
          recurring: 'once',
          days: 0,
        });
      }
    }

    return this.findOne(id);
  }

  async approve(id: string, userId: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(id) },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    if (inspection.status === 'APROVADA') {
      throw new BadRequestException('Inspection is already approved');
    }

    await this.prisma.inspection.update({
      where: { id: BigInt(id) },
      data: {
        status: 'APROVADA',
        approvedById: BigInt(userId),
        approvedAt: new Date(),
      },
    });

    return this.findOne(id);
  }

  async reject(id: string, userId: string, data: ApproveRejectInspectionDto) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(id) },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    if (inspection.status === 'REJEITADA') {
      throw new BadRequestException('Inspection is already rejected');
    }

    if (!data.rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    await this.prisma.inspection.update({
      where: { id: BigInt(id) },
      data: {
        status: 'REJEITADA',
        approvedById: BigInt(userId),
        approvedAt: new Date(),
        rejectionReason: data.rejectionReason,
      },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(id) },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    // Allow deletion of approved inspections for historical cleanup
    // Removed restriction to allow deletion in any status

    await this.prisma.inspectionItem.deleteMany({
      where: { inspectionId: BigInt(id) },
    });

    await this.prisma.inspection.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Inspection deleted successfully' };
  }

  async updateStatus(id: string, status: InspectionStatus) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(id) },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    await this.prisma.inspection.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    return this.findOne(id);
  }

  async sendInspection(id: string, userId: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: {
          include: {
            owner: true,
            tenant: true,
          }
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    if (inspection.sentAt) {
      throw new BadRequestException('Inspection has already been sent');
    }

    await this.prisma.inspection.update({
      where: { id: BigInt(id) },
      data: {
        sentAt: new Date(),
        sentById: BigInt(userId),
        status: inspection.status === 'RASCUNHO' ? 'EM_ANDAMENTO' : inspection.status,
      },
    });

    // Create notification for tenant and owner when inspection is sent
    if (inspection.property?.ownerId && inspection.property?.tenantId && inspection.propertyId) {
      const propertyName = inspection.property?.name || inspection.property?.address || 'Imóvel';
      await this.notificationsService.createNotification({
        description: `Nova vistoria enviada para assinatura - ${propertyName}`,
        ownerId: inspection.property.ownerId,
        tenantId: inspection.property.tenantId,
        propertyId: inspection.propertyId,
        agencyId: inspection.agencyId || undefined,
        type: 'inspection',
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

    const templates = await this.prisma.inspectionTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return templates.map(t => this.serializeTemplate(t));
  }

  async findOneTemplate(id: string) {
    const template = await this.prisma.inspectionTemplate.findUnique({
      where: { id: BigInt(id) },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.serializeTemplate(template);
  }

  async createTemplate(data: any, userId: string) {
    const template = await this.prisma.inspectionTemplate.create({
      data: {
        name: data.name,
        description: data.description || null,
        type: data.type,
        rooms: data.rooms,
        agencyId: data.agencyId ? BigInt(data.agencyId) : null,
        createdBy: BigInt(userId),
        isDefault: data.isDefault || false,
      },
    });

    return this.serializeTemplate(template);
  }

  async updateTemplate(id: string, data: any) {
    const template = await this.prisma.inspectionTemplate.findUnique({
      where: { id: BigInt(id) },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const updated = await this.prisma.inspectionTemplate.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        rooms: data.rooms,
        isDefault: data.isDefault,
        isActive: data.isActive,
      },
    });

    return this.serializeTemplate(updated);
  }

  async removeTemplate(id: string) {
    const template = await this.prisma.inspectionTemplate.findUnique({
      where: { id: BigInt(id) },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.inspectionTemplate.update({
      where: { id: BigInt(id) },
      data: { isActive: false },
    });

    return { message: 'Template deleted successfully' };
  }

  async getStatistics(params: { agencyId?: string; createdById?: string }) {
    const { agencyId, createdById } = params;

    const where: any = {};
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (createdById) where.createdBy = BigInt(createdById);

    const [total, pending, inProgress, completed, approved] = await Promise.all([
      this.prisma.inspection.count({ where }),
      this.prisma.inspection.count({ where: { ...where, status: 'RASCUNHO' } }),
      this.prisma.inspection.count({ where: { ...where, status: 'EM_ANDAMENTO' } }),
      this.prisma.inspection.count({ where: { ...where, status: 'CONCLUIDA' } }),
      this.prisma.inspection.count({ where: { ...where, status: 'APROVADA' } }),
    ]);

    return {
      total,
      pending,
      inProgress,
      completed,
      approved,
    };
  }

  private serializeInspection(inspection: any) {
    const serialized: any = {
      ...inspection,
      id: inspection.id.toString(),
      token: inspection.token || null,
      propertyId: inspection.propertyId.toString(),
      contractId: inspection.contractId?.toString() || null,
      agencyId: inspection.agencyId?.toString() || null,
      inspectorId: inspection.inspectorId.toString(),
      assignedById: inspection.assignedById?.toString() || null,
      approvedById: inspection.approvedById?.toString() || null,
      templateId: inspection.templateId?.toString() || null,
      createdBy: inspection.createdBy?.toString() || null,
      date: inspection.date?.toISOString() || null,
      scheduledDate: inspection.scheduledDate?.toISOString() || null,
      sentAt: inspection.sentAt?.toISOString() || null,
      sentById: inspection.sentById?.toString() || null,
      tenantSignedAt: inspection.tenantSignedAt?.toISOString() || null,
      ownerSignedAt: inspection.ownerSignedAt?.toISOString() || null,
      agencySignedAt: inspection.agencySignedAt?.toISOString() || null,
      inspectorSignedAt: inspection.inspectorSignedAt?.toISOString() || null,
      reportGeneratedAt: inspection.reportGeneratedAt?.toISOString() || null,
      approvedAt: inspection.approvedAt?.toISOString() || null,
      createdAt: inspection.createdAt?.toISOString() || null,
      updatedAt: inspection.updatedAt?.toISOString() || null,
      hasSignatures: this.hasSignatures(inspection),
    };

    if (inspection.property) {
      serialized.property = {
        ...inspection.property,
        id: inspection.property.id.toString(),
        ownerId: inspection.property.ownerId?.toString() || null,
        agencyId: inspection.property.agencyId?.toString() || null,
        brokerId: inspection.property.brokerId?.toString() || null,
        tenantId: inspection.property.tenantId?.toString() || null,
        createdBy: inspection.property.createdBy?.toString() || null,
      };

      if (inspection.property.owner) {
        serialized.property.owner = {
          ...inspection.property.owner,
          id: inspection.property.owner.id.toString(),
        };
      }
      if (inspection.property.tenant) {
        serialized.property.tenant = {
          ...inspection.property.tenant,
          id: inspection.property.tenant.id.toString(),
        };
      }
    }

    ['inspector', 'assignedBy', 'approvedBy', 'createdByUser'].forEach(rel => {
      if (inspection[rel]) {
        serialized[rel] = {
          ...inspection[rel],
          id: inspection[rel].id.toString(),
        };
      }
    });

    if (inspection.template) {
      serialized.template = {
        ...inspection.template,
        id: inspection.template.id.toString(),
        agencyId: inspection.template.agencyId?.toString() || null,
        createdBy: inspection.template.createdBy?.toString() || null,
      };
    }

    if (inspection.items && Array.isArray(inspection.items)) {
      serialized.items = inspection.items.map((item: any) => ({
        ...item,
        id: item.id.toString(),
        inspectionId: item.inspectionId.toString(),
        repairCost: item.repairCost?.toString() || null,
        photos: item.photos ? JSON.parse(item.photos) : [],
      }));
    }

    return serialized;
  }

  private serializeTemplate(template: any) {
    return {
      ...template,
      id: template.id.toString(),
      agencyId: template.agencyId?.toString() || null,
      createdBy: template.createdBy?.toString() || null,
      rooms: template.rooms ? (typeof template.rooms === 'string' ? JSON.parse(template.rooms) : template.rooms) : [],
      createdAt: template.createdAt?.toISOString() || null,
      updatedAt: template.updatedAt?.toISOString() || null,
    };
  }
}
