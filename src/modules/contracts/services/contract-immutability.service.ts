import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import { ContractHashService } from './contract-hash.service';

export type ContractStatus =
  | 'PENDENTE'
  | 'AGUARDANDO_ASSINATURAS'
  | 'ASSINADO'
  | 'ATIVO'
  | 'REVOGADO'
  | 'ENCERRADO';

export interface ImmutabilityCheck {
  canEdit: boolean;
  canDelete: boolean;
  canAddSignature: boolean;
  canRevoke: boolean;
  canFinalize: boolean;
  reason: string;
  currentStatus: ContractStatus;
}

export interface ContractModificationResult {
  allowed: boolean;
  message: string;
  requiresNewContract: boolean;
}

@Injectable()
export class ContractImmutabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: ContractHashService,
  ) {}

  private readonly allowedTransitions: Record<ContractStatus, ContractStatus[]> = {
    'PENDENTE': ['AGUARDANDO_ASSINATURAS', 'REVOGADO'],
    'AGUARDANDO_ASSINATURAS': ['ASSINADO', 'REVOGADO', 'PENDENTE'],
    'ASSINADO': ['ATIVO', 'REVOGADO'],
    'ATIVO': ['ENCERRADO', 'REVOGADO'],
    'REVOGADO': [],
    'ENCERRADO': [],
  };

  private readonly editableFieldsByStatus: Record<ContractStatus, string[]> = {
    'PENDENTE': [
      'propertyId', 'tenantId', 'ownerId', 'agencyId',
      'startDate', 'endDate', 'monthlyRent', 'deposit', 'dueDay',
      'description', 'templateId', 'templateType', 'creci',
      'readjustmentIndex', 'readjustmentMonth',
      'earlyTerminationPenaltyPercent', 'lateFeePercent',
      'dailyPenaltyPercent', 'interestRatePercent',
      'earlyPaymentDiscountPercent', 'earlyPaymentDiscountDays',
      'clausesSnapshot', 'guaranteeType', 'jurisdiction',
    ],
    'AGUARDANDO_ASSINATURAS': [
      'tenantSignature', 'tenantSignedAt', 'tenantSignedIP', 'tenantSignedAgent',
      'tenantGeoLat', 'tenantGeoLng', 'tenantGeoConsent',
      'ownerSignature', 'ownerSignedAt', 'ownerSignedIP', 'ownerSignedAgent',
      'ownerGeoLat', 'ownerGeoLng', 'ownerGeoConsent',
      'agencySignature', 'agencySignedAt', 'agencySignedIP', 'agencySignedAgent',
      'agencyGeoLat', 'agencyGeoLng', 'agencyGeoConsent',
      'witnessSignature', 'witnessSignedAt', 'witnessName', 'witnessDocument',
      'witnessGeoLat', 'witnessGeoLng', 'witnessGeoConsent',
    ],
    'ASSINADO': [],
    'ATIVO': [],
    'REVOGADO': [],
    'ENCERRADO': [],
  };

  async checkImmutability(contractId: bigint): Promise<ImmutabilityCheck> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        status: true,
        tenantSignature: true,
        ownerSignature: true,
        agencyId: true,
        agencySignature: true,
        hashFinal: true,
      },
    });

    if (!contract) {
      throw new BadRequestException('Contrato não encontrado');
    }

    const status = contract.status as ContractStatus;
    const hasAnySignature = !!(contract.tenantSignature || contract.ownerSignature || contract.agencySignature);

    switch (status) {
      case 'PENDENTE':
        return {
          canEdit: true,
          canDelete: true,
          canAddSignature: false,
          canRevoke: true,
          canFinalize: false,
          reason: 'Contrato em modo rascunho - todas as edições permitidas',
          currentStatus: status,
        };

      case 'AGUARDANDO_ASSINATURAS':
        return {
          canEdit: false,
          canDelete: !hasAnySignature,
          canAddSignature: true,
          canRevoke: true,
          canFinalize: this.hasAllRequiredSignatures(contract),
          reason: hasAnySignature
            ? 'Cláusulas congeladas - assinaturas em andamento'
            : 'Aguardando coleta de assinaturas - cláusulas congeladas',
          currentStatus: status,
        };

      case 'ASSINADO':
        return {
          canEdit: false,
          canDelete: true,
          canAddSignature: false,
          canRevoke: true,
          canFinalize: false,
          reason: 'Contrato assinado - documento imutável. Apenas exclusão ou revogação permitida.',
          currentStatus: status,
        };

      case 'ATIVO':
        return {
          canEdit: false,
          canDelete: true,
          canAddSignature: false,
          canRevoke: true,
          canFinalize: false,
          reason: 'Contrato ativo em vigência - documento imutável',
          currentStatus: status,
        };

      case 'REVOGADO':
        return {
          canEdit: false,
          canDelete: true, // Allow deletion for historical cleanup
          canAddSignature: false,
          canRevoke: false,
          canFinalize: false,
          reason: 'Contrato revogado - pode ser excluído para limpeza de histórico',
          currentStatus: status,
        };

      case 'ENCERRADO':
        return {
          canEdit: false,
          canDelete: true, // Allow deletion for historical cleanup
          canAddSignature: false,
          canRevoke: false,
          canFinalize: false,
          reason: 'Contrato encerrado - pode ser excluído para limpeza de histórico',
          currentStatus: status,
        };

      default:
        return {
          canEdit: false,
          canDelete: false,
          canAddSignature: false,
          canRevoke: false,
          canFinalize: false,
          reason: 'Status desconhecido',
          currentStatus: status,
        };
    }
  }

  async validateFieldModification(
    contractId: bigint,
    fieldName: string,
    userId: string,
  ): Promise<ContractModificationResult> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { status: true, hashFinal: true },
    });

    if (!contract) {
      throw new BadRequestException('Contrato não encontrado');
    }

    const status = contract.status as ContractStatus;
    const editableFields = this.editableFieldsByStatus[status];

    if (contract.hashFinal && status !== 'PENDENTE') {
      return {
        allowed: false,
        message: 'Contrato já possui hash final - documento imutável. Para alterações, crie um novo contrato.',
        requiresNewContract: true,
      };
    }

    if (editableFields.includes(fieldName)) {
      return {
        allowed: true,
        message: `Campo "${fieldName}" pode ser modificado no status "${status}"`,
        requiresNewContract: false,
      };
    }

    return {
      allowed: false,
      message: `Campo "${fieldName}" não pode ser modificado no status "${status}". ${this.getStatusMessage(status)}`,
      requiresNewContract: status !== 'PENDENTE',
    };
  }

  validateStatusTransition(currentStatus: ContractStatus, newStatus: ContractStatus): boolean {
    const allowed = this.allowedTransitions[currentStatus];
    return allowed.includes(newStatus);
  }

  async enforceImmutability(
    contractId: bigint,
    updateData: Record<string, any>,
    userId: string,
  ): Promise<{ allowed: boolean; blockedFields: string[]; message: string }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { status: true, hashFinal: true },
    });

    if (!contract) {
      throw new BadRequestException('Contrato não encontrado');
    }

    const status = contract.status as ContractStatus;
    const editableFields = this.editableFieldsByStatus[status];
    const requestedFields = Object.keys(updateData).filter(
      key => !['id', 'updatedAt', 'createdAt'].includes(key),
    );

    if (updateData.status && updateData.status !== status) {
      const canTransition = this.validateStatusTransition(status, updateData.status);
      if (!canTransition) {
        return {
          allowed: false,
          blockedFields: ['status'],
          message: `Transição de status de "${status}" para "${updateData.status}" não é permitida`,
        };
      }
    }

    if (contract.hashFinal && status !== 'PENDENTE') {
      const allowedWithHash = ['status', 'deleted', 'deletedAt', 'deletedBy'];
      const blockedFields = requestedFields.filter(f => !allowedWithHash.includes(f));

      if (blockedFields.length > 0) {
        return {
          allowed: false,
          blockedFields,
          message: `Contrato assinado com hash final é imutável. Campos bloqueados: ${blockedFields.join(', ')}`,
        };
      }
    }

    const blockedFields = requestedFields.filter(
      field => !editableFields.includes(field) && !['status', 'deleted', 'deletedAt', 'deletedBy', 'updatedAt'].includes(field),
    );

    if (blockedFields.length > 0) {
      await this.logBlockedModification(contractId, userId, blockedFields, status);

      return {
        allowed: false,
        blockedFields,
        message: `Os seguintes campos não podem ser modificados no status "${status}": ${blockedFields.join(', ')}`,
      };
    }

    return {
      allowed: true,
      blockedFields: [],
      message: 'Modificação permitida',
    };
  }

  async createAmendedContract(
    originalContractId: bigint,
    amendments: Record<string, any>,
    userId: string,
  ): Promise<{ newContractId: bigint; message: string }> {
    const original = await this.prisma.contract.findUnique({
      where: { id: originalContractId },
      include: { property: true },
    });

    if (!original) {
      throw new BadRequestException('Contrato original não encontrado');
    }

    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const amendmentNumber = await this.getAmendmentCount(originalContractId);
    const newToken = `MR3X-CTR-${year}-${random}-AMD${amendmentNumber + 1}`;

    const newContract = await this.prisma.contract.create({
      data: {
        propertyId: original.propertyId,
        tenantId: original.tenantId,
        ownerId: original.ownerId,
        agencyId: original.agencyId,
        startDate: amendments.startDate || original.startDate,
        endDate: amendments.endDate || original.endDate,
        monthlyRent: amendments.monthlyRent || original.monthlyRent,
        deposit: amendments.deposit || original.deposit,
        dueDay: amendments.dueDay || original.dueDay,
        description: amendments.description || original.description,
        status: 'PENDENTE',
        templateId: original.templateId,
        templateType: original.templateType,
        creci: original.creci,
        contractToken: newToken,
        readjustmentIndex: amendments.readjustmentIndex || original.readjustmentIndex,
        readjustmentMonth: original.readjustmentMonth,
        earlyTerminationPenaltyPercent: amendments.earlyTerminationPenaltyPercent || original.earlyTerminationPenaltyPercent,
        lateFeePercent: amendments.lateFeePercent || original.lateFeePercent,
        dailyPenaltyPercent: original.dailyPenaltyPercent,
        interestRatePercent: amendments.interestRatePercent || original.interestRatePercent,
        tenantSignature: null,
        tenantSignedAt: null,
        ownerSignature: null,
        ownerSignedAt: null,
        agencySignature: null,
        agencySignedAt: null,
        witnessSignature: null,
        witnessSignedAt: null,
        hashFinal: null,
        provisionalHash: null,
      },
    });

    await this.prisma.contractAudit.create({
      data: {
        contractId: newContract.id,
        action: 'AMENDMENT_CREATED',
        performedBy: BigInt(userId),
        details: JSON.stringify({
          originalContractId: originalContractId.toString(),
          originalToken: original.contractToken,
          amendmentNumber: amendmentNumber + 1,
          amendments: Object.keys(amendments),
          timestamp: new Date().toISOString(),
        }),
      },
    });

    await this.prisma.contractAudit.create({
      data: {
        contractId: originalContractId,
        action: 'AMENDMENT_INITIATED',
        performedBy: BigInt(userId),
        details: JSON.stringify({
          newContractId: newContract.id.toString(),
          newToken: newToken,
          reason: 'Contrato original imutável - aditivo criado',
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return {
      newContractId: newContract.id,
      message: `Aditivo contratual criado com sucesso. Novo token: ${newToken}`,
    };
  }

  private async getAmendmentCount(contractId: bigint): Promise<number> {
    const audits = await this.prisma.contractAudit.count({
      where: {
        contractId,
        action: 'AMENDMENT_INITIATED',
      },
    });
    return audits;
  }

  private async logBlockedModification(
    contractId: bigint,
    userId: string,
    blockedFields: string[],
    status: string,
  ): Promise<void> {
    await this.prisma.contractAudit.create({
      data: {
        contractId,
        action: 'MODIFICATION_BLOCKED',
        performedBy: BigInt(userId),
        details: JSON.stringify({
          blockedFields,
          contractStatus: status,
          timestamp: new Date().toISOString(),
          reason: 'Tentativa de modificar campos imutáveis',
        }),
      },
    });
  }

  private hasAllRequiredSignatures(contract: {
    tenantSignature: string | null;
    ownerSignature: string | null;
    agencyId: bigint | null;
    agencySignature: string | null;
  }): boolean {
    const hasTenant = !!contract.tenantSignature;
    const hasOwner = !!contract.ownerSignature;
    const hasAgency = !contract.agencyId || !!contract.agencySignature;

    return hasTenant && hasOwner && hasAgency;
  }

  private getStatusMessage(status: ContractStatus): string {
    const messages: Record<ContractStatus, string> = {
      'PENDENTE': 'Todas as edições são permitidas no modo rascunho.',
      'AGUARDANDO_ASSINATURAS': 'Apenas campos de assinatura podem ser modificados.',
      'ASSINADO': 'Contrato assinado é imutável. Para alterações, crie um aditivo.',
      'ATIVO': 'Contrato ativo é imutável. Para alterações, crie um aditivo.',
      'REVOGADO': 'Contrato revogado é permanentemente arquivado.',
      'ENCERRADO': 'Contrato encerrado é permanentemente arquivado.',
    };
    return messages[status];
  }

  async validateNewContractRequirements(
    data: any,
  ): Promise<{ valid: boolean; message: string }> {
    if (data.contractToken) {
      const existing = await this.prisma.contract.findUnique({
        where: { contractToken: data.contractToken },
      });
      if (existing) {
        return {
          valid: false,
          message: 'Token de contrato já existe. Um novo token será gerado automaticamente.',
        };
      }
    }

    if (data.hashFinal) {
      return {
        valid: false,
        message: 'Novos contratos não podem ter hash final pré-definido.',
      };
    }

    return {
      valid: true,
      message: 'Requisitos de novo contrato validados',
    };
  }
}
