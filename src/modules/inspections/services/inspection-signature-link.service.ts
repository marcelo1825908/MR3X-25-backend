import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import { randomUUID } from 'crypto';

export interface InspectionSignatureLinkResult {
  token: string;
  signerType: string;
  signerEmail: string;
  expiresAt: Date;
  signatureUrl: string;
}

export interface ValidateInspectionSignatureLinkResult {
  valid: boolean;
  inspectionId?: string;
  signerType?: string;
  signerEmail?: string;
  signerName?: string;
  expired?: boolean;
  used?: boolean;
  message: string;
}

@Injectable()
export class InspectionSignatureLinkService {
  private readonly defaultExpiryHours = 48;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a signature invitation link for inspection
   */
  async createSignatureLink(
    inspectionId: bigint,
    signerType: 'tenant' | 'owner' | 'agency' | 'inspector',
    signerEmail: string,
    signerName?: string,
    expiresInHours: number = this.defaultExpiryHours,
  ): Promise<InspectionSignatureLinkResult> {
    // Verify inspection exists
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { id: true, status: true, inspectionToken: true },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    // Check if there's already an active link for this signer type
    const existingLink = await this.prisma.inspectionSignatureLink.findFirst({
      where: {
        inspectionId,
        signerType: signerType.toUpperCase(),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingLink) {
      // Return existing link if still valid
      const signatureUrl = this.getSignatureUrl(existingLink.token);
      return {
        token: existingLink.token,
        signerType: existingLink.signerType,
        signerEmail: existingLink.signerEmail,
        expiresAt: existingLink.expiresAt,
        signatureUrl,
      };
    }

    // Generate new token
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Create signature link
    const link = await this.prisma.inspectionSignatureLink.create({
      data: {
        inspectionId,
        signerType: signerType.toUpperCase(),
        signerEmail,
        signerName,
        token,
        expiresAt,
      },
    });

    const signatureUrl = this.getSignatureUrl(token);

    return {
      token: link.token,
      signerType: link.signerType,
      signerEmail: link.signerEmail,
      expiresAt: link.expiresAt,
      signatureUrl,
    };
  }

  /**
   * Validate a signature link
   */
  async validateSignatureLink(token: string): Promise<ValidateInspectionSignatureLinkResult> {
    const link = await this.prisma.inspectionSignatureLink.findUnique({
      where: { token },
      include: {
        inspection: {
          select: {
            id: true,
            status: true,
            inspectionToken: true,
          },
        },
      },
    });

    if (!link) {
      return {
        valid: false,
        message: 'Link de assinatura nao encontrado ou invalido',
      };
    }

    // Check if already used
    if (link.usedAt) {
      return {
        valid: false,
        used: true,
        message: 'Este link de assinatura ja foi utilizado',
      };
    }

    // Check if expired
    if (new Date() > link.expiresAt) {
      return {
        valid: false,
        expired: true,
        message: 'Este link de assinatura expirou',
      };
    }

    return {
      valid: true,
      inspectionId: link.inspectionId.toString(),
      signerType: link.signerType,
      signerEmail: link.signerEmail,
      signerName: link.signerName || undefined,
      message: 'Link valido',
    };
  }

  /**
   * Mark a signature link as used
   */
  async markLinkUsed(token: string): Promise<void> {
    const link = await this.prisma.inspectionSignatureLink.findUnique({
      where: { token },
    });

    if (!link) {
      throw new NotFoundException('Link de assinatura nao encontrado');
    }

    if (link.usedAt) {
      throw new BadRequestException('Este link ja foi utilizado');
    }

    await this.prisma.inspectionSignatureLink.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  }

  /**
   * Mark a signature link as sent
   */
  async markLinkSent(token: string): Promise<void> {
    await this.prisma.inspectionSignatureLink.update({
      where: { token },
      data: { sentAt: new Date() },
    });
  }

  /**
   * Get all signature links for an inspection
   */
  async getInspectionSignatureLinks(inspectionId: bigint): Promise<any[]> {
    const links = await this.prisma.inspectionSignatureLink.findMany({
      where: { inspectionId },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      id: link.id.toString(),
      signerType: link.signerType,
      signerEmail: link.signerEmail,
      signerName: link.signerName,
      expiresAt: link.expiresAt,
      usedAt: link.usedAt,
      sentAt: link.sentAt,
      isExpired: new Date() > link.expiresAt,
      isUsed: !!link.usedAt,
      signatureUrl: this.getSignatureUrl(link.token),
    }));
  }

  /**
   * Revoke a signature link
   */
  async revokeSignatureLink(token: string): Promise<void> {
    await this.prisma.inspectionSignatureLink.update({
      where: { token },
      data: { expiresAt: new Date() },
    });
  }

  /**
   * Revoke all signature links for an inspection
   */
  async revokeAllInspectionLinks(inspectionId: bigint): Promise<void> {
    await this.prisma.inspectionSignatureLink.updateMany({
      where: {
        inspectionId,
        usedAt: null,
      },
      data: { expiresAt: new Date() },
    });
  }

  /**
   * Get the signature URL for a token
   */
  private getSignatureUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${baseUrl}/sign/inspection/${token}`;
  }

  /**
   * Create signature links for all required parties
   */
  async createSignatureLinksForInspection(
    inspectionId: bigint,
    parties: Array<{
      signerType: 'tenant' | 'owner' | 'agency' | 'inspector';
      email: string;
      name?: string;
    }>,
    expiresInHours: number = this.defaultExpiryHours,
  ): Promise<InspectionSignatureLinkResult[]> {
    const results: InspectionSignatureLinkResult[] = [];

    for (const party of parties) {
      const link = await this.createSignatureLink(
        inspectionId,
        party.signerType,
        party.email,
        party.name,
        expiresInHours,
      );
      results.push(link);
    }

    return results;
  }

  /**
   * Get inspection data for external signing page
   */
  async getInspectionDataForSigning(token: string): Promise<any> {
    const validation = await this.validateSignatureLink(token);

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(validation.inspectionId!) },
      include: {
        property: {
          select: {
            address: true,
            city: true,
            neighborhood: true,
            owner: {
              select: { name: true, email: true },
            },
            tenant: {
              select: { name: true, email: true },
            },
          },
        },
        inspector: {
          select: { name: true, email: true },
        },
        items: {
          select: {
            room: true,
            item: true,
            condition: true,
            description: true,
            needsRepair: true,
          },
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    // Get agency if exists
    const agency = inspection.agencyId
      ? await this.prisma.agency.findUnique({
          where: { id: inspection.agencyId },
          select: { name: true },
        })
      : null;

    return {
      inspectionToken: inspection.inspectionToken,
      signerType: validation.signerType,
      signerEmail: validation.signerEmail,
      signerName: validation.signerName,
      type: inspection.type,
      date: inspection.date,
      status: inspection.status,
      property: {
        address: inspection.property.address,
        city: inspection.property.city,
        neighborhood: inspection.property.neighborhood,
      },
      parties: {
        tenant: inspection.property.tenant?.name,
        owner: inspection.property.owner?.name,
        inspector: inspection.inspector.name,
        agency: agency?.name,
      },
      items: inspection.items.map((item) => ({
        room: item.room,
        item: item.item,
        condition: item.condition,
        description: item.description,
        needsRepair: item.needsRepair,
      })),
    };
  }
}
