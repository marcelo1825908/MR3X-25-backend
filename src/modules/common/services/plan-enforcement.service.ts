import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

/**
 * Plan limits configuration based on MR3X pricing model
 * FREE: R$ 0/month - 1 contract, 2 users, microtransactions enabled
 * BASIC: R$ 89.90/month - 20 contracts, 5 users, unlimited inspections
 * PROFESSIONAL: R$ 189.90/month - 60 contracts, 10 users, all features
 * ENTERPRISE: R$ 449.90/month - 200 contracts, unlimited users, full API
 */
export const PLAN_LIMITS = {
  FREE: {
    maxContracts: 1,
    maxUsers: 2,
    maxProperties: 1,
    features: {
      inspections: false, // Pay-per-use (R$ 3.90)
      settlements: false, // Pay-per-use (R$ 6.90)
      screening: false, // Pay-per-use (R$ 8.90)
      api: false,
      whatsapp: false,
      analytics: false,
    },
    microtransactionPrices: {
      extraContract: 4.90,
      inspection: 3.90,
      settlement: 6.90,
      screening: 8.90,
    },
  },
  BASIC: {
    maxContracts: 20,
    maxUsers: 5,
    maxProperties: 20,
    features: {
      inspections: true, // Unlimited
      settlements: true, // Unlimited
      screening: false, // Pay-per-use (R$ 8.90)
      api: false,
      whatsapp: false,
      analytics: true,
    },
    microtransactionPrices: {
      screening: 8.90,
    },
  },
  PROFESSIONAL: {
    maxContracts: 60,
    maxUsers: 10,
    maxProperties: 60,
    features: {
      inspections: true,
      settlements: true,
      screening: true, // Unlimited
      api: false,
      whatsapp: true,
      analytics: true,
    },
    microtransactionPrices: {},
  },
  ENTERPRISE: {
    maxContracts: 200,
    maxUsers: 999999, // Unlimited (very large number)
    maxProperties: 200,
    features: {
      inspections: true,
      settlements: true,
      screening: true,
      api: true,
      whatsapp: true,
      analytics: true,
    },
    microtransactionPrices: {},
  },
};

export interface PlanCheckResult {
  allowed: boolean;
  requiresPayment: boolean;
  microtransactionPrice?: number;
  message?: string;
  currentCount?: number;
  maxAllowed?: number;
}

@Injectable()
export class PlanEnforcementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if agency can create a new contract
   * Returns whether creation is allowed or requires microtransaction payment
   */
  async checkContractCreation(agencyId: bigint): Promise<PlanCheckResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        plan: true,
        maxContracts: true,
        activeContractsCount: true,
        subscriptionStatus: true,
      },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active. Please update your payment method.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;
    const currentCount = agency.activeContractsCount || 0;
    const maxAllowed = agency.maxContracts || planLimits.maxContracts;

    // Check if under limit
    if (currentCount < maxAllowed) {
      return {
        allowed: true,
        requiresPayment: false,
        currentCount,
        maxAllowed,
      };
    }

    // On FREE plan, allow overflow with microtransaction
    if (agency.plan === 'FREE') {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: planLimits.microtransactionPrices.extraContract,
        message: `You've reached your plan limit of ${maxAllowed} contract(s). An additional charge of R$ ${planLimits.microtransactionPrices.extraContract.toFixed(2)} will apply for this extra contract.`,
        currentCount,
        maxAllowed,
      };
    }

    // On paid plans, hard limit
    return {
      allowed: false,
      requiresPayment: false,
      message: `You've reached your plan limit of ${maxAllowed} contracts. Please upgrade your plan to create more contracts.`,
      currentCount,
      maxAllowed,
    };
  }

  /**
   * Check if inspection can be created
   */
  async checkInspectionCreation(agencyId: bigint | null, userId: bigint): Promise<PlanCheckResult> {
    // Independent owners have unlimited inspections
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, agencyId: true },
    });

    if (user?.role === 'INDEPENDENT_OWNER') {
      return { allowed: true, requiresPayment: false };
    }

    if (!agencyId) {
      throw new BadRequestException('Agency ID required for inspection creation');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, subscriptionStatus: true },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    // Check if inspections are included in plan
    if (planLimits.features.inspections) {
      return { allowed: true, requiresPayment: false };
    }

    // On FREE plan, require microtransaction payment
    if (agency.plan === 'FREE') {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: planLimits.microtransactionPrices.inspection,
        message: `Professional inspection reports require a payment of R$ ${planLimits.microtransactionPrices.inspection.toFixed(2)} on the FREE plan. Upgrade to BASIC or higher for unlimited inspections.`,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: 'Inspections are not available on your plan.',
    };
  }

  /**
   * Check if settlement/agreement can be created
   */
  async checkSettlementCreation(agencyId: bigint | null): Promise<PlanCheckResult> {
    if (!agencyId) {
      // Independent owners have unlimited settlements
      return { allowed: true, requiresPayment: false };
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, subscriptionStatus: true },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    if (planLimits.features.settlements) {
      return { allowed: true, requiresPayment: false };
    }

    // On FREE plan, require microtransaction
    if (agency.plan === 'FREE') {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: planLimits.microtransactionPrices.settlement,
        message: `Settlement documents require a payment of R$ ${planLimits.microtransactionPrices.settlement.toFixed(2)} on the FREE plan.`,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: 'Settlements are not available on your plan.',
    };
  }

  /**
   * Check if tenant screening/analysis can be performed
   */
  async checkScreeningCreation(agencyId: bigint | null): Promise<PlanCheckResult> {
    if (!agencyId) {
      // Independent owners pay per screening
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: PLAN_LIMITS.FREE.microtransactionPrices.screening,
        message: `Tenant credit analysis costs R$ ${PLAN_LIMITS.FREE.microtransactionPrices.screening.toFixed(2)}.`,
      };
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, subscriptionStatus: true },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    if (planLimits.features.screening) {
      return { allowed: true, requiresPayment: false };
    }

    // Require microtransaction on FREE and BASIC plans
    const price = planLimits.microtransactionPrices.screening;
    if (price) {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: price,
        message: `Tenant credit analysis costs R$ ${price.toFixed(2)} on the ${agency.plan} plan.`,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: 'Screening is not available on your plan.',
    };
  }

  /**
   * Check if user can be created
   */
  async checkUserCreation(agencyId: bigint): Promise<PlanCheckResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        plan: true,
        maxUsers: true,
        activeUsersCount: true,
        subscriptionStatus: true,
      },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;
    const currentCount = agency.activeUsersCount || 0;
    const maxAllowed = agency.maxUsers || planLimits.maxUsers;

    if (currentCount < maxAllowed) {
      return {
        allowed: true,
        requiresPayment: false,
        currentCount,
        maxAllowed,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: `You've reached your plan limit of ${maxAllowed} users. Please upgrade your plan to add more users.`,
      currentCount,
      maxAllowed,
    };
  }

  /**
   * Check if API access is allowed
   */
  async checkApiAccess(agencyId: bigint): Promise<PlanCheckResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, apiEnabled: true, subscriptionStatus: true },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    if (planLimits.features.api && agency.apiEnabled) {
      return { allowed: true, requiresPayment: false };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: 'API access is only available on the ENTERPRISE plan.',
    };
  }

  /**
   * Increment active contract count for an agency
   */
  async incrementContractCount(agencyId: bigint): Promise<void> {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        activeContractsCount: { increment: 1 },
      },
    });
  }

  /**
   * Decrement active contract count for an agency
   */
  async decrementContractCount(agencyId: bigint): Promise<void> {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        activeContractsCount: { decrement: 1 },
      },
    });
  }

  /**
   * Increment active user count for an agency
   */
  async incrementUserCount(agencyId: bigint): Promise<void> {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        activeUsersCount: { increment: 1 },
      },
    });
  }

  /**
   * Decrement active user count for an agency
   */
  async decrementUserCount(agencyId: bigint): Promise<void> {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        activeUsersCount: { decrement: 1 },
      },
    });
  }

  /**
   * Get plan information for an agency
   */
  async getPlanInfo(agencyId: bigint) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        plan: true,
        maxContracts: true,
        maxUsers: true,
        maxProperties: true,
        activeContractsCount: true,
        activeUsersCount: true,
        activePropertiesCount: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        nextBillingDate: true,
        trialEndsAt: true,
        totalSpent: true,
      },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    return {
      currentPlan: agency.plan,
      subscriptionStatus: agency.subscriptionStatus,
      limits: {
        maxContracts: agency.maxContracts || planLimits.maxContracts,
        maxUsers: agency.maxUsers || planLimits.maxUsers,
        maxProperties: agency.maxProperties || planLimits.maxProperties,
      },
      usage: {
        contracts: agency.activeContractsCount || 0,
        users: agency.activeUsersCount || 0,
        properties: agency.activePropertiesCount || 0,
      },
      features: planLimits.features,
      microtransactionPrices: planLimits.microtransactionPrices || {},
      billing: {
        currentPeriodEnd: agency.currentPeriodEnd,
        nextBillingDate: agency.nextBillingDate,
        trialEndsAt: agency.trialEndsAt,
        totalSpent: agency.totalSpent,
      },
    };
  }
}
