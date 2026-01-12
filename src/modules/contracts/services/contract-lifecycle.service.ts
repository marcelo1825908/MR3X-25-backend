import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

export enum ContractLifecycleEventType {
  RENT_ADJUSTMENT = 'RENT_ADJUSTMENT',
  RENT_REVIEW = 'RENT_REVIEW',
  TACIT_RENEWAL = 'TACIT_RENEWAL',
  EXPRESS_EXTENSION = 'EXPRESS_EXTENSION',
  TERMINATION_NOTICE = 'TERMINATION_NOTICE',
  UNMOTIVATED_TERMINATION = 'UNMOTIVATED_TERMINATION',
  KEY_RETURN = 'KEY_RETURN',
  PROPORTIONAL_TERMINATION_PENALTY = 'PROPORTIONAL_TERMINATION_PENALTY',
  DEFAULT_DECLARED = 'DEFAULT_DECLARED',
  AGREEMENT_REACHED = 'AGREEMENT_REACHED',
  JUDICIAL_PREPARATION = 'JUDICIAL_PREPARATION',
}

export interface ContractLifecycleEvent {
  id: string;
  contractId: string;
  eventType: ContractLifecycleEventType;
  eventDate: Date;
  description: string;
  metadata: any;
  documentPath?: string;
  auditLogId?: string;
  financialEffect?: {
    type: 'ADJUSTMENT' | 'PENALTY' | 'DISCOUNT' | 'PAYMENT';
    amount: number;
    currency: string;
  };
  createdBy: string;
  createdAt: Date;
}

@Injectable()
export class ContractLifecycleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a lifecycle event
   */
  async createEvent(
    contractId: string,
    eventType: ContractLifecycleEventType,
    description: string,
    metadata: any,
    createdBy: string,
    financialEffect?: ContractLifecycleEvent['financialEffect'],
  ): Promise<ContractLifecycleEvent> {
    // Store event in contract_audit or create new table
    const audit = await this.prisma.contractAudit.create({
      data: {
        contractId: BigInt(contractId),
        action: eventType,
        performedBy: BigInt(createdBy),
        details: JSON.stringify({
          eventType,
          description,
          metadata,
          financialEffect,
          timestamp: new Date(),
        }),
      },
    });

    return {
      id: audit.id.toString(),
      contractId,
      eventType,
      eventDate: audit.performedAt,
      description,
      metadata,
      auditLogId: audit.id.toString(),
      financialEffect,
      createdBy,
      createdAt: audit.performedAt,
    };
  }

  /**
   * Check for automatic rent adjustment
   */
  async checkRentAdjustment(contractId: string): Promise<boolean> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
    });

    if (!contract || contract.status !== 'ACTIVE') {
      return false;
    }

    const adjustmentMonth = contract.readjustmentMonth || 12;
    const currentMonth = new Date().getMonth() + 1;

    if (currentMonth === adjustmentMonth) {
      // Check if adjustment already happened this year
      const lastAdjustment = await this.prisma.contractAudit.findFirst({
        where: {
          contractId: BigInt(contractId),
          action: ContractLifecycleEventType.RENT_ADJUSTMENT,
          performedAt: {
            gte: new Date(new Date().getFullYear(), 0, 1),
          },
        },
        orderBy: { performedAt: 'desc' },
      });

      if (!lastAdjustment) {
        return true; // Adjustment needed
      }
    }

    return false;
  }

  /**
   * Check for tacit renewal
   */
  async checkTacitRenewal(contractId: string): Promise<boolean> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
    });

    if (!contract) {
      return false;
    }

    const endDate = new Date(contract.endDate);
    const today = new Date();
    const daysUntilEnd = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Check if contract ends within 30 days and no termination notice was given
    if (daysUntilEnd <= 30 && daysUntilEnd > 0) {
      const terminationNotice = await this.prisma.contractAudit.findFirst({
        where: {
          contractId: BigInt(contractId),
          action: {
            in: [
              ContractLifecycleEventType.TERMINATION_NOTICE,
              ContractLifecycleEventType.UNMOTIVATED_TERMINATION,
            ],
          },
          performedAt: {
            gte: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
          },
        },
      });

      if (!terminationNotice) {
        return true; // Tacit renewal will occur
      }
    }

    return false;
  }

  /**
   * Generate termination notice event
   */
  async generateTerminationNotice(
    contractId: string,
    reason: string,
    noticeDate: Date,
    createdBy: string,
  ): Promise<ContractLifecycleEvent> {
    return this.createEvent(
      contractId,
      ContractLifecycleEventType.TERMINATION_NOTICE,
      `Aviso de rescisão: ${reason}`,
      {
        reason,
        noticeDate: noticeDate.toISOString(),
        legalBasis: 'Lei do Inquilinato, Art. 9º',
      },
      createdBy,
    );
  }

  /**
   * Calculate proportional termination penalty
   */
  async calculateProportionalPenalty(
    contractId: string,
    terminationDate: Date,
  ): Promise<{ amount: number; calculation: string }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    const totalMonths = this.calculateMonths(startDate, endDate);
    const remainingMonths = this.calculateMonths(terminationDate, endDate);
    const rent = Number(contract.monthlyRent);
    const penaltyPercent = Number(contract.earlyTerminationPenaltyPercent || 3.0);

    const basePenalty = rent * 3; // 3 months rent
    const proportionalFactor = remainingMonths / totalMonths;
    const penalty = basePenalty * proportionalFactor;

    return {
      amount: penalty,
      calculation: `Base: R$ ${rent.toFixed(2)} × 3 = R$ ${basePenalty.toFixed(2)} × ${(proportionalFactor * 100).toFixed(2)}% = R$ ${penalty.toFixed(2)}`,
    };
  }

  /**
   * Get contract timeline for judicial preparation
   */
  async getContractTimeline(contractId: string): Promise<ContractLifecycleEvent[]> {
    const audits = await this.prisma.contractAudit.findMany({
      where: { contractId: BigInt(contractId) },
      orderBy: { performedAt: 'asc' },
    });

    return audits.map((audit) => {
      const details = JSON.parse(audit.details || '{}');
      return {
        id: audit.id.toString(),
        contractId,
        eventType: details.eventType || audit.action as ContractLifecycleEventType,
        eventDate: audit.performedAt,
        description: details.description || audit.action,
        metadata: details.metadata || {},
        auditLogId: audit.id.toString(),
        financialEffect: details.financialEffect,
        createdBy: audit.performedBy.toString(),
        createdAt: audit.performedAt,
      };
    });
  }

  private calculateMonths(startDate: Date, endDate: Date): number {
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    return Math.max(1, months); // At least 1 month
  }
}

