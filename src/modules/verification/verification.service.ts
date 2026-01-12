import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export enum DocumentType {
  CONTRACT = 'CONTRACT',
  AGREEMENT = 'AGREEMENT',
  INSPECTION = 'INSPECTION',
  EXTRAJUDICIAL_NOTIFICATION = 'EXTRAJUDICIAL_NOTIFICATION',
}

export interface VerificationResult {
  valid: boolean;
  message: string;
  documentType: DocumentType;
  token: string;
  hash?: string;
  storedHash?: string;
  computedHash?: string;
  status?: string;
  createdAt?: string;
  signedAt?: string;
  details?: any;
}

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  private generateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Verify document by token
   */
  async verifyByToken(token: string, documentType?: DocumentType): Promise<VerificationResult> {
    if (!token) {
      throw new BadRequestException('Token é obrigatório');
    }

    // Try to detect document type from token format if not provided
    if (!documentType) {
      if (token.startsWith('MR3X-CTR-')) {
        documentType = DocumentType.CONTRACT;
      } else if (token.startsWith('MR3X-AGR-')) {
        documentType = DocumentType.AGREEMENT;
      } else if (token.startsWith('MR3X-VST-')) {
        documentType = DocumentType.INSPECTION;
      } else if (token.startsWith('MR3X-NOT-')) {
        documentType = DocumentType.EXTRAJUDICIAL_NOTIFICATION;
      } else {
        // Try all types
        return this.verifyByTokenAllTypes(token);
      }
    }

    switch (documentType) {
      case DocumentType.CONTRACT:
        return this.verifyContract(token);
      case DocumentType.AGREEMENT:
        return this.verifyAgreement(token);
      case DocumentType.INSPECTION:
        return this.verifyInspection(token);
      case DocumentType.EXTRAJUDICIAL_NOTIFICATION:
        return this.verifyExtrajudicialNotification(token);
      default:
        throw new BadRequestException('Tipo de documento inválido');
    }
  }

  /**
   * Try to verify token across all document types
   */
  private async verifyByTokenAllTypes(token: string): Promise<VerificationResult> {
    const results = await Promise.allSettled([
      this.verifyContract(token).catch(() => null),
      this.verifyAgreement(token).catch(() => null),
      this.verifyInspection(token).catch(() => null),
      this.verifyExtrajudicialNotification(token).catch(() => null),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }

    throw new NotFoundException('Documento não encontrado com o token fornecido');
  }

  /**
   * Verify contract by token
   */
  private async verifyContract(token: string): Promise<VerificationResult> {
    const contract = await this.prisma.contract.findUnique({
      where: { contractToken: token },
      select: {
        id: true,
        contractToken: true,
        hashFinal: true,
        status: true,
        createdAt: true,
        tenantSignedAt: true,
        ownerSignedAt: true,
        agencySignedAt: true,
        property: {
          select: {
            city: true,
            neighborhood: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    const hasRequiredSignatures =
      !!contract.tenantSignedAt &&
      !!contract.ownerSignedAt &&
      (!contract.agencySignedAt || !!contract.agencySignedAt);

    return {
      valid: !!contract.hashFinal && hasRequiredSignatures,
      message: contract.hashFinal
        ? hasRequiredSignatures
          ? 'Contrato válido e autêntico'
          : 'Contrato encontrado, mas aguardando assinaturas'
        : 'Contrato ainda não foi finalizado',
      documentType: DocumentType.CONTRACT,
      token: contract.contractToken!,
      hash: contract.hashFinal || undefined,
      status: contract.status,
      createdAt: contract.createdAt.toISOString(),
      signedAt: contract.ownerSignedAt?.toISOString() || contract.tenantSignedAt?.toISOString() || undefined,
      details: {
        hasTenantSignature: !!contract.tenantSignedAt,
        hasOwnerSignature: !!contract.ownerSignedAt,
        hasAgencySignature: !!contract.agencySignedAt,
        property: contract.property,
      },
    };
  }

  /**
   * Verify agreement by token
   */
  private async verifyAgreement(token: string): Promise<VerificationResult> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { agreementToken: token },
      select: {
        id: true,
        agreementToken: true,
        agreementHash: true,
        status: true,
        createdAt: true,
        tenantSignedAt: true,
        ownerSignedAt: true,
        agencySignedAt: true,
      },
    });

    if (!agreement) {
      throw new NotFoundException('Acordo não encontrado');
    }

    const hasRequiredSignatures =
      !!agreement.tenantSignedAt &&
      !!agreement.ownerSignedAt &&
      (!agreement.agencySignedAt || !!agreement.agencySignedAt);

    return {
      valid: !!agreement.agreementHash && hasRequiredSignatures,
      message: agreement.agreementHash
        ? hasRequiredSignatures
          ? 'Acordo válido e autêntico'
          : 'Acordo encontrado, mas aguardando assinaturas'
        : 'Acordo ainda não foi finalizado',
      documentType: DocumentType.AGREEMENT,
      token: agreement.agreementToken!,
      hash: agreement.agreementHash || undefined,
      status: agreement.status,
      createdAt: agreement.createdAt.toISOString(),
      signedAt: agreement.ownerSignedAt?.toISOString() || agreement.tenantSignedAt?.toISOString() || undefined,
      details: {
        hasTenantSignature: !!agreement.tenantSignedAt,
        hasOwnerSignature: !!agreement.ownerSignedAt,
        hasAgencySignature: !!agreement.agencySignedAt,
      },
    };
  }

  /**
   * Verify inspection by token
   */
  private async verifyInspection(token: string): Promise<VerificationResult> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspectionToken: token },
      select: {
        id: true,
        inspectionToken: true,
        hashFinal: true,
        status: true,
        createdAt: true,
        inspectorSignedAt: true,
        tenantSignedAt: true,
        ownerSignedAt: true,
      },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria não encontrada');
    }

    const hasRequiredSignatures =
      !!inspection.inspectorSignedAt &&
      !!inspection.tenantSignedAt &&
      !!inspection.ownerSignedAt;

    return {
      valid: !!inspection.hashFinal && hasRequiredSignatures,
      message: inspection.hashFinal
        ? hasRequiredSignatures
          ? 'Vistoria válida e autêntica'
          : 'Vistoria encontrada, mas aguardando assinaturas'
        : 'Vistoria ainda não foi finalizada',
      documentType: DocumentType.INSPECTION,
      token: inspection.inspectionToken!,
      hash: inspection.hashFinal || undefined,
      status: inspection.status,
      createdAt: inspection.createdAt.toISOString(),
      signedAt: inspection.ownerSignedAt?.toISOString() || inspection.tenantSignedAt?.toISOString() || undefined,
      details: {
        hasInspectorSignature: !!inspection.inspectorSignedAt,
        hasTenantSignature: !!inspection.tenantSignedAt,
        hasOwnerSignature: !!inspection.ownerSignedAt,
      },
    };
  }

  /**
   * Verify extrajudicial notification by token
   */
  private async verifyExtrajudicialNotification(token: string): Promise<VerificationResult> {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { notificationToken: token },
      select: {
        id: true,
        notificationToken: true,
        hashFinal: true,
        provisionalHash: true,
        status: true,
        createdAt: true,
        creditorSignedAt: true,
        debtorSignedAt: true,
        pdfGeneratedAt: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificação extrajudicial não encontrada');
    }

    const hash = notification.hashFinal || notification.provisionalHash;
    const hasSignatures = !!notification.creditorSignedAt || !!notification.debtorSignedAt;

    return {
      valid: !!hash && hasSignatures,
      message: hash
        ? hasSignatures
          ? 'Notificação extrajudicial válida e autêntica'
          : 'Notificação encontrada, mas aguardando assinaturas'
        : 'Notificação ainda não foi finalizada',
      documentType: DocumentType.EXTRAJUDICIAL_NOTIFICATION,
      token: notification.notificationToken!,
      hash: hash || undefined,
      status: notification.status,
      createdAt: notification.createdAt.toISOString(),
      signedAt: notification.debtorSignedAt?.toISOString() || notification.creditorSignedAt?.toISOString() || undefined,
      details: {
        hasCreditorSignature: !!notification.creditorSignedAt,
        hasDebtorSignature: !!notification.debtorSignedAt,
        pdfGeneratedAt: notification.pdfGeneratedAt?.toISOString(),
      },
    };
  }

  /**
   * Verify hash against stored hash
   */
  async verifyHash(token: string, providedHash: string, documentType?: DocumentType): Promise<VerificationResult> {
    if (!token || !providedHash) {
      throw new BadRequestException('Token e hash são obrigatórios');
    }

    const verification = await this.verifyByToken(token, documentType);

    if (!verification.hash) {
      return {
        ...verification,
        valid: false,
        message: 'Documento ainda não possui hash final',
      };
    }

    const isValid = verification.hash.toLowerCase() === providedHash.toLowerCase();

    return {
      ...verification,
      valid: isValid,
      message: isValid
        ? 'Hash válido - documento autêntico e íntegro'
        : 'Hash inválido - documento pode ter sido alterado',
      storedHash: verification.hash,
      computedHash: providedHash,
    };
  }

  /**
   * Verify uploaded PDF file
   */
  async verifyPdf(token: string, fileBuffer: Buffer, documentType?: DocumentType): Promise<VerificationResult> {
    if (!token || !fileBuffer) {
      throw new BadRequestException('Token e arquivo são obrigatórios');
    }

    const computedHash = this.generateHash(fileBuffer);
    const verification = await this.verifyHash(token, computedHash, documentType);

    return {
      ...verification,
      computedHash,
    };
  }
}

