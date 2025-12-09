import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlanEnforcementService, PLAN_MESSAGES } from '../plans/plan-enforcement.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { ContractHashService } from './services/contract-hash.service';
import { SignatureLinkService } from './services/signature-link.service';

export interface SignatureDataWithGeo {
  signature: string; // Base64 signature image
  clientIP?: string;
  userAgent?: string;
  geoLat: number; // Required geolocation
  geoLng: number; // Required geolocation
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
  ) {}

  async findAll(params: { skip?: number; take?: number; agencyId?: string; status?: string; createdById?: string; userId?: string }) {
    const { skip = 0, take = 10, agencyId, status, createdById, userId } = params;

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
    // Get property to auto-populate ownerId and agencyId
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(data.propertyId) },
      select: { ownerId: true, agencyId: true },
    });

    // Determine agencyId for plan check
    const checkAgencyId = data.agencyId || property?.agencyId?.toString() || userAgencyId;

    // Check if the agency can create more contracts based on plan limits
    if (checkAgencyId) {
      const contractCheck = await this.planEnforcement.checkContractOperationAllowed(checkAgencyId, 'create');
      if (!contractCheck.allowed) {
        throw new ForbiddenException(contractCheck.message || PLAN_MESSAGES.CREATE_CONTRACT_BLOCKED);
      }
    }

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

  // ============================================
  // ADVANCED SIGNATURE WORKFLOW METHODS
  // ============================================

  /**
   * Prepare contract for signing: freeze clauses, generate provisional PDF, compute hash
   */
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

    // Only allow preparing contracts in PENDENTE status
    if (contract.status !== 'PENDENTE') {
      throw new BadRequestException('Contrato deve estar com status PENDENTE para preparar para assinatura');
    }

    // Generate token if not exists
    const contractToken = contract.contractToken || this.pdfService.generateContractToken();

    // Freeze current clauses
    const clausesSnapshot = contract.description ? { content: contract.description } : {};

    // Update contract status to AGUARDANDO_ASSINATURAS
    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: {
        status: 'AGUARDANDO_ASSINATURAS',
        contractToken,
        clausesSnapshot,
      },
    });

    // Generate provisional PDF
    const pdfBuffer = await this.pdfService.generateProvisionalPdf(BigInt(id));

    // Log audit event
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

    return {
      message: 'Contrato preparado para assinatura',
      contractToken,
      provisionalPdfSize: pdfBuffer.length,
    };
  }

  /**
   * Sign contract with required geolocation data
   */
  async signContractWithGeo(
    id: string,
    signatureType: 'tenant' | 'owner' | 'agency' | 'witness',
    signatureData: SignatureDataWithGeo,
    userId: string,
  ) {
    // Validate geolocation is provided (REQUIRED)
    if (!signatureData.geoLat || !signatureData.geoLng) {
      throw new BadRequestException('Geolocalização é obrigatória para assinar o contrato');
    }

    if (!signatureData.geoConsent) {
      throw new BadRequestException('É necessário consentir com o compartilhamento de localização');
    }

    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
      include: { tenantUser: true, ownerUser: true, agency: true },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    // Check contract is ready for signing
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

    // Update contract with signature
    const updatedContract = await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    // Log audit event
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

    // Check if all required signatures are collected
    const allSigned = await this.checkAllSignaturesCollected(BigInt(id));
    if (allSigned) {
      await this.finalizeContract(id, userId);
    }

    return this.findOne(id);
  }

  /**
   * Check if all required signatures are collected
   */
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

    // Required: tenant and owner
    const hasTenant = !!contract.tenantSignature;
    const hasOwner = !!contract.ownerSignature;

    // Agency signature required only if agency is associated
    const hasAgency = !contract.agencyId || !!contract.agencySignature;

    return hasTenant && hasOwner && hasAgency;
  }

  /**
   * Finalize contract: generate final PDF, compute final hash, set status
   */
  async finalizeContract(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    // Generate final PDF with all signatures
    const pdfBuffer = await this.pdfService.generateFinalPdf(BigInt(id));

    // Update contract status
    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: { status: 'ASSINADO' },
    });

    // Log audit event
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

  /**
   * Update clauses (only allowed in draft/PENDENTE status)
   */
  async updateClauses(id: string, clauses: any, userId: string, ip?: string, userAgent?: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    // Only allow editing in PENDENTE status
    if (contract.status !== 'PENDENTE') {
      throw new BadRequestException('Cláusulas só podem ser editadas quando o contrato está com status PENDENTE');
    }

    // Save current version to history
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

    // Update clauses
    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: {
        clausesSnapshot: clauses,
        description: typeof clauses === 'string' ? clauses : JSON.stringify(clauses),
      },
    });

    // Log audit event
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

  /**
   * Get clause history for a contract
   */
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

  /**
   * Get contract by token (public access for verification)
   */
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

    // Return anonymized data for public verification
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

  /**
   * Download provisional PDF
   */
  async getProvisionalPdf(id: string): Promise<Buffer> {
    const pdf = await this.pdfService.getStoredPdf(BigInt(id), 'provisional');
    if (!pdf) {
      // Generate if not exists
      return this.pdfService.generateProvisionalPdf(BigInt(id));
    }
    return pdf;
  }

  /**
   * Download final PDF
   */
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

  /**
   * Create signature invitation links for all parties
   */
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

    // Log audit event
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

  /**
   * Revoke signed contract
   */
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

    // Revoke all signature links
    await this.signatureLinkService.revokeAllContractLinks(BigInt(id));

    // Log audit event
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
