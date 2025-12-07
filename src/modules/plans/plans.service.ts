import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { DEFAULT_PLANS, Plan, getPlanUpdates, setPlanUpdate } from './plans.data';
import { UserRole } from '@prisma/client';

export interface PlanUpdateDTO {
  price?: number;
  propertyLimit?: number;
  userLimit?: number;
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

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  // Get all plans with runtime updates applied
  private getPlansWithUpdates(): Plan[] {
    const now = new Date();
    const updates = getPlanUpdates();
    
    return DEFAULT_PLANS.map((defaultPlan, index) => {
      const update = updates.get(defaultPlan.name);
      const baseDate = new Date(2024, 0, 1 + index); // Different creation dates for each plan
      
      return {
        id: `plan-${defaultPlan.name.toLowerCase()}`,
        name: defaultPlan.name,
        price: update?.price ?? defaultPlan.price,
        propertyLimit: update?.propertyLimit ?? defaultPlan.propertyLimit,
        userLimit: update?.userLimit ?? defaultPlan.userLimit,
        features: update?.features ?? defaultPlan.features,
        description: update?.description ?? defaultPlan.description,
        isActive: update?.isActive ?? defaultPlan.isActive,
        subscribers: update?.subscribers ?? 0,
        createdAt: update?.createdAt ?? baseDate,
        updatedAt: update?.updatedAt ?? now,
      };
    }).sort((a, b) => a.price - b.price);
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

  async updatePlan(id: string, data: PlanUpdateDTO, userId: string, userRole: UserRole) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.id === id);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // CEO can update directly
    if (userRole === UserRole.CEO) {
      setPlanUpdate(plan.name, {
        ...data,
        updatedAt: new Date(),
      });
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
      setPlanUpdate(name, {
        ...data,
        updatedAt: new Date(),
      });
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

    // Create in-app notification (we'll store in audit log for now, or you can create a proper notification table)
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

  // Check if a user has reached their plan limits
  async checkPlanLimits(userId: string, limitType: 'property' | 'user'): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, plan: true, role: true },
    });

    if (!user) {
      return { allowed: false, current: 0, limit: 0, message: 'Usuário não encontrado' };
    }

    // Only apply limits to INDEPENDENT_OWNER role
    if (user.role !== UserRole.INDEPENDENT_OWNER) {
      return { allowed: true, current: 0, limit: -1 }; // -1 means unlimited
    }

    // Get the user's plan
    const planName = user.plan || 'FREE';
    let plan;
    try {
      plan = await this.getPlanByName(planName);
    } catch {
      // Default to FREE plan limits if plan not found
      plan = { propertyLimit: 5, userLimit: 3 };
    }

    if (limitType === 'property') {
      // Count properties owned by this user
      const propertyCount = await this.prisma.property.count({
        where: { ownerId: user.id },
      });

      const limit = plan.propertyLimit || 5;
      const allowed = propertyCount < limit;

      return {
        allowed,
        current: propertyCount,
        limit,
        message: allowed ? undefined : `Você atingiu o limite de ${limit} imóveis do seu plano ${planName}. Faça upgrade para adicionar mais imóveis.`,
      };
    }

    if (limitType === 'user') {
      // Count tenants created by this user
      const tenantCount = await this.prisma.user.count({
        where: {
          ownerId: user.id,
          role: UserRole.INQUILINO,
        },
      });

      const limit = plan.userLimit || 3;
      const allowed = tenantCount < limit;

      return {
        allowed,
        current: tenantCount,
        limit,
        message: allowed ? undefined : `Você atingiu o limite de ${limit} inquilinos do seu plano ${planName}. Faça upgrade para adicionar mais inquilinos.`,
      };
    }

    return { allowed: true, current: 0, limit: -1 };
  }

  // Get current usage for a user
  async getPlanUsage(userId: string): Promise<{ properties: { current: number; limit: number }; users: { current: number; limit: number }; plan: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, plan: true, role: true },
    });

    if (!user || user.role !== UserRole.INDEPENDENT_OWNER) {
      return {
        properties: { current: 0, limit: -1 },
        users: { current: 0, limit: -1 },
        plan: user?.plan || 'FREE',
      };
    }

    const planName = user.plan || 'FREE';
    let plan;
    try {
      plan = await this.getPlanByName(planName);
    } catch {
      plan = { propertyLimit: 5, userLimit: 3 };
    }

    const propertyCount = await this.prisma.property.count({
      where: { ownerId: user.id },
    });

    const tenantCount = await this.prisma.user.count({
      where: {
        ownerId: user.id,
        role: UserRole.INQUILINO,
      },
    });

    return {
      properties: { current: propertyCount, limit: plan.propertyLimit || 5 },
      users: { current: tenantCount, limit: plan.userLimit || 3 },
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

    // Update subscriber counts in memory
    planCounts.forEach((count, planName) => {
      setPlanUpdate(planName, { subscribers: count });
    });

    return { updated: planCounts.size };
  }
}

