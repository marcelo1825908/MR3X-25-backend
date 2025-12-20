import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { SplitConfigurationService } from '../split-configuration/split-configuration.service';
import { v4 as uuidv4 } from 'uuid';

export enum ChargeType {
  RENT = 'RENT',
  OVERUSE = 'OVERUSE',
  OPERATIONAL_FEE = 'OPERATIONAL_FEE',
  DEPOSIT = 'DEPOSIT',
  PENALTY = 'PENALTY',
}

export interface BillingChargeData {
  agencyId?: string;
  ownerId?: string;
  contractId?: string;
  propertyId?: string;
  tenantId?: string;
  chargeType: ChargeType;
  description: string;
  billingMonth: string;
  grossValue: number;
  dueDate: Date;
  invoiceId?: string;
  usageIds?: string[];
}

export interface UsageOverageResult {
  feature: string;
  freeLimit: number;
  used: number;
  overage: number;
  unitPrice: number;
  totalCharge: number;
}

@Injectable()
export class BillingCycleService {
  private readonly logger = new Logger(BillingCycleService.name);

  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
    private splitConfigService: SplitConfigurationService,
  ) {}

  // ===============================================
  // BILLING CYCLE MANAGEMENT
  // ===============================================

  async findAllCycles(params: {
    agencyId?: string;
    ownerId?: string;
    billingMonth?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const { agencyId, ownerId, billingMonth, status, skip = 0, take = 50 } = params;

    const where: any = {};
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (ownerId) where.ownerId = BigInt(ownerId);
    if (billingMonth) where.billingMonth = billingMonth;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.billingCycle.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { billingMonth: 'desc' },
      }),
      this.prisma.billingCycle.count({ where }),
    ]);

    return {
      items: items.map(this.serializeCycle),
      total,
      skip: Number(skip),
      take: Number(take),
    };
  }

  async findOneCycle(id: string) {
    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id: BigInt(id) },
    });

    if (!cycle) {
      throw new NotFoundException(`Billing cycle not found: ${id}`);
    }

    return this.serializeCycle(cycle);
  }

  async getCurrentCycle(params: { agencyId?: string; ownerId?: string }) {
    const { agencyId, ownerId } = params;
    const currentMonth = this.getCurrentBillingMonth();

    const where: any = { billingMonth: currentMonth };
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (ownerId) where.ownerId = BigInt(ownerId);

    let cycle = await this.prisma.billingCycle.findFirst({ where });

    if (!cycle) {
      // Create new cycle
      cycle = await this.prisma.billingCycle.create({
        data: {
          agencyId: agencyId ? BigInt(agencyId) : null,
          ownerId: ownerId ? BigInt(ownerId) : null,
          billingMonth: currentMonth,
          status: 'OPEN',
        },
      });
    }

    return this.serializeCycle(cycle);
  }

  async closeCycle(id: string, userId: string) {
    const cycle = await this.findOneCycle(id);

    if (cycle.status !== 'OPEN') {
      throw new BadRequestException('Cycle is not open.');
    }

    // Calculate overages
    const overages = await this.calculateOverages(cycle.agencyId, cycle.ownerId, cycle.billingMonth);

    // Generate charges
    const chargeIds: string[] = [];

    // 1. Generate overuse charges if any
    if (overages.length > 0) {
      const totalOveruseCharge = overages.reduce((sum, o) => sum + o.totalCharge, 0);

      if (totalOveruseCharge > 0) {
        const chargeDescription = overages
          .filter(o => o.totalCharge > 0)
          .map(o => `${o.feature}: ${o.overage} units x R$${o.unitPrice}`)
          .join(', ');

        const overuseCharge = await this.createBillingCharge({
          agencyId: cycle.agencyId,
          ownerId: cycle.ownerId,
          chargeType: ChargeType.OVERUSE,
          description: `Extra usage - ${chargeDescription}`,
          billingMonth: cycle.billingMonth,
          grossValue: totalOveruseCharge,
          dueDate: this.getNextMonthDueDate(),
        });

        chargeIds.push(overuseCharge.id);
      }
    }

    // 2. Generate operational fee charges (boleto fees)
    const operationalFee = await this.calculateOperationalFees(cycle.agencyId, cycle.ownerId, cycle.billingMonth);

    if (operationalFee > 0) {
      const opCharge = await this.createBillingCharge({
        agencyId: cycle.agencyId,
        ownerId: cycle.ownerId,
        chargeType: ChargeType.OPERATIONAL_FEE,
        description: `Operational fees - ${cycle.billingMonth}`,
        billingMonth: cycle.billingMonth,
        grossValue: operationalFee,
        dueDate: this.getNextMonthDueDate(),
      });

      chargeIds.push(opCharge.id);
    }

    // Update cycle
    const updatedCycle = await this.prisma.billingCycle.update({
      where: { id: BigInt(id) },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: BigInt(userId),
        overuseChargeValue: overages.reduce((sum, o) => sum + o.totalCharge, 0),
        operationalCharges: operationalFee,
        chargeIds: JSON.stringify(chargeIds),
        // Update usage counts
        inspectionsUsed: overages.find(o => o.feature === 'inspections')?.used || 0,
        inspectionsFree: overages.find(o => o.feature === 'inspections')?.freeLimit || 0,
        inspectionsCharged: overages.find(o => o.feature === 'inspections')?.overage || 0,
        settlementsUsed: overages.find(o => o.feature === 'settlements')?.used || 0,
        settlementsFree: overages.find(o => o.feature === 'settlements')?.freeLimit || 0,
        settlementsCharged: overages.find(o => o.feature === 'settlements')?.overage || 0,
        screeningsUsed: overages.find(o => o.feature === 'screenings')?.used || 0,
        screeningsFree: overages.find(o => o.feature === 'screenings')?.freeLimit || 0,
        screeningsCharged: overages.find(o => o.feature === 'screenings')?.overage || 0,
        apiCallsUsed: overages.find(o => o.feature === 'apiCalls')?.used || 0,
        apiCallsFree: overages.find(o => o.feature === 'apiCalls')?.freeLimit || 0,
        apiCallsCharged: overages.find(o => o.feature === 'apiCalls')?.overage || 0,
      },
    });

    return this.serializeCycle(updatedCycle);
  }

  // ===============================================
  // BILLING CHARGES
  // ===============================================

  async findAllCharges(params: {
    agencyId?: string;
    ownerId?: string;
    contractId?: string;
    tenantId?: string;
    chargeType?: string;
    status?: string;
    billingMonth?: string;
    skip?: number;
    take?: number;
  }) {
    const { agencyId, ownerId, contractId, tenantId, chargeType, status, billingMonth, skip = 0, take = 50 } = params;

    const where: any = {};
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (ownerId) where.ownerId = BigInt(ownerId);
    if (contractId) where.contractId = BigInt(contractId);
    if (tenantId) where.tenantId = BigInt(tenantId);
    if (chargeType) where.chargeType = chargeType;
    if (status) where.status = status;
    if (billingMonth) where.billingMonth = billingMonth;

    const [items, total] = await Promise.all([
      this.prisma.billingCharge.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.billingCharge.count({ where }),
    ]);

    return {
      items: items.map(this.serializeCharge),
      total,
      skip: Number(skip),
      take: Number(take),
    };
  }

  async findOneCharge(id: string) {
    const charge = await this.prisma.billingCharge.findFirst({
      where: {
        OR: [
          { id: this.parseBigInt(id) },
          { token: id },
          { asaasPaymentId: id },
        ],
      },
    });

    if (!charge) {
      throw new NotFoundException(`Billing charge not found: ${id}`);
    }

    return this.serializeCharge(charge);
  }

  async createBillingCharge(data: BillingChargeData): Promise<any> {
    const token = uuidv4().substring(0, 8).toUpperCase();

    // Get split configuration
    const splitConfig = await this.splitConfigService.findActiveForEntity({
      agencyId: data.agencyId,
      ownerId: data.ownerId,
      contractId: data.contractId,
      propertyId: data.propertyId,
    });

    let platformFee = 0;
    let splitBreakdown: string | null = null;

    if (splitConfig) {
      const splitResult = await this.splitConfigService.calculateSplit(
        splitConfig.id,
        data.grossValue,
        data.chargeType as any,
      );

      // Extract platform fee
      const platformReceiver = splitResult.receivers.find(r => r.receiverType === 'PLATFORM');
      platformFee = platformReceiver?.amount || 0;
      splitBreakdown = JSON.stringify(splitResult);
    }

    const charge = await this.prisma.billingCharge.create({
      data: {
        token,
        agencyId: data.agencyId ? BigInt(data.agencyId) : null,
        ownerId: data.ownerId ? BigInt(data.ownerId) : null,
        contractId: data.contractId ? BigInt(data.contractId) : null,
        propertyId: data.propertyId ? BigInt(data.propertyId) : null,
        tenantId: data.tenantId ? BigInt(data.tenantId) : null,
        chargeType: data.chargeType,
        description: data.description,
        billingMonth: data.billingMonth,
        grossValue: data.grossValue,
        netValue: data.grossValue - platformFee,
        platformFee,
        splitBreakdown,
        status: 'PENDING',
        dueDate: data.dueDate,
        invoiceId: data.invoiceId ? BigInt(data.invoiceId) : null,
        usageIds: data.usageIds ? data.usageIds.join(',') : null,
      },
    });

    return this.serializeCharge(charge);
  }

  async createPaymentInAsaas(chargeId: string): Promise<any> {
    const charge = await this.findOneCharge(chargeId);

    if (!this.asaasService.isEnabled()) {
      throw new BadRequestException('Asaas is not configured.');
    }

    if (charge.asaasPaymentId) {
      throw new BadRequestException('Payment already created in Asaas.');
    }

    // Get customer ID (from agency or tenant)
    let customerId: string | undefined;

    if (charge.tenantId) {
      // For rent charges, get tenant's Asaas customer
      const tenant = await this.prisma.user.findUnique({
        where: { id: BigInt(charge.tenantId) },
      });
      // Sync tenant with Asaas if needed
      if (tenant) {
        const syncResult = await this.asaasService.syncCustomer({
          id: tenant.id.toString(),
          name: tenant.name || 'Unknown',
          email: tenant.email,
          document: tenant.document || '',
          phone: tenant.phone || undefined,
        });
        if (syncResult.success) {
          customerId = syncResult.customerId;
        }
      }
    } else if (charge.agencyId) {
      // For overuse/operational charges, get agency's Asaas customer
      const agency = await this.prisma.agency.findUnique({
        where: { id: BigInt(charge.agencyId) },
      });
      if (agency) {
        const syncResult = await this.asaasService.syncCustomer({
          id: agency.id.toString(),
          name: agency.name,
          email: agency.email,
          document: agency.cnpj,
          phone: agency.phone || undefined,
        });
        if (syncResult.success) {
          customerId = syncResult.customerId;
        }
      }
    }

    if (!customerId) {
      throw new BadRequestException('Unable to get or create Asaas customer.');
    }

    // Build split array if we have a split configuration
    let split: any[] | undefined;
    if (charge.splitBreakdown) {
      const splitData = JSON.parse(charge.splitBreakdown);
      // Convert to Asaas split format
      // Note: In production, you would map receiver wallets to Asaas wallet IDs
    }

    // Create payment in Asaas
    const payment = await this.asaasService.createPayment({
      customer: customerId,
      billingType: 'PIX', // Default to PIX
      value: Number(charge.grossValue),
      dueDate: charge.dueDate.toISOString().split('T')[0],
      description: charge.description,
      externalReference: `charge:${charge.id}`,
      split,
    });

    // Get PIX QR code
    let pixQrCode: string | undefined;
    let pixCopyPaste: string | undefined;
    try {
      const pixInfo = await this.asaasService.getPixQrCode(payment.id);
      pixQrCode = pixInfo?.encodedImage;
      pixCopyPaste = pixInfo?.payload;
    } catch (error) {
      this.logger.warn(`Failed to get PIX QR code: ${error.message}`);
    }

    // Update charge with Asaas info
    const updatedCharge = await this.prisma.billingCharge.update({
      where: { id: BigInt(chargeId) },
      data: {
        asaasPaymentId: payment.id,
        asaasCustomerId: customerId,
        paymentLink: payment.invoiceUrl || payment.paymentLink,
        boletoUrl: payment.bankSlipUrl,
        pixQrCode,
        pixCopyPaste,
        barcode: payment.nossoNumero,
        status: 'PROCESSING',
      },
    });

    return this.serializeCharge(updatedCharge);
  }

  async refundCharge(chargeId: string, reason: string): Promise<any> {
    const charge = await this.findOneCharge(chargeId);

    if (charge.status !== 'PAID') {
      throw new BadRequestException('Only paid charges can be refunded.');
    }

    if (!charge.asaasPaymentId) {
      throw new BadRequestException('No Asaas payment found for this charge.');
    }

    // Refund in Asaas
    try {
      await this.asaasService.refundPayment(charge.asaasPaymentId);
    } catch (error) {
      this.logger.error(`Failed to refund in Asaas: ${error.message}`);
      throw new BadRequestException(`Failed to refund: ${error.message}`);
    }

    // Update charge
    const updatedCharge = await this.prisma.billingCharge.update({
      where: { id: BigInt(chargeId) },
      data: {
        status: 'REFUNDED',
        refundedValue: charge.paidValue,
        refundedAt: new Date(),
        refundReason: reason,
      },
    });

    return this.serializeCharge(updatedCharge);
  }

  // ===============================================
  // USAGE TRACKING
  // ===============================================

  async trackUsage(params: {
    agencyId: string;
    feature: string;
    quantity?: number;
    referenceId?: string;
    referenceType?: string;
  }) {
    const { agencyId, feature, quantity = 1, referenceId, referenceType } = params;
    const billingMonth = this.getCurrentBillingMonth();

    // Get agency plan and pricing
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found.');
    }

    // Get plan pricing
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: agency.plan },
    });

    let unitPrice = 0;
    if (plan) {
      switch (feature) {
        case 'inspections':
          unitPrice = Number(plan.inspectionPrice || 0);
          break;
        case 'settlements':
          unitPrice = Number(plan.settlementPrice || 0);
          break;
        case 'screenings':
          unitPrice = Number(plan.screeningPrice || 0);
          break;
      }
    }

    // Create usage record
    const usageRecord = await this.prisma.usageRecord.create({
      data: {
        agencyId: BigInt(agencyId),
        type: feature,
        quantity,
        unitPrice,
        totalAmount: unitPrice * quantity,
        billingMonth,
        plan: agency.plan,
        referenceId: referenceId ? BigInt(referenceId) : null,
        referenceType,
      },
    });

    // Update agency monthly usage counters
    const updateData: any = {};
    switch (feature) {
      case 'inspections':
        updateData.monthlyInspectionsUsed = { increment: quantity };
        break;
      case 'settlements':
        updateData.monthlySettlementsUsed = { increment: quantity };
        break;
      case 'screenings':
        updateData.monthlyScreeningsUsed = { increment: quantity };
        break;
      case 'apiCalls':
        updateData.monthlyApiCallsUsed = { increment: quantity };
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.agency.update({
        where: { id: BigInt(agencyId) },
        data: updateData,
      });
    }

    return {
      id: usageRecord.id.toString(),
      feature,
      quantity,
      unitPrice,
      totalAmount: unitPrice * quantity,
      billingMonth,
    };
  }

  async calculateOverages(agencyId?: string, ownerId?: string, billingMonth?: string): Promise<UsageOverageResult[]> {
    const month = billingMonth || this.getCurrentBillingMonth();
    const results: UsageOverageResult[] = [];

    if (!agencyId) return results;

    // Get agency and plan
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
    });

    if (!agency) return results;

    // Get plan limits
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: agency.plan },
    });

    if (!plan) return results;

    // Get usage for the month
    const usageRecords = await this.prisma.usageRecord.groupBy({
      by: ['type'],
      where: {
        agencyId: BigInt(agencyId),
        billingMonth: month,
      },
      _sum: { quantity: true },
    });

    // Calculate overages for each feature
    const features = [
      { name: 'inspections', freeLimit: plan.freeInspections, price: Number(plan.inspectionPrice || 0) },
      { name: 'settlements', freeLimit: plan.freeSettlements, price: Number(plan.settlementPrice || 0) },
      { name: 'screenings', freeLimit: plan.freeSearches, price: Number(plan.screeningPrice || 0) },
      { name: 'apiCalls', freeLimit: plan.freeApiCalls, price: 0.01 }, // Default API call price
    ];

    for (const feature of features) {
      const usageRecord = usageRecords.find(r => r.type === feature.name);
      const used = usageRecord?._sum?.quantity || 0;
      const overage = Math.max(0, used - feature.freeLimit);

      results.push({
        feature: feature.name,
        freeLimit: feature.freeLimit,
        used,
        overage,
        unitPrice: feature.price,
        totalCharge: overage * feature.price,
      });
    }

    return results;
  }

  async calculateOperationalFees(agencyId?: string, ownerId?: string, billingMonth?: string): Promise<number> {
    const month = billingMonth || this.getCurrentBillingMonth();

    if (!agencyId && !ownerId) return 0;

    // Count boletos issued in the month
    const where: any = {
      createdAt: {
        gte: new Date(`${month}-01`),
        lt: new Date(`${month}-01`).setMonth(new Date(`${month}-01`).getMonth() + 1),
      },
      paymentMethod: 'BOLETO',
    };

    if (agencyId) where.agencyId = BigInt(agencyId);

    const boletoCount = await this.prisma.invoice.count({ where });

    // Calculate operational fee (e.g., R$ 1.51 markup per boleto)
    const BOLETO_MARKUP = 1.51;
    return boletoCount * BOLETO_MARKUP;
  }

  // ===============================================
  // WEBHOOK HANDLING
  // ===============================================

  async handlePaymentWebhook(event: string, paymentId: string, paymentData: any) {
    // Find charge by Asaas payment ID
    const charge = await this.prisma.billingCharge.findFirst({
      where: { asaasPaymentId: paymentId },
    });

    if (!charge) {
      this.logger.warn(`No charge found for Asaas payment: ${paymentId}`);
      return;
    }

    const updateData: any = {
      webhookStatus: event,
      lastWebhookAt: new Date(),
    };

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        updateData.status = 'PAID';
        updateData.paidValue = paymentData.value;
        updateData.paidAt = new Date();
        updateData.paymentMethod = paymentData.billingType;
        break;

      case 'PAYMENT_OVERDUE':
        updateData.status = 'OVERDUE';
        break;

      case 'PAYMENT_REFUNDED':
        updateData.status = 'REFUNDED';
        updateData.refundedAt = new Date();
        break;
    }

    await this.prisma.billingCharge.update({
      where: { id: charge.id },
      data: updateData,
    });
  }

  // ===============================================
  // HELPER METHODS
  // ===============================================

  private getCurrentBillingMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getNextMonthDueDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 10); // Due on the 10th of next month
  }

  private parseBigInt(value: string): bigint | undefined {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  private serializeCycle(cycle: any): any {
    return {
      id: cycle.id.toString(),
      agencyId: cycle.agencyId?.toString(),
      ownerId: cycle.ownerId?.toString(),
      billingMonth: cycle.billingMonth,
      status: cycle.status,
      totalContracts: cycle.totalContracts,
      totalInvoicesIssued: cycle.totalInvoicesIssued,
      totalPlatformFee: Number(cycle.totalPlatformFee),
      totalAgencyFee: Number(cycle.totalAgencyFee),
      totalOwnerPayout: Number(cycle.totalOwnerPayout),
      inspectionsUsed: cycle.inspectionsUsed,
      inspectionsFree: cycle.inspectionsFree,
      inspectionsCharged: cycle.inspectionsCharged,
      settlementsUsed: cycle.settlementsUsed,
      settlementsFree: cycle.settlementsFree,
      settlementsCharged: cycle.settlementsCharged,
      screeningsUsed: cycle.screeningsUsed,
      screeningsFree: cycle.screeningsFree,
      screeningsCharged: cycle.screeningsCharged,
      apiCallsUsed: cycle.apiCallsUsed,
      apiCallsFree: cycle.apiCallsFree,
      apiCallsCharged: cycle.apiCallsCharged,
      overuseChargeValue: Number(cycle.overuseChargeValue),
      boletoCount: cycle.boletoCount,
      boletoFeeValue: Number(cycle.boletoFeeValue),
      operationalCharges: Number(cycle.operationalCharges),
      closedAt: cycle.closedAt,
      closedBy: cycle.closedBy?.toString(),
      chargeIds: cycle.chargeIds ? JSON.parse(cycle.chargeIds) : [],
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
    };
  }

  private serializeCharge(charge: any): any {
    return {
      id: charge.id.toString(),
      token: charge.token,
      agencyId: charge.agencyId?.toString(),
      ownerId: charge.ownerId?.toString(),
      contractId: charge.contractId?.toString(),
      propertyId: charge.propertyId?.toString(),
      tenantId: charge.tenantId?.toString(),
      chargeType: charge.chargeType,
      description: charge.description,
      billingMonth: charge.billingMonth,
      grossValue: Number(charge.grossValue),
      netValue: Number(charge.netValue),
      platformFee: Number(charge.platformFee),
      gatewayFee: Number(charge.gatewayFee),
      splitBreakdown: charge.splitBreakdown ? JSON.parse(charge.splitBreakdown) : null,
      status: charge.status,
      dueDate: charge.dueDate,
      asaasPaymentId: charge.asaasPaymentId,
      asaasCustomerId: charge.asaasCustomerId,
      paymentLink: charge.paymentLink,
      boletoUrl: charge.boletoUrl,
      pixQrCode: charge.pixQrCode,
      pixCopyPaste: charge.pixCopyPaste,
      barcode: charge.barcode,
      paymentMethod: charge.paymentMethod,
      paidValue: charge.paidValue ? Number(charge.paidValue) : null,
      paidAt: charge.paidAt,
      refundedValue: charge.refundedValue ? Number(charge.refundedValue) : null,
      refundedAt: charge.refundedAt,
      refundReason: charge.refundReason,
      invoiceId: charge.invoiceId?.toString(),
      usageIds: charge.usageIds ? charge.usageIds.split(',') : [],
      webhookStatus: charge.webhookStatus,
      lastWebhookAt: charge.lastWebhookAt,
      notes: charge.notes,
      createdBy: charge.createdBy?.toString(),
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt,
    };
  }
}
