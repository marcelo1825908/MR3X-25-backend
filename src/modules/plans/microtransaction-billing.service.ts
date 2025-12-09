import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { MicrotransactionType, MicrotransactionStatus } from '@prisma/client';
import {
  PLANS_CONFIG,
  getMicrotransactionPricing,
  getPlanByName,
  MicrotransactionPricing,
} from './plans.data';

export interface CreateMicrotransactionDTO {
  agencyId: string;
  userId?: string;
  type: MicrotransactionType;
  description?: string;
  referenceId?: string; // Contract ID, Inspection ID, etc.
}

export interface MicrotransactionResult {
  id: string;
  amount: number;
  type: MicrotransactionType;
  status: MicrotransactionStatus;
  paymentRequired: boolean;
  paymentLink?: string;
  pixQrCode?: string;
  boletoUrl?: string;
}

export interface UsageSummary {
  plan: string;
  billingMonth: string;
  extraContracts: { count: number; totalAmount: number };
  inspections: { count: number; totalAmount: number; included: boolean };
  settlements: { count: number; totalAmount: number; included: boolean };
  screenings: { count: number; totalAmount: number };
  totalPending: number;
  totalPaid: number;
}

@Injectable()
export class MicrotransactionBillingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get pricing for a specific microtransaction type based on agency's plan
   */
  async getPriceForType(agencyId: string, type: MicrotransactionType): Promise<number | null> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planName = agency?.plan || 'FREE';
    const pricing = getMicrotransactionPricing(planName);

    switch (type) {
      case MicrotransactionType.EXTRA_CONTRACT:
        return pricing.extraContract;
      case MicrotransactionType.INSPECTION:
        return pricing.inspection;
      case MicrotransactionType.SETTLEMENT:
        return pricing.settlement;
      case MicrotransactionType.SCREENING:
        return pricing.screening;
      default:
        return null;
    }
  }

  /**
   * Check if a feature is included in the plan (no payment required)
   */
  async isFeatureIncluded(agencyId: string, type: MicrotransactionType): Promise<boolean> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planName = agency?.plan || 'FREE';
    const planConfig = getPlanByName(planName);

    if (!planConfig) return false;

    switch (type) {
      case MicrotransactionType.INSPECTION:
        return planConfig.unlimitedInspections;
      case MicrotransactionType.SETTLEMENT:
        return planConfig.unlimitedSettlements;
      default:
        return false;
    }
  }

  /**
   * Create a microtransaction for a pay-per-use feature
   */
  async createMicrotransaction(dto: CreateMicrotransactionDTO): Promise<MicrotransactionResult> {
    // Check if feature is included in plan
    const isIncluded = await this.isFeatureIncluded(dto.agencyId, dto.type);

    if (isIncluded) {
      // Feature is included, no payment required
      // Just create a record for tracking
      const record = await this.prisma.microtransaction.create({
        data: {
          agencyId: BigInt(dto.agencyId),
          userId: dto.userId ? BigInt(dto.userId) : null,
          type: dto.type,
          amount: 0, // No charge for included features
          description: dto.description || `${dto.type} - Included in plan`,
          status: MicrotransactionStatus.PAID,
          paidAt: new Date(),
          contractId: dto.type === MicrotransactionType.EXTRA_CONTRACT && dto.referenceId
            ? BigInt(dto.referenceId)
            : null,
          inspectionId: dto.type === MicrotransactionType.INSPECTION && dto.referenceId
            ? BigInt(dto.referenceId)
            : null,
          agreementId: dto.type === MicrotransactionType.SETTLEMENT && dto.referenceId
            ? BigInt(dto.referenceId)
            : null,
          analysisId: dto.type === MicrotransactionType.SCREENING && dto.referenceId
            ? BigInt(dto.referenceId)
            : null,
        },
      });

      return {
        id: record.id.toString(),
        amount: 0,
        type: dto.type,
        status: MicrotransactionStatus.PAID,
        paymentRequired: false,
      };
    }

    // Get price for the feature
    const price = await this.getPriceForType(dto.agencyId, dto.type);

    if (price === null) {
      throw new BadRequestException(`Feature ${dto.type} is not available`);
    }

    // Create pending microtransaction
    const record = await this.prisma.microtransaction.create({
      data: {
        agencyId: BigInt(dto.agencyId),
        userId: dto.userId ? BigInt(dto.userId) : null,
        type: dto.type,
        amount: price,
        description: dto.description || this.getDefaultDescription(dto.type),
        status: MicrotransactionStatus.PENDING,
        contractId: dto.type === MicrotransactionType.EXTRA_CONTRACT && dto.referenceId
          ? BigInt(dto.referenceId)
          : null,
        inspectionId: dto.type === MicrotransactionType.INSPECTION && dto.referenceId
          ? BigInt(dto.referenceId)
          : null,
        agreementId: dto.type === MicrotransactionType.SETTLEMENT && dto.referenceId
          ? BigInt(dto.referenceId)
          : null,
        analysisId: dto.type === MicrotransactionType.SCREENING && dto.referenceId
          ? BigInt(dto.referenceId)
          : null,
      },
    });

    // Record usage
    await this.recordUsage(dto.agencyId, dto.type, price, dto.referenceId);

    // TODO: Integrate with Asaas for payment processing
    // For now, return pending status

    return {
      id: record.id.toString(),
      amount: Number(price),
      type: dto.type,
      status: MicrotransactionStatus.PENDING,
      paymentRequired: true,
    };
  }

  /**
   * Charge for an extra contract when over limit
   */
  async chargeExtraContract(agencyId: string, contractId: string, userId?: string): Promise<MicrotransactionResult> {
    return this.createMicrotransaction({
      agencyId,
      userId,
      type: MicrotransactionType.EXTRA_CONTRACT,
      description: 'Contrato extra além do limite do plano',
      referenceId: contractId,
    });
  }

  /**
   * Charge for an inspection (if not included in plan)
   */
  async chargeInspection(agencyId: string, inspectionId: string, userId?: string): Promise<MicrotransactionResult> {
    return this.createMicrotransaction({
      agencyId,
      userId,
      type: MicrotransactionType.INSPECTION,
      description: 'Vistoria de imóvel',
      referenceId: inspectionId,
    });
  }

  /**
   * Charge for a settlement/agreement (if not included in plan)
   */
  async chargeSettlement(agencyId: string, agreementId: string, userId?: string): Promise<MicrotransactionResult> {
    return this.createMicrotransaction({
      agencyId,
      userId,
      type: MicrotransactionType.SETTLEMENT,
      description: 'Acordo/Distrato',
      referenceId: agreementId,
    });
  }

  /**
   * Charge for tenant screening (always pay-per-use)
   */
  async chargeScreening(agencyId: string, analysisId: string, userId?: string): Promise<MicrotransactionResult> {
    return this.createMicrotransaction({
      agencyId,
      userId,
      type: MicrotransactionType.SCREENING,
      description: 'Análise de inquilino',
      referenceId: analysisId,
    });
  }

  /**
   * Record usage for billing purposes
   */
  private async recordUsage(
    agencyId: string,
    type: MicrotransactionType,
    price: number,
    referenceId?: string
  ): Promise<void> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const now = new Date();
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await this.prisma.usageRecord.create({
      data: {
        agencyId: BigInt(agencyId),
        type: type.toString(),
        quantity: 1,
        unitPrice: price,
        totalAmount: price,
        billingMonth,
        plan: agency?.plan || 'FREE',
        referenceId: referenceId ? BigInt(referenceId) : null,
        referenceType: this.getReferenceType(type),
      },
    });

    // Update monthly usage counters
    await this.updateMonthlyUsage(agencyId, type);
  }

  /**
   * Update monthly usage counters on agency
   */
  private async updateMonthlyUsage(agencyId: string, type: MicrotransactionType): Promise<void> {
    const updateData: any = {};

    switch (type) {
      case MicrotransactionType.INSPECTION:
        updateData.monthlyInspectionsUsed = { increment: 1 };
        break;
      case MicrotransactionType.SETTLEMENT:
        updateData.monthlySettlementsUsed = { increment: 1 };
        break;
      case MicrotransactionType.SCREENING:
        updateData.monthlyScreeningsUsed = { increment: 1 };
        break;
      case MicrotransactionType.API_CALL:
        updateData.monthlyApiCallsUsed = { increment: 1 };
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.agency.update({
        where: { id: BigInt(agencyId) },
        data: updateData,
      });
    }
  }

  /**
   * Reset monthly usage counters (to be called at the start of each billing cycle)
   */
  async resetMonthlyUsage(agencyId: string): Promise<void> {
    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        monthlyInspectionsUsed: 0,
        monthlySettlementsUsed: 0,
        monthlyScreeningsUsed: 0,
        monthlyApiCallsUsed: 0,
        usageResetDate: new Date(),
      },
    });
  }

  /**
   * Get usage summary for an agency
   */
  async getUsageSummary(agencyId: string, billingMonth?: string): Promise<UsageSummary> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: {
        plan: true,
        monthlyInspectionsUsed: true,
        monthlySettlementsUsed: true,
        monthlyScreeningsUsed: true,
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const planConfig = getPlanByName(agency.plan || 'FREE');
    const now = new Date();
    const targetMonth = billingMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get usage records for the billing month
    const usageRecords = await this.prisma.usageRecord.findMany({
      where: {
        agencyId: BigInt(agencyId),
        billingMonth: targetMonth,
      },
    });

    // Get microtransactions for the billing month
    const startDate = new Date(`${targetMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const microtransactions = await this.prisma.microtransaction.findMany({
      where: {
        agencyId: BigInt(agencyId),
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    // Calculate totals by type
    const extraContracts = microtransactions.filter(m => m.type === MicrotransactionType.EXTRA_CONTRACT);
    const inspections = microtransactions.filter(m => m.type === MicrotransactionType.INSPECTION);
    const settlements = microtransactions.filter(m => m.type === MicrotransactionType.SETTLEMENT);
    const screenings = microtransactions.filter(m => m.type === MicrotransactionType.SCREENING);

    const pendingTransactions = microtransactions.filter(m => m.status === MicrotransactionStatus.PENDING);
    const paidTransactions = microtransactions.filter(m => m.status === MicrotransactionStatus.PAID);

    return {
      plan: agency.plan || 'FREE',
      billingMonth: targetMonth,
      extraContracts: {
        count: extraContracts.length,
        totalAmount: extraContracts.reduce((sum, m) => sum + Number(m.amount), 0),
      },
      inspections: {
        count: inspections.length,
        totalAmount: inspections.reduce((sum, m) => sum + Number(m.amount), 0),
        included: planConfig?.unlimitedInspections || false,
      },
      settlements: {
        count: settlements.length,
        totalAmount: settlements.reduce((sum, m) => sum + Number(m.amount), 0),
        included: planConfig?.unlimitedSettlements || false,
      },
      screenings: {
        count: screenings.length,
        totalAmount: screenings.reduce((sum, m) => sum + Number(m.amount), 0),
      },
      totalPending: pendingTransactions.reduce((sum, m) => sum + Number(m.amount), 0),
      totalPaid: paidTransactions.reduce((sum, m) => sum + Number(m.amount), 0),
    };
  }

  /**
   * Get all pending microtransactions for an agency
   */
  async getPendingMicrotransactions(agencyId: string): Promise<any[]> {
    const transactions = await this.prisma.microtransaction.findMany({
      where: {
        agencyId: BigInt(agencyId),
        status: MicrotransactionStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map(t => ({
      id: t.id.toString(),
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      contractId: t.contractId?.toString(),
      inspectionId: t.inspectionId?.toString(),
      agreementId: t.agreementId?.toString(),
      analysisId: t.analysisId?.toString(),
    }));
  }

  /**
   * Mark a microtransaction as paid
   */
  async markAsPaid(microtransactionId: string, paymentDetails?: {
    asaasPaymentId?: string;
    paymentMethod?: string;
  }): Promise<void> {
    await this.prisma.microtransaction.update({
      where: { id: BigInt(microtransactionId) },
      data: {
        status: MicrotransactionStatus.PAID,
        paidAt: new Date(),
        asaasPaymentId: paymentDetails?.asaasPaymentId,
        paymentMethod: paymentDetails?.paymentMethod,
      },
    });

    // Mark usage record as billed
    const transaction = await this.prisma.microtransaction.findUnique({
      where: { id: BigInt(microtransactionId) },
      select: { agencyId: true, type: true, createdAt: true },
    });

    if (transaction && transaction.agencyId) {
      const billingMonth = `${transaction.createdAt.getFullYear()}-${String(transaction.createdAt.getMonth() + 1).padStart(2, '0')}`;

      await this.prisma.usageRecord.updateMany({
        where: {
          agencyId: transaction.agencyId,
          type: transaction.type,
          billingMonth,
          billed: false,
        },
        data: {
          billed: true,
          billedAt: new Date(),
          paidAt: new Date(),
        },
      });
    }
  }

  /**
   * Get billing history for an agency
   */
  async getBillingHistory(agencyId: string, limit: number = 12): Promise<UsageSummary[]> {
    const now = new Date();
    const summaries: UsageSummary[] = [];

    for (let i = 0; i < limit; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const billingMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      try {
        const summary = await this.getUsageSummary(agencyId, billingMonth);
        summaries.push(summary);
      } catch (e) {
        // Skip if no data for this month
      }
    }

    return summaries;
  }

  /**
   * Get default description for a microtransaction type
   */
  private getDefaultDescription(type: MicrotransactionType): string {
    switch (type) {
      case MicrotransactionType.EXTRA_CONTRACT:
        return 'Contrato adicional';
      case MicrotransactionType.INSPECTION:
        return 'Vistoria';
      case MicrotransactionType.SETTLEMENT:
        return 'Acordo/Distrato';
      case MicrotransactionType.SCREENING:
        return 'Análise de inquilino';
      case MicrotransactionType.EXTRA_USER:
        return 'Usuário adicional';
      case MicrotransactionType.EXTRA_PROPERTY:
        return 'Imóvel adicional';
      case MicrotransactionType.API_CALL:
        return 'Chamada de API';
      default:
        return 'Serviço';
    }
  }

  /**
   * Get reference type for usage tracking
   */
  private getReferenceType(type: MicrotransactionType): string {
    switch (type) {
      case MicrotransactionType.EXTRA_CONTRACT:
        return 'contract';
      case MicrotransactionType.INSPECTION:
        return 'inspection';
      case MicrotransactionType.SETTLEMENT:
        return 'agreement';
      case MicrotransactionType.SCREENING:
        return 'analysis';
      default:
        return 'other';
    }
  }
}
