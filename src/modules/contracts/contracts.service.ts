import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlanEnforcementService, PLAN_MESSAGES } from '../plans/plan-enforcement.service';

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private planEnforcement: PlanEnforcementService,
  ) {}

  async findAll(params: { skip?: number; take?: number; agencyId?: string; status?: string; createdById?: string; userId?: string }) {
    const { skip = 0, take = 20, agencyId, status, createdById, userId } = params;

    const where: any = { deleted: false };
    if (status) where.status = status;

    // Build filter conditions
    if (agencyId) {
      // Filter by agency
      where.agencyId = BigInt(agencyId);
    } else if (createdById) {
      // Filter by property creator for ADMIN/INDEPENDENT_OWNER users
      where.property = { createdBy: BigInt(createdById) };
    } else if (userId) {
      // Fallback: show contracts where user is owner, or property was created by user
      where.OR = [
        { ownerId: BigInt(userId) },
        { property: { createdBy: BigInt(userId) } },
        { property: { ownerId: BigInt(userId) } },
      ];
    }

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take,
        include: {
          property: { select: { id: true, address: true, city: true, name: true, neighborhood: true } },
          tenantUser: { select: { id: true, name: true, email: true, phone: true } },
          ownerUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      data: contracts.map(c => this.serializeContract(c)),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
        agency: true,
        payments: { orderBy: { dataPagamento: 'desc' }, take: 10 },
      },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    return this.serializeContract(contract);
  }

  async create(data: any, userId: string, userAgencyId?: string) {
    // Check if the property is frozen
    const propertyCheck = await this.planEnforcement.checkContractOperationAllowed(data.propertyId);
    if (!propertyCheck.allowed) {
      throw new ForbiddenException(propertyCheck.message || PLAN_MESSAGES.CONTRACT_ON_FROZEN_PROPERTY);
    }

    // Get property to auto-populate ownerId and agencyId
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(data.propertyId) },
      select: { ownerId: true, agencyId: true },
    });

    // Determine ownerId: from data, from property, or null
    let ownerId = data.ownerId ? BigInt(data.ownerId) : null;
    if (!ownerId && property?.ownerId) {
      ownerId = property.ownerId;
    }

    // Determine agencyId: from data, from property, from user context, or null
    let agencyId = data.agencyId ? BigInt(data.agencyId) : null;
    if (!agencyId && property?.agencyId) {
      agencyId = property.agencyId;
    }
    if (!agencyId && userAgencyId) {
      agencyId = BigInt(userAgencyId);
    }

    // Generate contract token
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const contractToken = `MR3X-CTR-${year}-${random}`;

    const contract = await this.prisma.contract.create({
      data: {
        propertyId: BigInt(data.propertyId),
        tenantId: BigInt(data.tenantId),
        ownerId: ownerId,
        agencyId: agencyId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        monthlyRent: data.monthlyRent,
        deposit: data.deposit,
        dueDay: data.dueDay,
        description: data.description,
        status: data.status || 'PENDENTE',
        templateId: data.templateId || null,
        templateType: data.templateType || null,
        creci: data.creci || null,
        contractToken: contractToken,
        clientIP: data.clientIP || null,
        userAgent: data.userAgent || null,
      },
    });

    return this.serializeContract(contract);
  }

  async update(id: string, data: any) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    const updated = await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data,
    });

    return this.serializeContract(updated);
  }

  async remove(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: BigInt(userId),
      },
    });

    return { message: 'Contract deleted successfully' };
  }

  /**
   * Sign a contract as tenant, owner, agency, or witness
   */
  async signContract(
    id: string,
    signatureType: 'tenant' | 'owner' | 'agency' | 'witness',
    signatureData: {
      signature: string; // Base64 signature image
      clientIP?: string;
      userAgent?: string;
      witnessName?: string;
      witnessDocument?: string;
    },
    userId: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
      include: { tenantUser: true, ownerUser: true },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    // Validate that the user has permission to sign
    if (signatureType === 'tenant') {
      if (contract.tenantId.toString() !== userId) {
        throw new ForbiddenException('You are not authorized to sign this contract as tenant');
      }
      if (contract.tenantSignature) {
        throw new ForbiddenException('Contract has already been signed by tenant');
      }
    } else if (signatureType === 'owner') {
      if (contract.ownerId?.toString() !== userId) {
        throw new ForbiddenException('You are not authorized to sign this contract as owner');
      }
      if (contract.ownerSignature) {
        throw new ForbiddenException('Contract has already been signed by owner');
      }
    }

    const updateData: any = {};
    const now = new Date();

    switch (signatureType) {
      case 'tenant':
        updateData.tenantSignature = signatureData.signature;
        updateData.tenantSignedAt = now;
        updateData.tenantSignedIP = signatureData.clientIP || null;
        updateData.tenantSignedAgent = signatureData.userAgent || null;
        break;
      case 'owner':
        updateData.ownerSignature = signatureData.signature;
        updateData.ownerSignedAt = now;
        updateData.ownerSignedIP = signatureData.clientIP || null;
        updateData.ownerSignedAgent = signatureData.userAgent || null;
        break;
      case 'agency':
        updateData.agencySignature = signatureData.signature;
        updateData.agencySignedAt = now;
        updateData.agencySignedIP = signatureData.clientIP || null;
        updateData.agencySignedAgent = signatureData.userAgent || null;
        break;
      case 'witness':
        updateData.witnessSignature = signatureData.signature;
        updateData.witnessSignedAt = now;
        updateData.witnessName = signatureData.witnessName || null;
        updateData.witnessDocument = signatureData.witnessDocument || null;
        break;
    }

    // Check if all required signatures are present to update status to ATIVO
    const updatedContract = await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    // Check if contract should be activated (tenant signed)
    if (signatureType === 'tenant' && updatedContract.tenantSignature) {
      await this.prisma.contract.update({
        where: { id: BigInt(id) },
        data: { status: 'ATIVO' },
      });
    }

    // Log the signature in audit
    await this.prisma.contractAudit.create({
      data: {
        contractId: BigInt(id),
        action: `SIGNED_BY_${signatureType.toUpperCase()}`,
        performedBy: BigInt(userId),
        details: JSON.stringify({
          signatureType,
          signedAt: now.toISOString(),
          clientIP: signatureData.clientIP,
        }),
      },
    });

    return this.findOne(id);
  }

  /**
   * Get contract for tenant (their own contract)
   */
  async findByTenant(tenantId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        tenantId: BigInt(tenantId),
        deleted: false,
        status: { in: ['PENDENTE', 'ATIVO'] },
      },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
        agency: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!contract) {
      return null;
    }

    return this.serializeContract(contract);
  }

  private serializeContract(contract: any) {
    const serialized: any = {
      ...contract,
      id: contract.id.toString(),
      propertyId: contract.propertyId.toString(),
      tenantId: contract.tenantId.toString(),
      ownerId: contract.ownerId?.toString() || null,
      agencyId: contract.agencyId?.toString() || null,
      deletedBy: contract.deletedBy?.toString() || null,
      monthlyRent: contract.monthlyRent?.toString() || null,
      deposit: contract.deposit?.toString() || null,
      createdAt: contract.createdAt?.toISOString() || null,
      updatedAt: contract.updatedAt?.toISOString() || null,
      startDate: contract.startDate?.toISOString() || null,
      endDate: contract.endDate?.toISOString() || null,
      deletedAt: contract.deletedAt?.toISOString() || null,
    };

    // Serialize nested property object
    if (contract.property) {
      serialized.property = {
        ...contract.property,
        id: contract.property.id?.toString() || null,
        ownerId: contract.property.ownerId?.toString() || null,
        agencyId: contract.property.agencyId?.toString() || null,
        brokerId: contract.property.brokerId?.toString() || null,
        createdBy: contract.property.createdBy?.toString() || null,
      };
    }

    // Serialize nested tenantUser object
    if (contract.tenantUser) {
      serialized.tenantUser = {
        ...contract.tenantUser,
        id: contract.tenantUser.id?.toString() || null,
        agencyId: contract.tenantUser.agencyId?.toString() || null,
        companyId: contract.tenantUser.companyId?.toString() || null,
        brokerId: contract.tenantUser.brokerId?.toString() || null,
        createdBy: contract.tenantUser.createdBy?.toString() || null,
        ownerId: contract.tenantUser.ownerId?.toString() || null,
      };
    }

    // Serialize nested ownerUser object
    if (contract.ownerUser) {
      serialized.ownerUser = {
        ...contract.ownerUser,
        id: contract.ownerUser.id?.toString() || null,
        agencyId: contract.ownerUser.agencyId?.toString() || null,
        companyId: contract.ownerUser.companyId?.toString() || null,
        brokerId: contract.ownerUser.brokerId?.toString() || null,
        createdBy: contract.ownerUser.createdBy?.toString() || null,
        ownerId: contract.ownerUser.ownerId?.toString() || null,
      };
    }

    // Serialize nested agency object
    if (contract.agency) {
      serialized.agency = {
        ...contract.agency,
        id: contract.agency.id?.toString() || null,
        companyId: contract.agency.companyId?.toString() || null,
        createdBy: contract.agency.createdBy?.toString() || null,
      };
    }

    // Serialize nested payments array
    if (contract.payments && Array.isArray(contract.payments)) {
      serialized.payments = contract.payments.map((payment: any) => ({
        ...payment,
        id: payment.id?.toString() || null,
        contratoId: payment.contratoId?.toString() || null,
        createdBy: payment.createdBy?.toString() || null,
        dataPagamento: payment.dataPagamento?.toISOString() || null,
        createdAt: payment.createdAt?.toISOString() || null,
        updatedAt: payment.updatedAt?.toISOString() || null,
      }));
    }

    return serialized;
  }
}
