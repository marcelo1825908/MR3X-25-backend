import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { MicrotransactionType, MicrotransactionStatus } from '@prisma/client';
import {
  PLANS_CONFIG,
  getMicrotransactionPricing,
  getPlanByName,
  getFreeUsageLimits,
  isWithinFreeLimit,
  MicrotransactionPricing,
} from './plans.data';

export interface CreateMicrotransactionDTO {
  agencyId: string;
  userId?: string;
  type: MicrotransactionType;
  description?: string;
  referenceId?: string;
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
  inspections: { count: number; totalAmount: number; included: boolean; freeUsed: number; freeLimit: number };
  settlements: { count: number; totalAmount: number; included: boolean; freeUsed: number; freeLimit: number };
  screenings: { count: number; totalAmount: number; freeUsed: number; freeLimit: number };
  apiCalls: { count: number; totalAmount: number; freeUsed: number; freeLimit: number };
  totalPending: number;
  totalPaid: number;
}

@Injectable()
export class MicrotransactionBillingService {
  constructor(private prisma: PrismaService) {}

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

  async isFeatureIncluded(agencyId: string, type: MicrotransactionType): Promise<boolean> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: {
        plan: true,
        monthlyInspectionsUsed: true,
        monthlySettlementsUsed: true,
        monthlyScreeningsUsed: true,
        monthlyApiCallsUsed: true,
      },
    });

    const planName = agency?.plan || 'FREE';
    const planConfig = getPlanByName(planName);

    if (!planConfig) return false;

    switch (type) {
      case MicrotransactionType.INSPECTION:
        // Check if unlimited first
        if (planConfig.unlimitedInspections) return true;
        // Check if within free limit
        return isWithinFreeLimit(planName, 'inspections', agency?.monthlyInspectionsUsed || 0);
      case MicrotransactionType.SETTLEMENT:
        // Check if unlimited first
        if (planConfig.unlimitedSettlements) return true;
        // Check if within free limit
        return isWithinFreeLimit(planName, 'settlements', agency?.monthlySettlementsUsed || 0);
      case MicrotransactionType.SCREENING:
        // Screenings are always pay-per-use but can have free quota
        return isWithinFreeLimit(planName, 'searches', agency?.monthlyScreeningsUsed || 0);
      case MicrotransactionType.API_CALL:
        // Check if within free API call limit
        return isWithinFreeLimit(planName, 'apiCalls', agency?.monthlyApiCallsUsed || 0);
      default:
        return false;
    }
  }

  async createMicrotransaction(dto: CreateMicrotransactionDTO): Promise<MicrotransactionResult> {
    const isIncluded = await this.isFeatureIncluded(dto.agencyId, dto.type);

    if (isIncluded) {
      const record = await this.prisma.microtransaction.create({
        data: {
          agencyId: BigInt(dto.agencyId),
          userId: dto.userId ? BigInt(dto.userId) : null,
          type: dto.type,
          amount: 0,
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


    const price = await this.getPriceForType(dto.agencyId, dto.type);

    if (price === null) {
      throw new BadRequestException(`Feature ${dto.type} is not available`);
    }


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

    await this.recordUsage(dto.agencyId, dto.type, price, dto.referenceId);

    return {
      id: record.id.toString(),
      amount: Number(price),
      type: dto.type,
      status: MicrotransactionStatus.PENDING,
      paymentRequired: true,
    };
  }

  async chargeExtraContract(agencyId: string, contractId: string, userId?: string): Promise<MicrotransactionResult> {
    return this.createMicrotransaction({
      agencyId,
      userId,
      type: MicrotransactionType.EXTRA_CONTRACT,
      description: 'Contrato extra além do limite do plano',
      referenceId: contractId,
    });
  }

  async chargeInspection(agencyId: string, inspectionId: string, userId?: string): Promise<MicrotransactionResult> {
    return this.createMicrotransaction({
      agencyId,
      userId,
      type: MicrotransactionType.INSPECTION,
      description: 'Vistoria de imóvel',
      referenceId: inspectionId,
    });
  }

  async chargeSettlement(agencyId: string, agreementId: string, userId?: string): Promise<MicrotransactionResult> {
    return this.createMicrotransaction({
      agencyId,
      userId,
      type: MicrotransactionType.SETTLEMENT,
      description: 'Acordo/Distrato',
      referenceId: agreementId,
    });
  }

  async chargeScreening(agencyId: string, analysisId: string, userId?: string): Promise<MicrotransactionResult> {
    return this.createMicrotransaction({
      agencyId,
      userId,
      type: MicrotransactionType.SCREENING,
      description: 'Análise de inquilino',
      referenceId: analysisId,
    });
  }

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


    await this.updateMonthlyUsage(agencyId, type);
  }

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

  async getUsageSummary(agencyId: string, billingMonth?: string): Promise<UsageSummary> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: {
        plan: true,
        monthlyInspectionsUsed: true,
        monthlySettlementsUsed: true,
        monthlyScreeningsUsed: true,
        monthlyApiCallsUsed: true,
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const planName = agency.plan || 'FREE';
    const planConfig = getPlanByName(planName);
    const freeLimits = getFreeUsageLimits(planName);
    const now = new Date();
    const targetMonth = billingMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usageRecords = await this.prisma.usageRecord.findMany({
      where: {
        agencyId: BigInt(agencyId),
        billingMonth: targetMonth,
      },
    });

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

    const extraContracts = microtransactions.filter(m => m.type === MicrotransactionType.EXTRA_CONTRACT);
    const inspections = microtransactions.filter(m => m.type === MicrotransactionType.INSPECTION);
    const settlements = microtransactions.filter(m => m.type === MicrotransactionType.SETTLEMENT);
    const screenings = microtransactions.filter(m => m.type === MicrotransactionType.SCREENING);
    const apiCalls = microtransactions.filter(m => m.type === MicrotransactionType.API_CALL);

    const pendingTransactions = microtransactions.filter(m => m.status === MicrotransactionStatus.PENDING);
    const paidTransactions = microtransactions.filter(m => m.status === MicrotransactionStatus.PAID);

    return {
      plan: planName,
      billingMonth: targetMonth,
      extraContracts: {
        count: extraContracts.length,
        totalAmount: extraContracts.reduce((sum, m) => sum + Number(m.amount), 0),
      },
      inspections: {
        count: inspections.length,
        totalAmount: inspections.reduce((sum, m) => sum + Number(m.amount), 0),
        included: planConfig?.unlimitedInspections || false,
        freeUsed: agency.monthlyInspectionsUsed || 0,
        freeLimit: freeLimits.freeInspections,
      },
      settlements: {
        count: settlements.length,
        totalAmount: settlements.reduce((sum, m) => sum + Number(m.amount), 0),
        included: planConfig?.unlimitedSettlements || false,
        freeUsed: agency.monthlySettlementsUsed || 0,
        freeLimit: freeLimits.freeSettlements,
      },
      screenings: {
        count: screenings.length,
        totalAmount: screenings.reduce((sum, m) => sum + Number(m.amount), 0),
        freeUsed: agency.monthlyScreeningsUsed || 0,
        freeLimit: freeLimits.freeSearches,
      },
      apiCalls: {
        count: apiCalls.length,
        totalAmount: apiCalls.reduce((sum, m) => sum + Number(m.amount), 0),
        freeUsed: agency.monthlyApiCallsUsed || 0,
        freeLimit: freeLimits.freeApiCalls,
      },
      totalPending: pendingTransactions.reduce((sum, m) => sum + Number(m.amount), 0),
      totalPaid: paidTransactions.reduce((sum, m) => sum + Number(m.amount), 0),
    };
  }

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
      }
    }

    return summaries;
  }

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
