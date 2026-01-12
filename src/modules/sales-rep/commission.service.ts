import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { TokenGeneratorService, TokenEntityType } from '../common/services/token-generator.service';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
    private tokenGeneratorService: TokenGeneratorService,
  ) {}

  /**
   * Get commission rate for a representative
   * Commission rates are pre-configured by CEO/Admin and stored in platform settings
   */
  async getCommissionRate(salesRepId: bigint, planType: string): Promise<number> {
    // Get commission rate from platform settings
    // Format: commission_rate_{planType} or default commission_rate
    const setting = await this.prisma.platformSettings.findFirst({
      where: {
        OR: [
          { key: `commission_rate_${planType.toLowerCase()}` },
          { key: 'commission_rate' },
        ],
      },
      orderBy: { key: 'desc' }, // Prefer plan-specific rate
    });

    if (setting) {
      return parseFloat(setting.value) || 0;
    }

    // Default commission rate if not configured
    return 10.0; // 10% default
  }

  /**
   * Create commission when proposal is approved
   * Commission is created in 'pending' status, requires CEO/Admin approval
   */
  async createCommission(
    salesRepId: bigint,
    proposalId: bigint,
    agencyId: bigint,
    agencyName: string,
    planType: string,
    dealValue: number,
  ) {
    const commissionRate = await this.getCommissionRate(salesRepId, planType);
    const commissionValue = (dealValue * commissionRate) / 100;

    const commission = await this.prisma.salesCommission.create({
      data: {
        salesRepId,
        proposalId,
        agencyId,
        agencyName,
        planType,
        dealValue,
        commissionRate,
        commissionValue,
        status: 'pending',
        closedAt: new Date(),
      },
    });

    this.logger.log(`Commission created: ${commission.id} for sales rep ${salesRepId}, value: ${commissionValue}`);

    return {
      id: commission.id.toString(),
      commissionRate,
      commissionValue: Number(commissionValue),
      status: commission.status,
    };
  }

  /**
   * Approve commission (CEO/Admin only)
   * After approval, commission can be paid via Asaas split
   */
  async approveCommission(commissionId: string, approvedBy: bigint) {
    const commission = await this.prisma.salesCommission.findUnique({
      where: { id: BigInt(commissionId) },
      include: {
        salesRep: {
          select: {
            id: true,
            name: true,
            email: true,
            document: true,
          },
        },
      },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    if (commission.status !== 'pending') {
      throw new BadRequestException(`Commission is already ${commission.status}`);
    }

    const updated = await this.prisma.salesCommission.update({
      where: { id: BigInt(commissionId) },
      data: {
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    this.logger.log(`Commission ${commissionId} approved by ${approvedBy}`);

    return {
      id: updated.id.toString(),
      status: updated.status,
      approvedAt: updated.approvedAt?.toISOString(),
    };
  }

  /**
   * Process commission payment via Asaas split
   * Creates payment split: platform fee (2%) + representative commission
   */
  async processCommissionPayment(commissionId: string) {
    const commission = await this.prisma.salesCommission.findUnique({
      where: { id: BigInt(commissionId) },
      include: {
        salesRep: {
          select: {
            id: true,
            name: true,
            email: true,
            document: true,
          },
        },
      },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    if (commission.status !== 'approved') {
      throw new BadRequestException(`Commission must be approved before payment. Current status: ${commission.status}`);
    }

    // Get agency information separately
    if (!commission.agencyId) {
      throw new BadRequestException('Agency ID not found for commission');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: commission.agencyId },
      select: {
        id: true,
        name: true,
        email: true,
        cnpj: true,
      },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found for commission');
    }

    // Get platform fee percentage (default 2% for transaction fee)
    const platformFeeSetting = await this.prisma.platformSettings.findUnique({
      where: { key: 'platform_fee' },
    });
    const platformFeePercent = platformFeeSetting ? parseFloat(platformFeeSetting.value) : 2.0;

    const dealValue = Number(commission.dealValue);
    const commissionValue = Number(commission.commissionValue);
    const platformFee = (dealValue * platformFeePercent) / 100;
    const representativeFee = commissionValue;

    // Sync agency customer with Asaas
    const customerResult = await this.asaasService.syncCustomer({
      id: agency.id.toString(),
      name: agency.name,
      email: agency.email,
      document: agency.cnpj,
    });

    if (!customerResult.success || !customerResult.customerId) {
      throw new BadRequestException('Failed to sync agency with Asaas');
    }

    // Create payment with split
    // Split: Platform gets platformFee, Representative gets representativeFee
    // Note: Asaas split requires wallet IDs - this is a simplified version
    // In production, you'd need to configure Asaas wallets for platform and representatives
    const paymentResult = await this.asaasService.createCompletePayment({
      customerId: customerResult.customerId!,
      value: dealValue,
      dueDate: this.asaasService.formatDate(new Date()),
      description: `Comissão - ${commission.agencyName} - Plano ${commission.planType}`,
      externalReference: `commission:${commissionId}`,
      billingType: 'BOLETO',
    });

    if (!paymentResult.success || !paymentResult.paymentId) {
      throw new BadRequestException(`Failed to create Asaas payment: ${paymentResult.error || 'Unknown error'}`);
    }

    // Update commission with payment information
    const updated = await this.prisma.salesCommission.update({
      where: { id: BigInt(commissionId) },
      data: {
        status: 'paid',
        paidAt: new Date(),
        asaasPaymentId: paymentResult.paymentId,
        platformFee,
        representativeFee,
        paymentMonth: new Date().toISOString().substring(0, 7), // YYYY-MM
      },
    });

    this.logger.log(`Commission ${commissionId} paid via Asaas. Payment ID: ${paymentResult.paymentId}`);

    return {
      id: updated.id.toString(),
      status: updated.status,
      paidAt: updated.paidAt?.toISOString(),
      asaasPaymentId: updated.asaasPaymentId,
      platformFee: Number(platformFee),
      representativeFee: Number(representativeFee),
    };
  }

  /**
   * Get commissions for a sales representative
   */
  async getCommissions(salesRepId: bigint, filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = { salesRepId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.closedAt = {};
      if (filters.startDate) {
        where.closedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.closedAt.lte = new Date(filters.endDate);
      }
    }

    const commissions = await this.prisma.salesCommission.findMany({
      where,
      include: {
        proposal: {
          select: {
            id: true,
            title: true,
            planType: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { closedAt: 'desc' },
    });

    return commissions.map(c => ({
      id: c.id.toString(),
      agencyName: c.agencyName,
      planType: c.planType,
      dealValue: Number(c.dealValue),
      commissionRate: Number(c.commissionRate),
      commissionValue: Number(c.commissionValue),
      status: c.status,
      approvedAt: c.approvedAt?.toISOString(),
      paidAt: c.paidAt?.toISOString(),
      platformFee: c.platformFee ? Number(c.platformFee) : null,
      representativeFee: c.representativeFee ? Number(c.representativeFee) : null,
      asaasPaymentId: c.asaasPaymentId,
      closedAt: c.closedAt.toISOString(),
      proposal: c.proposal ? {
        id: c.proposal.id.toString(),
        title: c.proposal.title,
        planType: c.proposal.planType,
      } : null,
      approver: c.approver ? {
        id: c.approver.id.toString(),
        name: c.approver.name,
        email: c.approver.email,
      } : null,
    }));
  }
}

