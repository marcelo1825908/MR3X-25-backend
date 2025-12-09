import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  DEFAULT_PLANS,
  Plan,
  getPlanUpdates,
  setPlanUpdate,
  PLANS_CONFIG,
  PlanConfig,
  getMicrotransactionPricing,
  getFeaturePrice,
  isPlanFeatureAvailable,
  isFeaturePayPerUse,
  getAllPlansForDisplay,
  getPlanByName as getPlanConfigByName,
  calculateUpgradeCost,
  MicrotransactionPricing,
} from './plans.data';
import { UserRole, MicrotransactionType, MicrotransactionStatus } from '@prisma/client';

export interface PlanUpdateDTO {
  price?: number;
  propertyLimit?: number;
  userLimit?: number;
  contractLimit?: number;
  features?: string[];
  description?: string;
  isActive?: boolean;
}

export interface PlanModificationRequestDTO {
  id: string;
  planName: string;
  requestedBy: { id: string; name: string; email: string };
  status: string;
  currentValues: {
    price?: number;
    propertyLimit?: number;
    userLimit?: number;
    features?: string[];
    description?: string;
  };
  requestedValues: {
    price?: number;
    propertyLimit?: number;
    userLimit?: number;
    features?: string[];
    description?: string;
  };
  reviewedBy?: { id: string; name: string; email: string };
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface PlanUsageDTO {
  plan: string;
  planDisplayName: string;
  contracts: { current: number; limit: number; frozen: number };
  users: { current: number; limit: number; frozen: number };
  pricing: MicrotransactionPricing;
  features: {
    unlimitedInspections: boolean;
    unlimitedSettlements: boolean;
    apiAccess: boolean;
    apiAddOnEnabled: boolean;
    advancedReports: boolean;
    automations: boolean;
    whiteLabel: boolean;
  };
  billing: {
    monthlyPrice: number;
    apiAddOnPrice: number | null;
    supportTier: string;
  };
}

export interface ApiAddOnDTO {
  enabled: boolean;
  price: number;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  // Get all plans with runtime updates applied
  private getPlansWithUpdates(): Plan[] {
    const now = new Date();
    const updates = getPlanUpdates();

    return DEFAULT_PLANS.map((defaultPlan, index) => {
      const update = updates.get(defaultPlan.name);
      const baseDate = new Date(2024, 0, 1 + index);

      return {
        id: `plan-${defaultPlan.name.toLowerCase()}`,
        name: defaultPlan.name,
        price: update?.price ?? defaultPlan.price,
        propertyLimit: update?.maxActiveContracts ?? defaultPlan.propertyLimit,
        userLimit: update?.maxInternalUsers ?? defaultPlan.userLimit,
        features: update?.features ?? defaultPlan.features,
        description: update?.description ?? defaultPlan.description,
        isActive: true, // All configured plans are active
        subscribers: 0, // Will be calculated separately
        createdAt: baseDate,
        updatedAt: now,
      };
    }).sort((a, b) => a.price - b.price);
  }

  /**
   * Get all plans for display (new format with full configuration)
   */
  async getAllPlans(): Promise<PlanConfig[]> {
    // Calculate subscriber counts from database
    const agencyCounts = await this.prisma.agency.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    const planCounts = new Map<string, number>();
    agencyCounts.forEach(item => {
      planCounts.set(item.plan, item._count.plan);
    });

    return getAllPlansForDisplay().map(plan => ({
      ...plan,
      // Add subscriber count dynamically
    }));
  }

  async getPlans() {
    // Calculate subscriber counts from database
    const agencyCounts = await this.prisma.agency.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    const userCounts = await this.prisma.user.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    const planCounts = new Map<string, number>();
    agencyCounts.forEach(item => {
      planCounts.set(item.plan, (planCounts.get(item.plan) || 0) + item._count.plan);
    });
    userCounts.forEach(item => {
      planCounts.set(item.plan, (planCounts.get(item.plan) || 0) + item._count.plan);
    });

    // Get plans with updates and apply subscriber counts
    const plans = this.getPlansWithUpdates();
    return plans.map(plan => ({
      ...plan,
      subscribers: planCounts.get(plan.name) || 0,
      features: Array.isArray(plan.features) ? plan.features : [],
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    }));
  }

  async getPlanById(id: string) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.id === id);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return {
      ...plan,
      features: Array.isArray(plan.features) ? plan.features : [],
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  async getPlanByName(name: string) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.name === name);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return {
      ...plan,
      features: Array.isArray(plan.features) ? plan.features : [],
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  /**
   * Get full plan configuration by name (new format)
   */
  getPlanConfig(planName: string): PlanConfig | null {
    return getPlanConfigByName(planName);
  }

  /**
   * Get microtransaction pricing for an agency's plan
   */
  async getMicrotransactionPricingForAgency(agencyId: string): Promise<MicrotransactionPricing> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planName = agency?.plan || 'FREE';
    return getMicrotransactionPricing(planName);
  }

  /**
   * Get the price for a specific feature based on agency's plan
   */
  async getFeaturePriceForAgency(
    agencyId: string,
    feature: 'inspection' | 'settlement' | 'screening' | 'extraContract' | 'apiAddOn'
  ): Promise<number | null> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planName = agency?.plan || 'FREE';
    return getFeaturePrice(planName, feature);
  }

  /**
   * Check if a feature requires payment for an agency
   */
  async isFeaturePayPerUseForAgency(
    agencyId: string,
    feature: 'inspection' | 'settlement' | 'screening' | 'extraContract'
  ): Promise<boolean> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planName = agency?.plan || 'FREE';
    return isFeaturePayPerUse(planName, feature);
  }

  /**
   * Check if a feature is available (unlimited) for an agency
   */
  async isFeatureUnlimitedForAgency(
    agencyId: string,
    feature: 'inspections' | 'settlements' | 'api' | 'advancedReports' | 'automations' | 'whiteLabel'
  ): Promise<boolean> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true, apiAddOnEnabled: true },
    });

    const planName = agency?.plan || 'FREE';
    const planConfig = getPlanConfigByName(planName);

    // Special handling for API - check if add-on is enabled for PROFESSIONAL
    if (feature === 'api') {
      if (planConfig?.apiAccessIncluded) return true;
      if (planConfig?.apiAccessOptional && agency?.apiAddOnEnabled) return true;
      return false;
    }

    return isPlanFeatureAvailable(planName, feature);
  }

  /**
   * Get comprehensive plan usage for an agency (contract-based)
   */
  async getAgencyPlanUsage(agencyId: string): Promise<PlanUsageDTO> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: {
        plan: true,
        maxContracts: true,
        maxUsers: true,
        apiEnabled: true,
        apiAddOnEnabled: true,
        frozenContractsCount: true,
        frozenUsersCount: true,
        activeContractsCount: true,
        activeUsersCount: true,
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const planName = agency.plan || 'FREE';
    const planConfig = getPlanConfigByName(planName) || PLANS_CONFIG.FREE;

    // Count active contracts
    const activeContracts = await this.prisma.contract.count({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
        status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
      },
    });

    // Count frozen contracts
    const frozenContracts = await this.prisma.contract.count({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: true,
      },
    });

    // Count active internal users (excluding tenants and property owners)
    const activeUsers = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: {
          in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER],
        },
      },
    });

    // Count frozen users
    const frozenUsers = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: true,
      },
    });

    const pricing = getMicrotransactionPricing(planName);
    const userLimit = planConfig.maxInternalUsers === -1 ? 9999 : planConfig.maxInternalUsers;

    return {
      plan: planName,
      planDisplayName: planConfig.displayName,
      contracts: {
        current: activeContracts,
        limit: planConfig.maxActiveContracts,
        frozen: frozenContracts,
      },
      users: {
        current: activeUsers,
        limit: userLimit,
        frozen: frozenUsers,
      },
      pricing,
      features: {
        unlimitedInspections: planConfig.unlimitedInspections,
        unlimitedSettlements: planConfig.unlimitedSettlements,
        apiAccess: planConfig.apiAccessIncluded || (planConfig.apiAccessOptional && agency.apiAddOnEnabled),
        apiAddOnEnabled: agency.apiAddOnEnabled || false,
        advancedReports: planConfig.advancedReports,
        automations: planConfig.automations,
        whiteLabel: planConfig.whiteLabel,
      },
      billing: {
        monthlyPrice: planConfig.price,
        apiAddOnPrice: planConfig.apiAddOnPrice,
        supportTier: planConfig.supportTier,
      },
    };
  }

  /**
   * Check if agency can create a new contract
   */
  async canCreateContract(agencyId: string): Promise<{ allowed: boolean; message?: string; pricing?: number }> {
    const usage = await this.getAgencyPlanUsage(agencyId);

    if (usage.contracts.current < usage.contracts.limit) {
      return { allowed: true };
    }

    // Over limit - offer extra contract purchase
    return {
      allowed: false,
      message: `Você atingiu o limite de ${usage.contracts.limit} contratos ativos do plano ${usage.planDisplayName}. Você pode adicionar contratos extras por R$ ${usage.pricing.extraContract.toFixed(2)}/cada ou fazer upgrade.`,
      pricing: usage.pricing.extraContract,
    };
  }

  /**
   * Check if agency can perform an inspection
   */
  async canPerformInspection(agencyId: string): Promise<{ allowed: boolean; requiresPayment: boolean; price?: number }> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planName = agency?.plan || 'FREE';
    const planConfig = getPlanConfigByName(planName) || PLANS_CONFIG.FREE;

    if (planConfig.unlimitedInspections) {
      return { allowed: true, requiresPayment: false };
    }

    return {
      allowed: true,
      requiresPayment: true,
      price: planConfig.inspectionPrice || 3.90,
    };
  }

  /**
   * Check if agency can create a settlement/agreement
   */
  async canCreateSettlement(agencyId: string): Promise<{ allowed: boolean; requiresPayment: boolean; price?: number }> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planName = agency?.plan || 'FREE';
    const planConfig = getPlanConfigByName(planName) || PLANS_CONFIG.FREE;

    if (planConfig.unlimitedSettlements) {
      return { allowed: true, requiresPayment: false };
    }

    return {
      allowed: true,
      requiresPayment: true,
      price: planConfig.settlementPrice || 6.90,
    };
  }

  /**
   * Get tenant screening price for agency
   */
  async getScreeningPrice(agencyId: string): Promise<number> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planName = agency?.plan || 'FREE';
    const planConfig = getPlanConfigByName(planName) || PLANS_CONFIG.FREE;

    return planConfig.screeningPrice;
  }

  /**
   * Enable API add-on for PROFESSIONAL plan
   */
  async enableApiAddOn(agencyId: string): Promise<ApiAddOnDTO> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true, apiAddOnEnabled: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const planConfig = getPlanConfigByName(agency.plan);

    // Check if API is already included
    if (planConfig?.apiAccessIncluded) {
      throw new BadRequestException('API access is already included in your plan');
    }

    // Check if API add-on is available
    if (!planConfig?.apiAccessOptional) {
      throw new BadRequestException('API add-on is not available for your plan. Please upgrade to PROFESSIONAL or ENTERPRISE.');
    }

    // Check if already enabled
    if (agency.apiAddOnEnabled) {
      throw new BadRequestException('API add-on is already enabled');
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    // Generate API key
    const apiKey = this.generateApiKey();

    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        apiAddOnEnabled: true,
        apiAddOnPrice: planConfig.apiAddOnPrice,
        apiAddOnStartDate: now,
        apiAddOnEndDate: endDate,
        apiEnabled: true,
        apiKey,
      },
    });

    // Create microtransaction record
    await this.prisma.microtransaction.create({
      data: {
        agencyId: BigInt(agencyId),
        type: MicrotransactionType.API_CALL, // Using API_CALL type for add-on
        amount: planConfig.apiAddOnPrice || 29.00,
        description: 'API Add-On Subscription',
        status: MicrotransactionStatus.PENDING,
      },
    });

    return {
      enabled: true,
      price: planConfig.apiAddOnPrice || 29.00,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  /**
   * Disable API add-on
   */
  async disableApiAddOn(agencyId: string): Promise<void> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true, apiAddOnEnabled: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const planConfig = getPlanConfigByName(agency.plan);

    // Can't disable if API is included in plan
    if (planConfig?.apiAccessIncluded) {
      throw new BadRequestException('Cannot disable API access as it is included in your plan');
    }

    if (!agency.apiAddOnEnabled) {
      throw new BadRequestException('API add-on is not currently enabled');
    }

    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        apiAddOnEnabled: false,
        apiEnabled: false,
        apiKey: null,
      },
    });
  }

  /**
   * Calculate upgrade cost between plans
   */
  async calculateUpgrade(agencyId: string, targetPlan: string): Promise<{
    currentPlan: string;
    targetPlan: string;
    proratedAmount: number;
    newMonthlyPrice: number;
    daysRemaining: number;
    changes: {
      contracts: { current: number; new: number };
      users: { current: number; new: number };
      newFeatures: string[];
    };
  }> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true, currentPeriodEnd: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const currentPlanName = agency.plan || 'FREE';
    const currentConfig = getPlanConfigByName(currentPlanName);
    const targetConfig = getPlanConfigByName(targetPlan);

    if (!targetConfig) {
      throw new BadRequestException(`Invalid target plan: ${targetPlan}`);
    }

    // Calculate days remaining in current period
    let daysRemaining = 30;
    if (agency.currentPeriodEnd) {
      const now = new Date();
      const diff = agency.currentPeriodEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const { proratedAmount, newMonthlyPrice } = calculateUpgradeCost(currentPlanName, targetPlan, daysRemaining);

    // Determine new features
    const newFeatures: string[] = [];
    if (!currentConfig?.unlimitedInspections && targetConfig.unlimitedInspections) {
      newFeatures.push('Vistorias ilimitadas');
    }
    if (!currentConfig?.unlimitedSettlements && targetConfig.unlimitedSettlements) {
      newFeatures.push('Acordos ilimitados');
    }
    if (!currentConfig?.apiAccessIncluded && targetConfig.apiAccessIncluded) {
      newFeatures.push('API incluída');
    }
    if (!currentConfig?.apiAccessOptional && targetConfig.apiAccessOptional) {
      newFeatures.push('API opcional disponível');
    }
    if (!currentConfig?.automations && targetConfig.automations) {
      newFeatures.push('Automações');
    }
    if (!currentConfig?.whiteLabel && targetConfig.whiteLabel) {
      newFeatures.push('White-label');
    }
    if (!currentConfig?.support24x7 && targetConfig.support24x7) {
      newFeatures.push('Suporte 24/7');
    }

    return {
      currentPlan: currentPlanName,
      targetPlan,
      proratedAmount,
      newMonthlyPrice,
      daysRemaining,
      changes: {
        contracts: {
          current: currentConfig?.maxActiveContracts || 1,
          new: targetConfig.maxActiveContracts,
        },
        users: {
          current: currentConfig?.maxInternalUsers || 2,
          new: targetConfig.maxInternalUsers,
        },
        newFeatures,
      },
    };
  }

  private generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'mr3x_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async updatePlan(id: string, data: PlanUpdateDTO, userId: string, userRole: UserRole) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.id === id);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // CEO can update directly
    if (userRole === UserRole.CEO) {
      // Convert PlanUpdateDTO to Partial<PlanConfig>
      const updateData: Partial<PlanConfig> = {
        price: data.price,
        maxActiveContracts: data.contractLimit ?? data.propertyLimit,
        maxInternalUsers: data.userLimit,
        features: data.features,
        description: data.description,
      };
      setPlanUpdate(plan.name, updateData);
      return this.getPlanByName(plan.name);
    }

    // ADMIN creates a modification request
    if (userRole === UserRole.ADMIN) {
      return this.createModificationRequest(plan.name, data, userId);
    }

    throw new ForbiddenException('You do not have permission to modify plans');
  }

  async updatePlanByName(name: string, data: PlanUpdateDTO, userId: string, userRole: UserRole) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.name === name);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // CEO can update directly
    if (userRole === UserRole.CEO) {
      // Convert PlanUpdateDTO to Partial<PlanConfig>
      const updateData: Partial<PlanConfig> = {
        price: data.price,
        maxActiveContracts: data.contractLimit ?? data.propertyLimit,
        maxInternalUsers: data.userLimit,
        features: data.features,
        description: data.description,
      };
      setPlanUpdate(name, updateData);
      return this.getPlanByName(name);
    }

    // ADMIN creates a modification request
    if (userRole === UserRole.ADMIN) {
      return this.createModificationRequest(name, data, userId);
    }

    throw new ForbiddenException('You do not have permission to modify plans');
  }

  // Create a modification request for ADMIN users
  private async createModificationRequest(planName: string, data: PlanUpdateDTO, requestedById: string) {
    const currentPlan = await this.getPlanByName(planName);

    const request = await this.prisma.planModificationRequest.create({
      data: {
        planName,
        requestedById: BigInt(requestedById),
        status: 'PENDING',
        currentPrice: currentPlan.price,
        currentPropertyLimit: currentPlan.propertyLimit,
        currentUserLimit: currentPlan.userLimit,
        currentFeatures: JSON.stringify(currentPlan.features),
        currentDescription: currentPlan.description,
        requestedPrice: data.price,
        requestedPropertyLimit: data.propertyLimit,
        requestedUserLimit: data.userLimit,
        requestedFeatures: data.features ? JSON.stringify(data.features) : undefined,
        requestedDescription: data.description,
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Send notification to CEO users
    await this.notifyCEOAboutRequest(request.id, planName, requestedById);

    return {
      message: 'Solicitação de modificação criada. Aguardando aprovação do CEO.',
      requestId: request.id.toString(),
      status: 'PENDING',
    };
  }

  // Notify CEO users about new modification request
  private async notifyCEOAboutRequest(requestId: bigint, planName: string, requestedById: string) {
    // Find all CEO users
    const ceoUsers = await this.prisma.user.findMany({
      where: { role: UserRole.CEO, status: 'ACTIVE' },
      select: { id: true },
    });

    const requester = await this.prisma.user.findUnique({
      where: { id: BigInt(requestedById) },
      select: { name: true },
    });

    // Create in-app notification
    for (const ceo of ceoUsers) {
      await this.prisma.auditLog.create({
        data: {
          event: 'PLAN_MODIFICATION_REQUEST',
          userId: ceo.id,
          entity: 'PlanModificationRequest',
          entityId: requestId,
          dataAfter: JSON.stringify({
            message: `${requester?.name || 'Um administrador'} solicitou modificação no plano ${planName}. Aguardando sua aprovação.`,
            requestId: requestId.toString(),
            planName,
            requestedBy: requestedById,
          }),
        },
      });
    }
  }

  // Get all pending modification requests (for CEO)
  async getPendingModificationRequests(): Promise<PlanModificationRequestDTO[]> {
    const requests = await this.prisma.planModificationRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map(r => this.formatModificationRequest(r));
  }

  // Get all modification requests (for history)
  async getAllModificationRequests(): Promise<PlanModificationRequestDTO[]> {
    const requests = await this.prisma.planModificationRequest.findMany({
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map(r => this.formatModificationRequest(r));
  }

  // Approve a modification request (CEO only)
  async approveModificationRequest(requestId: string, reviewerId: string) {
    const request = await this.prisma.planModificationRequest.findUnique({
      where: { id: BigInt(requestId) },
    });

    if (!request) {
      throw new NotFoundException('Modification request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ForbiddenException('This request has already been processed');
    }

    // Apply the changes to the plan
    const updateData: any = {};
    if (request.requestedPrice !== null) updateData.price = Number(request.requestedPrice);
    if (request.requestedPropertyLimit !== null) updateData.propertyLimit = request.requestedPropertyLimit;
    if (request.requestedUserLimit !== null) updateData.userLimit = request.requestedUserLimit;
    if (request.requestedFeatures) updateData.features = JSON.parse(request.requestedFeatures);
    if (request.requestedDescription !== null) updateData.description = request.requestedDescription;

    setPlanUpdate(request.planName, {
      ...updateData,
      updatedAt: new Date(),
    });

    // Update the request status
    const updatedRequest = await this.prisma.planModificationRequest.update({
      where: { id: BigInt(requestId) },
      data: {
        status: 'APPROVED',
        reviewedById: BigInt(reviewerId),
        reviewedAt: new Date(),
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Notify the admin who made the request
    await this.prisma.auditLog.create({
      data: {
        event: 'PLAN_MODIFICATION_APPROVED',
        userId: request.requestedById,
        entity: 'PlanModificationRequest',
        entityId: request.id,
        dataAfter: JSON.stringify({
          message: `Sua solicitação de modificação do plano ${request.planName} foi aprovada.`,
          requestId: request.id.toString(),
          planName: request.planName,
        }),
      },
    });

    return {
      message: 'Solicitação aprovada. As alterações foram aplicadas ao plano.',
      request: this.formatModificationRequest(updatedRequest),
    };
  }

  // Reject a modification request (CEO only)
  async rejectModificationRequest(requestId: string, reviewerId: string, reason?: string) {
    const request = await this.prisma.planModificationRequest.findUnique({
      where: { id: BigInt(requestId) },
    });

    if (!request) {
      throw new NotFoundException('Modification request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ForbiddenException('This request has already been processed');
    }

    // Update the request status
    const updatedRequest = await this.prisma.planModificationRequest.update({
      where: { id: BigInt(requestId) },
      data: {
        status: 'REJECTED',
        reviewedById: BigInt(reviewerId),
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Notify the admin who made the request
    await this.prisma.auditLog.create({
      data: {
        event: 'PLAN_MODIFICATION_REJECTED',
        userId: request.requestedById,
        entity: 'PlanModificationRequest',
        entityId: request.id,
        dataAfter: JSON.stringify({
          message: `Sua solicitação de modificação do plano ${request.planName} foi rejeitada.${reason ? ` Motivo: ${reason}` : ''}`,
          requestId: request.id.toString(),
          planName: request.planName,
          reason,
        }),
      },
    });

    return {
      message: 'Solicitação rejeitada.',
      request: this.formatModificationRequest(updatedRequest),
    };
  }

  // Helper to format modification request
  private formatModificationRequest(r: any): PlanModificationRequestDTO {
    return {
      id: r.id.toString(),
      planName: r.planName,
      requestedBy: {
        id: r.requestedBy.id.toString(),
        name: r.requestedBy.name || '',
        email: r.requestedBy.email,
      },
      status: r.status,
      currentValues: {
        price: r.currentPrice ? Number(r.currentPrice) : undefined,
        propertyLimit: r.currentPropertyLimit || undefined,
        userLimit: r.currentUserLimit || undefined,
        features: r.currentFeatures ? JSON.parse(r.currentFeatures) : undefined,
        description: r.currentDescription || undefined,
      },
      requestedValues: {
        price: r.requestedPrice ? Number(r.requestedPrice) : undefined,
        propertyLimit: r.requestedPropertyLimit || undefined,
        userLimit: r.requestedUserLimit || undefined,
        features: r.requestedFeatures ? JSON.parse(r.requestedFeatures) : undefined,
        description: r.requestedDescription || undefined,
      },
      reviewedBy: r.reviewedBy ? {
        id: r.reviewedBy.id.toString(),
        name: r.reviewedBy.name || '',
        email: r.reviewedBy.email,
      } : undefined,
      reviewedAt: r.reviewedAt?.toISOString(),
      rejectionReason: r.rejectionReason || undefined,
      createdAt: r.createdAt.toISOString(),
    };
  }

  // Check if a user has reached their plan limits (legacy - for backward compatibility)
  async checkPlanLimits(userId: string, limitType: 'property' | 'user' | 'contract'): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, plan: true, role: true, agencyId: true },
    });

    if (!user) {
      return { allowed: false, current: 0, limit: 0, message: 'Usuário não encontrado' };
    }

    // If user belongs to an agency, check agency limits
    if (user.agencyId) {
      const agency = await this.prisma.agency.findUnique({
        where: { id: user.agencyId },
        select: { id: true, plan: true },
      });

      if (agency) {
        const planConfig = getPlanConfigByName(agency.plan || 'FREE');

        if (limitType === 'contract') {
          const contractCount = await this.prisma.contract.count({
            where: {
              agencyId: agency.id,
              deleted: false,
              isFrozen: false,
              status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
            },
          });

          const limit = planConfig?.maxActiveContracts || 1;
          const allowed = contractCount < limit;

          return {
            allowed,
            current: contractCount,
            limit,
            message: allowed ? undefined : `Você atingiu o limite de ${limit} contratos ativos do plano ${agency.plan}. Faça upgrade para adicionar mais contratos.`,
          };
        }
      }
    }

    // For independent owners or property limit check
    if (user.role === UserRole.INDEPENDENT_OWNER || limitType === 'property') {
      const planName = user.plan || 'FREE';
      const planConfig = getPlanConfigByName(planName);

      if (limitType === 'property') {
        const propertyCount = await this.prisma.property.count({
          where: { ownerId: user.id, deleted: false },
        });

        const limit = planConfig?.maxActiveContracts || 1; // Using contract limit as property limit for independent owners
        const allowed = propertyCount < limit;

        return {
          allowed,
          current: propertyCount,
          limit,
          message: allowed ? undefined : `Você atingiu o limite de ${limit} imóveis do seu plano ${planName}. Faça upgrade para adicionar mais imóveis.`,
        };
      }
    }

    return { allowed: true, current: 0, limit: -1 };
  }

  // Get current usage for a user (legacy - for backward compatibility)
  async getPlanUsage(userId: string): Promise<{ properties: { current: number; limit: number }; users: { current: number; limit: number }; contracts: { current: number; limit: number }; plan: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, plan: true, role: true, agencyId: true },
    });

    if (!user) {
      return {
        properties: { current: 0, limit: -1 },
        users: { current: 0, limit: -1 },
        contracts: { current: 0, limit: -1 },
        plan: 'FREE',
      };
    }

    // If user belongs to an agency
    if (user.agencyId) {
      const usage = await this.getAgencyPlanUsage(user.agencyId.toString());

      return {
        properties: { current: 0, limit: -1 }, // Properties not limited for agencies
        users: { current: usage.users.current, limit: usage.users.limit },
        contracts: { current: usage.contracts.current, limit: usage.contracts.limit },
        plan: usage.plan,
      };
    }

    const planName = user.plan || 'FREE';
    const planConfig = getPlanConfigByName(planName);

    const propertyCount = await this.prisma.property.count({
      where: { ownerId: user.id, deleted: false },
    });

    const contractCount = await this.prisma.contract.count({
      where: { ownerId: user.id, deleted: false },
    });

    return {
      properties: { current: propertyCount, limit: planConfig?.maxActiveContracts || 1 },
      users: { current: 0, limit: planConfig?.maxInternalUsers || 2 },
      contracts: { current: contractCount, limit: planConfig?.maxActiveContracts || 1 },
      plan: planName,
    };
  }

  async updateSubscriberCounts() {
    // Calculate subscriber counts from database
    const agencyCounts = await this.prisma.agency.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    const userCounts = await this.prisma.user.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    const planCounts = new Map<string, number>();
    agencyCounts.forEach(item => {
      planCounts.set(item.plan, (planCounts.get(item.plan) || 0) + item._count.plan);
    });
    userCounts.forEach(item => {
      planCounts.set(item.plan, (planCounts.get(item.plan) || 0) + item._count.plan);
    });

    // Subscriber counts are now stored in database per agency, not in plan config
    // This method returns the current counts for reporting purposes
    return {
      updated: planCounts.size,
      counts: Object.fromEntries(planCounts),
    };
  }
}
