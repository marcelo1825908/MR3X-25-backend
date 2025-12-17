import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlanEnforcementService, PLAN_MESSAGES } from '../plans/plan-enforcement.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { ContractHashService } from './services/contract-hash.service';
import { SignatureLinkService } from './services/signature-link.service';
import { ContractImmutabilityService } from './services/contract-immutability.service';
import { ContractValidationService } from './services/contract-validation.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface SignatureDataWithGeo {
  signature: string;
  clientIP?: string;
  userAgent?: string;
  geoLat?: number | null;
  geoLng?: number | null;
  geoConsent: boolean;
  witnessName?: string;
  witnessDocument?: string;
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private planEnforcement: PlanEnforcementService,
    private pdfService: ContractPdfService,
    private hashService: ContractHashService,
    private signatureLinkService: SignatureLinkService,
    private immutabilityService: ContractImmutabilityService,
    private validationService: ContractValidationService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(params: { skip?: number; take?: number; agencyId?: string; status?: string; createdById?: string; userId?: string; userRole?: string; search?: string }) {
    const { skip = 0, take = 10, agencyId, status, createdById, userId, userRole, search } = params;

    if (agencyId) {
      try {
        await this.planEnforcement.enforceCurrentPlanLimits(agencyId);
      } catch (error) {
        console.error('Error enforcing plan limits on contract list:', error);
      }
    }

    const where: any = { deleted: false };
    
    // Hide PENDING contracts from non-admin users (BROKER, INQUILINO, PROPRIETARIO, etc.)
    // Only AGENCY_ADMIN, AGENCY_MANAGER, CEO, ADMIN can see PENDING contracts
    const adminRoles = ['AGENCY_ADMIN', 'AGENCY_MANAGER', 'CEO', 'ADMIN', 'PLATFORM_MANAGER'];
    if (userRole && !adminRoles.includes(userRole)) {
      // Non-admin users should not see PENDING contracts
      // If status filter is provided, combine it with the exclusion of PENDENTE
      if (status) {
        if (status === 'PENDENTE') {
          // Non-admin users cannot filter by PENDENTE, return empty result
          where.status = 'NONEXISTENT_STATUS';
        } else {
          where.status = status;
        }
      } else {
        where.status = { not: 'PENDENTE' };
      }
    } else if (status) {
      // Admin users can see any status including PENDENTE
      where.status = status;
    }

    // Role-based filtering: only show contracts for properties the user is responsible for
    if (userRole === 'INQUILINO' && userId) {
      // Tenant only sees contracts where they are the tenant
      where.tenantId = BigInt(userId);
    } else if (userRole === 'PROPRIETARIO' && userId) {
      // Owner only sees contracts where they are the owner (contract owner or property owner)
      where.OR = [
        { ownerId: BigInt(userId) },
        { property: { ownerId: BigInt(userId) } },
      ];
    } else if (userRole === 'BROKER' && userId) {
      // Broker only sees contracts for properties they are assigned to
      where.property = { brokerId: BigInt(userId) };
    } else if (agencyId) {
      where.agencyId = BigInt(agencyId);
    } else if (createdById) {
      where.property = { createdBy: BigInt(createdById) };
    } else if (userId) {
      where.OR = [
        { ownerId: BigInt(userId) },
        { property: { createdBy: BigInt(userId) } },
        { property: { ownerId: BigInt(userId) } },
      ];
    }

    if (search && search.trim()) {
      const searchConditions = [
        { property: { name: { contains: search.trim() } } },
        { property: { address: { contains: search.trim() } } },
        { tenantUser: { name: { contains: search.trim() } } },
        { ownerUser: { name: { contains: search.trim() } } },
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take,
        include: {
          property: { select: { id: true, address: true, city: true, name: true, neighborhood: true, brokerId: true } },
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
        property: {
          include: {
            owner: true,
          },
        },
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
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(data.propertyId) },
      include: { owner: true },
    });

    const checkAgencyId = data.agencyId || property?.agencyId?.toString() || userAgencyId;

    if (checkAgencyId) {
      const contractCheck = await this.planEnforcement.checkContractOperationAllowed(checkAgencyId, 'create');
      if (!contractCheck.allowed) {
        throw new ForbiddenException(contractCheck.message || PLAN_MESSAGES.CREATE_CONTRACT_BLOCKED);
      }
    }

    const existingActiveContract = await this.prisma.contract.findFirst({
      where: {
        propertyId: BigInt(data.propertyId),
        deleted: false,
        status: {
          notIn: ['REVOGADO', 'ENCERRADO'],
        },
      },
      select: {
        id: true,
        status: true,
        contractToken: true,
      },
    });

    if (existingActiveContract) {
      throw new BadRequestException(
        `Este imóvel já possui um contrato ativo (${existingActiveContract.contractToken || `#${existingActiveContract.id}`}). ` +
        `Encerre ou revogue o contrato existente antes de criar um novo.`
      );
    }

    let ownerId = data.ownerId ? BigInt(data.ownerId) : null;
    if (!ownerId && property?.ownerId) {
      ownerId = property.ownerId;
    }

    let agencyId = data.agencyId ? BigInt(data.agencyId) : null;
    if (!agencyId && property?.agencyId) {
      agencyId = property.agencyId;
    }
    if (!agencyId && userAgencyId) {
      agencyId = BigInt(userAgencyId);
    }

    const tenant = await this.prisma.user.findUnique({
      where: { id: BigInt(data.tenantId) },
    });

    const owner = ownerId ? await this.prisma.user.findUnique({
      where: { id: ownerId },
    }) : null;

    const agency = agencyId ? await this.prisma.agency.findUnique({
      where: { id: agencyId },
    }) : null;

    const dataSnapshot = {
      tenant: tenant ? {
        id: tenant.id.toString(),
        name: tenant.name,
        email: tenant.email,
        document: tenant.document,
        rg: tenant.rg,
        phone: tenant.phone,
        address: tenant.address,
        complement: tenant.complement,
        neighborhood: tenant.neighborhood,
        city: tenant.city,
        state: tenant.state,
        cep: tenant.cep,
        nationality: tenant.nationality,
        maritalStatus: tenant.maritalStatus,
        profession: tenant.profession,
        birthDate: tenant.birthDate?.toISOString(),
      } : null,
      owner: owner ? {
        id: owner.id.toString(),
        name: owner.name,
        email: owner.email,
        document: owner.document,
        rg: owner.rg,
        phone: owner.phone,
        address: owner.address,
        complement: owner.complement,
        neighborhood: owner.neighborhood,
        city: owner.city,
        state: owner.state,
        cep: owner.cep,
        nationality: owner.nationality,
        maritalStatus: owner.maritalStatus,
        profession: owner.profession,
      } : null,
      property: property ? {
        id: property.id.toString(),
        name: property.name,
        address: property.address,
        neighborhood: property.neighborhood,
        city: property.city,
        cep: property.cep,
        description: property.description,
        registrationNumber: property.registrationNumber,
        builtArea: property.builtArea?.toString(),
        totalArea: property.totalArea?.toString(),
      } : null,
      agency: agency ? {
        id: agency.id.toString(),
        name: agency.name,
        tradeName: agency.tradeName,
        cnpj: agency.cnpj,
        creci: agency.creci,
        email: agency.email,
        phone: agency.phone,
        address: agency.address,
        city: agency.city,
        state: agency.state,
        zipCode: agency.zipCode,
      } : null,
      guarantor: data.guarantorName ? {
        name: data.guarantorName,
        document: data.guarantorDocument,
        rg: data.guarantorRg,
        address: data.guarantorAddress,
        profession: data.guarantorProfession,
        cep: data.guarantorCep,
      } : null,
      createdAt: new Date().toISOString(),
    };

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
        dataSnapshot: dataSnapshot,
        contentSnapshot: data.contentSnapshot || null,
      },
    });

    return this.serializeContract(contract);
  }

  async update(id: string, data: any, userId?: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    const immutabilityCheck = await this.immutabilityService.enforceImmutability(
      BigInt(id),
      data,
      userId || '0',
    );

    if (!immutabilityCheck.allowed) {
      throw new ForbiddenException(immutabilityCheck.message);
    }

    const updated = await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data,
    });

    return this.serializeContract(updated);
  }

  async validateForSigning(id: string) {
    const validation = await this.validationService.validateContract(BigInt(id));
    return validation;
  }

  async getImmutabilityStatus(id: string) {
    return this.immutabilityService.checkImmutability(BigInt(id));
  }

  async createAmendedContract(originalId: string, amendments: Record<string, any>, userId: string) {
    const check = await this.immutabilityService.checkImmutability(BigInt(originalId));

    if (check.canEdit) {
      throw new BadRequestException('Contrato original pode ser editado diretamente. Use o método update.');
    }

    return this.immutabilityService.createAmendedContract(BigInt(originalId), amendments, userId);
  }

  async remove(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const immutabilityCheck = await this.immutabilityService.checkImmutability(BigInt(id));
    if (!immutabilityCheck.canDelete) {
      throw new ForbiddenException(`Não é possível excluir este contrato: ${immutabilityCheck.reason}`);
    }

    const contractIdBigInt = BigInt(id);

    await this.prisma.contractClauseHistory.deleteMany({
      where: { contractId: contractIdBigInt },
    });

    await this.prisma.contractAudit.deleteMany({
      where: { contractId: contractIdBigInt },
    });

    await this.prisma.signatureLink.deleteMany({
      where: { contractId: contractIdBigInt },
    });

    await this.prisma.invoice.deleteMany({
      where: { contractId: contractIdBigInt },
    });

    await this.prisma.payment.updateMany({
      where: { contratoId: contractIdBigInt },
      data: { contratoId: null },
    });

    await this.prisma.inspection.updateMany({
      where: { contractId: contractIdBigInt },
      data: { contractId: null },
    });

    await this.prisma.agreement.updateMany({
      where: { contractId: contractIdBigInt },
      data: { contractId: null },
    });

    await this.prisma.microtransaction.updateMany({
      where: { contractId: contractIdBigInt },
      data: { contractId: null },
    });

    await this.prisma.extrajudicialNotification.updateMany({
      where: { contractId: contractIdBigInt },
      data: { contractId: null },
    });

    await this.prisma.contract.delete({
      where: { id: contractIdBigInt },
    });

    return { message: 'Contract deleted successfully' };
  }

  async signContract(
    id: string,
    signatureType: 'tenant' | 'owner' | 'agency' | 'witness',
    signatureData: {
      signature: string;
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

    const updatedContract = await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    if (signatureType === 'tenant' && updatedContract.tenantSignature) {
      await this.prisma.contract.update({
        where: { id: BigInt(id) },
        data: { status: 'ATIVO' },
      });
    }

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

    if (contract.property) {
      serialized.property = {
        ...contract.property,
        id: contract.property.id?.toString() || null,
        ownerId: contract.property.ownerId?.toString() || null,
        agencyId: contract.property.agencyId?.toString() || null,
        brokerId: contract.property.brokerId?.toString() || null,
        createdBy: contract.property.createdBy?.toString() || null,
      };
      if (contract.property.owner) {
        serialized.property.owner = {
          ...contract.property.owner,
          id: contract.property.owner.id?.toString() || null,
          agencyId: contract.property.owner.agencyId?.toString() || null,
          companyId: contract.property.owner.companyId?.toString() || null,
          brokerId: contract.property.owner.brokerId?.toString() || null,
          createdBy: contract.property.owner.createdBy?.toString() || null,
          ownerId: contract.property.owner.ownerId?.toString() || null,
        };
      }
    }

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

    if (contract.agency) {
      serialized.agency = {
        ...contract.agency,
        id: contract.agency.id?.toString() || null,
        companyId: contract.agency.companyId?.toString() || null,
        createdBy: contract.agency.createdBy?.toString() || null,
      };
    }

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

  async prepareForSigning(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
      },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'PENDENTE') {
      throw new BadRequestException('Contrato deve estar com status PENDENTE para preparar para assinatura');
    }

    const validation = await this.validationService.validateContract(BigInt(id));
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => e.message).join('; ');
      throw new BadRequestException(`Contrato não pode ser preparado para assinatura: ${errorMessages}`);
    }

    const contractToken = contract.contractToken || this.pdfService.generateContractToken();

    const clausesSnapshot = contract.description ? { content: contract.description } : {};

    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: {
        status: 'AGUARDANDO_ASSINATURAS',
        contractToken,
        clausesSnapshot,
      },
    });

    const pdfBuffer = await this.pdfService.generateProvisionalPdf(BigInt(id));

    await this.prisma.contractAudit.create({
      data: {
        contractId: BigInt(id),
        action: 'PREPARE_FOR_SIGNING',
        performedBy: BigInt(userId),
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          contractToken,
        }),
      },
    });

    // Create notification for tenant and owner
    if (contract.ownerId && contract.tenantId && contract.propertyId) {
      const propertyName = contract.property?.name || contract.property?.address || 'Imóvel';
      await this.notificationsService.createNotification({
        description: `Novo contrato enviado para assinatura - ${propertyName}`,
        ownerId: contract.ownerId,
        tenantId: contract.tenantId,
        propertyId: contract.propertyId,
        agencyId: contract.agencyId || undefined,
        type: 'contract',
        recurring: 'once',
        days: 0,
      });
    }

    return {
      message: 'Contrato preparado para assinatura',
      contractToken,
      provisionalPdfSize: pdfBuffer.length,
    };
  }

  async signContractWithGeo(
    id: string,
    signatureType: 'tenant' | 'owner' | 'agency' | 'witness',
    signatureData: SignatureDataWithGeo,
    userId: string,
  ) {
    // Geolocation is now optional - allows signing without HTTPS
    // If geoLat/geoLng are null, it means geolocation was unavailable

    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
      include: { tenantUser: true, ownerUser: true, agency: true, property: true },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'AGUARDANDO_ASSINATURAS') {
      throw new BadRequestException('Contrato não está pronto para assinatura');
    }

    const updateData: any = {};
    const now = new Date();

    switch (signatureType) {
      case 'tenant':
        if (contract.tenantSignature) {
          throw new BadRequestException('Contrato já foi assinado pelo locatário');
        }
        updateData.tenantSignature = signatureData.signature;
        updateData.tenantSignedAt = now;
        updateData.tenantSignedIP = signatureData.clientIP || null;
        updateData.tenantSignedAgent = signatureData.userAgent || null;
        updateData.tenantGeoLat = signatureData.geoLat;
        updateData.tenantGeoLng = signatureData.geoLng;
        updateData.tenantGeoConsent = signatureData.geoConsent;
        break;

      case 'owner':
        if (contract.ownerSignature) {
          throw new BadRequestException('Contrato já foi assinado pelo proprietário');
        }
        updateData.ownerSignature = signatureData.signature;
        updateData.ownerSignedAt = now;
        updateData.ownerSignedIP = signatureData.clientIP || null;
        updateData.ownerSignedAgent = signatureData.userAgent || null;
        updateData.ownerGeoLat = signatureData.geoLat;
        updateData.ownerGeoLng = signatureData.geoLng;
        updateData.ownerGeoConsent = signatureData.geoConsent;
        break;

      case 'agency':
        if (contract.agencySignature) {
          throw new BadRequestException('Contrato já foi assinado pela imobiliária');
        }
        updateData.agencySignature = signatureData.signature;
        updateData.agencySignedAt = now;
        updateData.agencySignedIP = signatureData.clientIP || null;
        updateData.agencySignedAgent = signatureData.userAgent || null;
        updateData.agencyGeoLat = signatureData.geoLat;
        updateData.agencyGeoLng = signatureData.geoLng;
        updateData.agencyGeoConsent = signatureData.geoConsent;
        break;

      case 'witness':
        if (contract.witnessSignature) {
          throw new BadRequestException('Contrato já foi assinado pela testemunha');
        }
        updateData.witnessSignature = signatureData.signature;
        updateData.witnessSignedAt = now;
        updateData.witnessName = signatureData.witnessName || null;
        updateData.witnessDocument = signatureData.witnessDocument || null;
        updateData.witnessGeoLat = signatureData.geoLat;
        updateData.witnessGeoLng = signatureData.geoLng;
        updateData.witnessGeoConsent = signatureData.geoConsent;
        break;
    }

    const updatedContract = await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    await this.prisma.contractAudit.create({
      data: {
        contractId: BigInt(id),
        action: `SIGNATURE_CAPTURED_${signatureType.toUpperCase()}`,
        performedBy: BigInt(userId),
        details: JSON.stringify({
          signatureType,
          signedAt: now.toISOString(),
          clientIP: signatureData.clientIP,
          geoLat: signatureData.geoLat,
          geoLng: signatureData.geoLng,
        }),
      },
    });

    // Create notification for contract signature
    if (contract.ownerId && contract.tenantId && contract.propertyId) {
      const propertyName = contract.property?.name || contract.property?.address || 'Imóvel';
      let signedByLabel = '';
      switch (signatureType) {
        case 'tenant': signedByLabel = 'O Inquilino'; break;
        case 'owner': signedByLabel = 'O Proprietário'; break;
        case 'agency': signedByLabel = 'A Agência'; break;
        case 'witness': signedByLabel = 'A Testemunha'; break;
      }
      await this.notificationsService.createNotification({
        description: `${signedByLabel} assinou o contrato - ${propertyName}`,
        ownerId: contract.ownerId,
        tenantId: contract.tenantId,
        propertyId: contract.propertyId,
        agencyId: contract.agencyId || undefined,
        type: 'contract_signed',
        recurring: 'once',
        days: 0,
      });
    }

    const allSigned = await this.checkAllSignaturesCollected(BigInt(id));
    if (allSigned) {
      await this.finalizeContract(id, userId);
    }

    return this.findOne(id);
  }

  private async checkAllSignaturesCollected(contractId: bigint): Promise<boolean> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        tenantSignature: true,
        ownerSignature: true,
        agencyId: true,
        agencySignature: true,
      },
    });

    if (!contract) return false;

    const hasTenant = !!contract.tenantSignature;
    const hasOwner = !!contract.ownerSignature;

    const hasAgency = !contract.agencyId || !!contract.agencySignature;

    return hasTenant && hasOwner && hasAgency;
  }

  async finalizeContract(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    const pdfBuffer = await this.pdfService.generateFinalPdf(BigInt(id));

    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: { status: 'ASSINADO' },
    });

    await this.prisma.contractAudit.create({
      data: {
        contractId: BigInt(id),
        action: 'CONTRACT_FINALIZED',
        performedBy: BigInt(userId),
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          finalPdfSize: pdfBuffer.length,
        }),
      },
    });

    return {
      message: 'Contrato finalizado com sucesso',
      finalPdfSize: pdfBuffer.length,
    };
  }

  async updateClauses(id: string, clauses: any, userId: string, ip?: string, userAgent?: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'PENDENTE') {
      throw new BadRequestException('Cláusulas só podem ser editadas quando o contrato está com status PENDENTE');
    }

    const currentClauses = contract.clausesSnapshot || (contract.description ? { content: contract.description } : {});
    await this.prisma.contractClauseHistory.create({
      data: {
        contractId: BigInt(id),
        clauses: currentClauses,
        editedBy: BigInt(userId),
        ip: ip || null,
        userAgent: userAgent || null,
      },
    });

    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: {
        clausesSnapshot: clauses,
        description: typeof clauses === 'string' ? clauses : JSON.stringify(clauses),
      },
    });

    await this.prisma.contractAudit.create({
      data: {
        contractId: BigInt(id),
        action: 'CLAUSES_UPDATED',
        performedBy: BigInt(userId),
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          ip,
        }),
      },
    });

    return this.findOne(id);
  }

  async getClauseHistory(id: string) {
    const history = await this.prisma.contractClauseHistory.findMany({
      where: { contractId: BigInt(id) },
      include: {
        editor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { editedAt: 'desc' },
    });

    return history.map((h) => ({
      id: h.id.toString(),
      clauses: h.clauses,
      editedBy: {
        id: h.editor.id.toString(),
        name: h.editor.name,
        email: h.editor.email,
      },
      editedAt: h.editedAt.toISOString(),
      changeNote: h.changeNote,
    }));
  }

  async findByToken(token: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { contractToken: token },
      include: {
        property: {
          select: { address: true, city: true, neighborhood: true },
        },
      },
    });

    if (!contract || contract.deleted) {
      return null;
    }

    return {
      token: contract.contractToken,
      status: contract.status,
      hashFinal: contract.hashFinal,
      createdAt: contract.createdAt.toISOString(),
      property: {
        city: contract.property.city,
        neighborhood: contract.property.neighborhood,
      },
      signatures: {
        tenant: contract.tenantSignature ? {
          signedAt: contract.tenantSignedAt?.toISOString(),
          hasGeo: !!contract.tenantGeoLat,
        } : null,
        owner: contract.ownerSignature ? {
          signedAt: contract.ownerSignedAt?.toISOString(),
          hasGeo: !!contract.ownerGeoLat,
        } : null,
        agency: contract.agencySignature ? {
          signedAt: contract.agencySignedAt?.toISOString(),
          hasGeo: !!contract.agencyGeoLat,
        } : null,
        witness: contract.witnessSignature ? {
          signedAt: contract.witnessSignedAt?.toISOString(),
          hasGeo: !!contract.witnessGeoLat,
        } : null,
      },
    };
  }

  async getProvisionalPdf(id: string): Promise<Buffer> {
    const pdf = await this.pdfService.getStoredPdf(BigInt(id), 'provisional');
    if (!pdf) {
      return this.pdfService.generateProvisionalPdf(BigInt(id));
    }
    return pdf;
  }

  async getFinalPdf(id: string): Promise<Buffer> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
      select: { status: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'ASSINADO') {
      throw new BadRequestException('Contrato ainda não foi finalizado');
    }

    const pdf = await this.pdfService.getStoredPdf(BigInt(id), 'final');
    if (!pdf) {
      throw new NotFoundException('PDF final não encontrado');
    }
    return pdf;
  }

  async createSignatureInvitations(
    id: string,
    parties: Array<{ signerType: 'tenant' | 'owner' | 'agency' | 'witness'; email: string; name?: string }>,
    userId: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
      select: { status: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== 'AGUARDANDO_ASSINATURAS') {
      throw new BadRequestException('Contrato deve estar aguardando assinaturas para enviar convites');
    }

    const links = await this.signatureLinkService.createSignatureLinksForContract(
      BigInt(id),
      parties,
    );

    await this.prisma.contractAudit.create({
      data: {
        contractId: BigInt(id),
        action: 'SIGNATURE_LINKS_CREATED',
        performedBy: BigInt(userId),
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          parties: parties.map((p) => ({ signerType: p.signerType, email: p.email })),
        }),
      },
    });

    return links;
  }

  async revokeContract(id: string, userId: string, reason?: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: { status: 'REVOGADO' },
    });

    await this.signatureLinkService.revokeAllContractLinks(BigInt(id));

    await this.prisma.contractAudit.create({
      data: {
        contractId: BigInt(id),
        action: 'CONTRACT_REVOKED',
        performedBy: BigInt(userId),
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          reason: reason || 'No reason provided',
        }),
      },
    });

    return { message: 'Contrato revogado com sucesso' };
  }
}
