import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import { InspectionSignatureLinkService } from './inspection-signature-link.service';
import { InspectionPdfService } from './inspection-pdf.service';

export interface SignatureData {
  signature: string; // Base64 image of signature
  clientIP?: string;
  userAgent?: string;
  geoLat?: number;
  geoLng?: number;
  geoConsent?: boolean;
}

export interface SignInspectionResult {
  success: boolean;
  inspectionId: string;
  signerType: string;
  signedAt: Date;
  allSignaturesComplete: boolean;
}

@Injectable()
export class InspectionSignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureLinkService: InspectionSignatureLinkService,
    private readonly pdfService: InspectionPdfService,
  ) {}

  /**
   * Sign an inspection as an authenticated user
   */
  async signInspection(
    inspectionId: string,
    signerType: 'tenant' | 'owner' | 'agency' | 'inspector',
    signatureData: SignatureData,
    userId: string,
  ): Promise<SignInspectionResult> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
      include: {
        property: {
          include: {
            owner: true,
            tenant: true,
          },
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    // Check if inspection is in a valid state for signing
    if (inspection.status === 'APROVADA') {
      throw new ForbiddenException('Vistoria ja foi aprovada e nao pode ser alterada');
    }

    // Check if this signer type has already signed
    const signatureField = `${signerType}Signature`;
    if ((inspection as any)[signatureField]) {
      throw new BadRequestException(`Esta vistoria ja foi assinada pelo ${this.getSignerTypeLabel(signerType)}`);
    }

    // Validate signature data
    if (!signatureData.signature) {
      throw new BadRequestException('Assinatura e obrigatoria');
    }

    // Require geolocation for legal validity
    if (!signatureData.geoLat || !signatureData.geoLng) {
      throw new BadRequestException('Geolocalizacao e obrigatoria para assinatura');
    }

    const now = new Date();

    // Build update data based on signer type
    const updateData: any = {
      [`${signerType}Signature`]: signatureData.signature,
      [`${signerType}SignedAt`]: now,
      [`${signerType}SignedIP`]: signatureData.clientIP || null,
      [`${signerType}SignedAgent`]: signatureData.userAgent || null,
      [`${signerType}GeoLat`]: signatureData.geoLat,
      [`${signerType}GeoLng`]: signatureData.geoLng,
      [`${signerType}GeoConsent`]: signatureData.geoConsent || false,
    };

    // Update status if it was in draft
    if (inspection.status === 'RASCUNHO' || inspection.status === 'EM_ANDAMENTO') {
      updateData.status = 'AGUARDANDO_ASSINATURA';
    }

    // Update the inspection
    await this.prisma.inspection.update({
      where: { id: BigInt(inspectionId) },
      data: updateData,
    });

    // Create audit log
    await this.createAuditLog(BigInt(inspectionId), `SIGNED_BY_${signerType.toUpperCase()}`, BigInt(userId), {
      signerType,
      signedAt: now.toISOString(),
      clientIP: signatureData.clientIP,
      geoLat: signatureData.geoLat,
      geoLng: signatureData.geoLng,
    });

    // Check if all required signatures are complete
    const allSignaturesComplete = await this.checkAllSignaturesComplete(BigInt(inspectionId));

    return {
      success: true,
      inspectionId,
      signerType,
      signedAt: now,
      allSignaturesComplete,
    };
  }

  /**
   * Sign an inspection via external link (for non-authenticated users)
   */
  async signInspectionViaLink(
    linkToken: string,
    signatureData: SignatureData,
  ): Promise<SignInspectionResult> {
    // Validate the link
    const validation = await this.signatureLinkService.validateSignatureLink(linkToken);

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    // Require geolocation for external signing
    if (!signatureData.geoLat || !signatureData.geoLng) {
      throw new BadRequestException('Geolocalizacao e obrigatoria para assinatura externa');
    }

    if (!signatureData.geoConsent) {
      throw new BadRequestException('Consentimento de geolocalizacao e obrigatorio');
    }

    const inspectionId = validation.inspectionId!;
    const signerType = validation.signerType!.toLowerCase() as 'tenant' | 'owner' | 'agency' | 'inspector';

    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    // Check if this signer type has already signed
    const signatureField = `${signerType}Signature`;
    if ((inspection as any)[signatureField]) {
      throw new BadRequestException(`Esta vistoria ja foi assinada pelo ${this.getSignerTypeLabel(signerType)}`);
    }

    const now = new Date();

    // Build update data
    const updateData: any = {
      [`${signerType}Signature`]: signatureData.signature,
      [`${signerType}SignedAt`]: now,
      [`${signerType}SignedIP`]: signatureData.clientIP || null,
      [`${signerType}SignedAgent`]: signatureData.userAgent || null,
      [`${signerType}GeoLat`]: signatureData.geoLat,
      [`${signerType}GeoLng`]: signatureData.geoLng,
      [`${signerType}GeoConsent`]: signatureData.geoConsent || false,
    };

    // Update status if needed
    if (inspection.status === 'RASCUNHO' || inspection.status === 'EM_ANDAMENTO') {
      updateData.status = 'AGUARDANDO_ASSINATURA';
    }

    // Update the inspection
    await this.prisma.inspection.update({
      where: { id: BigInt(inspectionId) },
      data: updateData,
    });

    // Mark the link as used
    await this.signatureLinkService.markLinkUsed(linkToken);

    // Create audit log (use 0 for external users)
    await this.createAuditLog(BigInt(inspectionId), `SIGNED_BY_${signerType.toUpperCase()}_VIA_LINK`, BigInt(0), {
      signerType,
      signerEmail: validation.signerEmail,
      signedAt: now.toISOString(),
      clientIP: signatureData.clientIP,
      geoLat: signatureData.geoLat,
      geoLng: signatureData.geoLng,
      linkToken,
    });

    // Check if all required signatures are complete
    const allSignaturesComplete = await this.checkAllSignaturesComplete(BigInt(inspectionId));

    return {
      success: true,
      inspectionId,
      signerType,
      signedAt: now,
      allSignaturesComplete,
    };
  }

  /**
   * Check if all required signatures are present
   */
  async checkAllSignaturesComplete(inspectionId: bigint): Promise<boolean> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        inspectorSignature: true,
        tenantSignature: true,
        ownerSignature: true,
        agencyId: true,
        agencySignature: true,
        property: {
          select: {
            tenantId: true,
            ownerId: true,
          },
        },
      },
    });

    if (!inspection) {
      return false;
    }

    // Inspector signature is always required
    if (!inspection.inspectorSignature) {
      return false;
    }

    // Owner signature required if property has owner
    if (inspection.property.ownerId && !inspection.ownerSignature) {
      return false;
    }

    // Tenant signature required if property has tenant
    if (inspection.property.tenantId && !inspection.tenantSignature) {
      return false;
    }

    // Agency signature required if inspection belongs to an agency
    if (inspection.agencyId && !inspection.agencySignature) {
      return false;
    }

    return true;
  }

  /**
   * Get signature status for an inspection
   */
  async getSignatureStatus(inspectionId: string): Promise<{
    inspectorSigned: boolean;
    tenantSigned: boolean;
    ownerSigned: boolean;
    agencySigned: boolean;
    allComplete: boolean;
    requiredSignatures: string[];
    pendingSignatures: string[];
  }> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
      select: {
        inspectorSignature: true,
        inspectorSignedAt: true,
        tenantSignature: true,
        tenantSignedAt: true,
        ownerSignature: true,
        ownerSignedAt: true,
        agencySignature: true,
        agencySignedAt: true,
        agencyId: true,
        property: {
          select: {
            tenantId: true,
            ownerId: true,
          },
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    const requiredSignatures: string[] = ['inspector'];
    const pendingSignatures: string[] = [];

    // Check inspector
    if (!inspection.inspectorSignature) {
      pendingSignatures.push('inspector');
    }

    // Check owner
    if (inspection.property.ownerId) {
      requiredSignatures.push('owner');
      if (!inspection.ownerSignature) {
        pendingSignatures.push('owner');
      }
    }

    // Check tenant
    if (inspection.property.tenantId) {
      requiredSignatures.push('tenant');
      if (!inspection.tenantSignature) {
        pendingSignatures.push('tenant');
      }
    }

    // Check agency
    if (inspection.agencyId) {
      requiredSignatures.push('agency');
      if (!inspection.agencySignature) {
        pendingSignatures.push('agency');
      }
    }

    return {
      inspectorSigned: !!inspection.inspectorSignature,
      tenantSigned: !!inspection.tenantSignature,
      ownerSigned: !!inspection.ownerSignature,
      agencySigned: !!inspection.agencySignature,
      allComplete: pendingSignatures.length === 0,
      requiredSignatures,
      pendingSignatures,
    };
  }

  /**
   * Finalize inspection after all signatures
   */
  async finalizeInspection(inspectionId: string, userId: string): Promise<void> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    if (inspection.status === 'APROVADA') {
      throw new BadRequestException('Vistoria ja foi aprovada');
    }

    // Check if all signatures are complete
    const allComplete = await this.checkAllSignaturesComplete(BigInt(inspectionId));

    if (!allComplete) {
      throw new BadRequestException('Nem todas as assinaturas obrigatorias foram coletadas');
    }

    // Generate final PDF with all signatures
    await this.pdfService.generateFinalPdf(BigInt(inspectionId));

    // Update status to completed
    await this.prisma.inspection.update({
      where: { id: BigInt(inspectionId) },
      data: { status: 'CONCLUIDA' },
    });

    // Create audit log
    await this.createAuditLog(BigInt(inspectionId), 'FINALIZED', BigInt(userId), {
      finalizedAt: new Date().toISOString(),
    });
  }

  /**
   * Approve inspection (makes it immutable)
   */
  async approveInspection(inspectionId: string, userId: string): Promise<void> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    if (inspection.status === 'APROVADA') {
      throw new BadRequestException('Vistoria ja foi aprovada');
    }

    // Generate final PDF if not already done
    if (!inspection.hashFinal) {
      await this.pdfService.generateFinalPdf(BigInt(inspectionId));
    }

    // Update status to approved (immutable)
    await this.prisma.inspection.update({
      where: { id: BigInt(inspectionId) },
      data: {
        status: 'APROVADA',
        approvedById: BigInt(userId),
        approvedAt: new Date(),
      },
    });

    // Create audit log
    await this.createAuditLog(BigInt(inspectionId), 'APPROVED', BigInt(userId), {
      approvedAt: new Date().toISOString(),
    });
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    inspectionId: bigint,
    action: string,
    performedBy: bigint,
    details: any,
  ): Promise<void> {
    await this.prisma.inspectionAudit.create({
      data: {
        inspectionId,
        action,
        performedBy,
        details: JSON.stringify(details),
      },
    });
  }

  /**
   * Get signer type label in Portuguese
   */
  private getSignerTypeLabel(signerType: string): string {
    const labels: Record<string, string> = {
      tenant: 'Inquilino',
      owner: 'Proprietario',
      agency: 'Imobiliaria',
      inspector: 'Vistoriador',
    };
    return labels[signerType] || signerType;
  }

  /**
   * Get audit log for an inspection
   */
  async getAuditLog(inspectionId: string): Promise<any[]> {
    const logs = await this.prisma.inspectionAudit.findMany({
      where: { inspectionId: BigInt(inspectionId) },
      orderBy: { performedAt: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id.toString(),
      action: log.action,
      performedBy: log.performedBy.toString(),
      performedAt: log.performedAt,
      details: log.details ? JSON.parse(log.details) : null,
    }));
  }
}
