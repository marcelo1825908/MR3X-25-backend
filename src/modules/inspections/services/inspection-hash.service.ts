import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@config/prisma.service';

@Injectable()
export class InspectionHashService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate SHA-256 hash from a buffer (PDF content)
   */
  generateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Store the provisional hash (before signatures)
   */
  async storeProvisionalHash(inspectionId: bigint, hash: string): Promise<void> {
    await this.prisma.inspection.update({
      where: { id: inspectionId },
      data: { provisionalHash: hash },
    });
  }

  /**
   * Store the final hash (after all signatures)
   */
  async storeFinalHash(inspectionId: bigint, hash: string): Promise<void> {
    await this.prisma.inspection.update({
      where: { id: inspectionId },
      data: { hashFinal: hash },
    });
  }

  /**
   * Verify if a provided hash matches the stored final hash
   */
  async verifyHash(inspectionId: bigint, providedHash: string): Promise<boolean> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { hashFinal: true },
    });

    if (!inspection?.hashFinal) {
      return false;
    }

    return inspection.hashFinal === providedHash;
  }

  /**
   * Verify hash by inspection token (public access)
   */
  async verifyHashByToken(token: string, providedHash: string): Promise<{ valid: boolean; message: string }> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspectionToken: token },
      select: { hashFinal: true, status: true },
    });

    if (!inspection) {
      return { valid: false, message: 'Vistoria não encontrada' };
    }

    if (!inspection.hashFinal) {
      return { valid: false, message: 'Vistoria ainda não foi finalizada' };
    }

    const isValid = inspection.hashFinal === providedHash;

    return {
      valid: isValid,
      message: isValid
        ? 'Hash válido - documento autêntico'
        : 'Hash inválido - documento pode ter sido alterado',
    };
  }

  /**
   * Generate hash from uploaded file and compare with stored hash
   */
  async validateUploadedPdf(
    inspectionToken: string,
    fileBuffer: Buffer,
  ): Promise<{ valid: boolean; computedHash: string; storedHash: string | null; message: string }> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspectionToken },
      select: { hashFinal: true },
    });

    const computedHash = this.generateHash(fileBuffer);

    if (!inspection) {
      return {
        valid: false,
        computedHash,
        storedHash: null,
        message: 'Vistoria não encontrada',
      };
    }

    if (!inspection.hashFinal) {
      return {
        valid: false,
        computedHash,
        storedHash: null,
        message: 'Vistoria ainda não possui hash final',
      };
    }

    const isValid = inspection.hashFinal === computedHash;

    return {
      valid: isValid,
      computedHash,
      storedHash: inspection.hashFinal,
      message: isValid
        ? 'Documento autêntico - hash corresponde ao original'
        : 'ALERTA: Documento foi modificado - hash não corresponde',
    };
  }

  /**
   * Get inspection verification data by token (public)
   */
  async getVerificationData(token: string): Promise<{
    found: boolean;
    data?: {
      token: string;
      type: string;
      date: Date;
      status: string;
      hashFinal: string | null;
      signedBy: {
        tenant: boolean;
        owner: boolean;
        agency: boolean;
        inspector: boolean;
      };
      property: {
        address: string;
        city: string;
      };
      generatedAt: Date | null;
    };
  }> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspectionToken: token },
      select: {
        inspectionToken: true,
        type: true,
        date: true,
        status: true,
        hashFinal: true,
        reportGeneratedAt: true,
        tenantSignedAt: true,
        ownerSignedAt: true,
        agencySignedAt: true,
        inspectorSignedAt: true,
        property: {
          select: {
            address: true,
            city: true,
          },
        },
      },
    });

    if (!inspection) {
      return { found: false };
    }

    return {
      found: true,
      data: {
        token: inspection.inspectionToken!,
        type: inspection.type,
        date: inspection.date,
        status: inspection.status,
        hashFinal: inspection.hashFinal,
        signedBy: {
          tenant: !!inspection.tenantSignedAt,
          owner: !!inspection.ownerSignedAt,
          agency: !!inspection.agencySignedAt,
          inspector: !!inspection.inspectorSignedAt,
        },
        property: {
          address: inspection.property.address,
          city: inspection.property.city,
        },
        generatedAt: inspection.reportGeneratedAt,
      },
    };
  }
}
