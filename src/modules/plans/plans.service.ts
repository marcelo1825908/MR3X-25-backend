import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors/AppError';
import { DEFAULT_PLANS, Plan, getPlanUpdates, setPlanUpdate } from './plans.data';

export interface PlanUpdateDTO {
  price?: number;
  propertyLimit?: number;
  userLimit?: number;
  features?: string[];
  description?: string;
  isActive?: boolean;
}

export class PlansService {
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
        subscribers: update?.subscribers ?? defaultPlan.subscribers,
        createdAt: update?.createdAt ?? baseDate,
        updatedAt: update?.updatedAt ?? now,
      };
    }).sort((a, b) => a.price - b.price);
  }

  async getPlans() {
    // Calculate subscriber counts from database
    const agencyCounts = await prisma.agency.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    const userCounts = await prisma.user.groupBy({
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
    }));
  }

  async getPlanById(id: string) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.id === id);
    
    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    return plan;
  }

  async getPlanByName(name: string) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.name === name);
    
    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    return plan;
  }

  async updatePlan(id: string, data: PlanUpdateDTO) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.id === id);
    
    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    // Store update in memory
    setPlanUpdate(plan.name, {
      ...data,
      updatedAt: new Date(),
    });

    // Return updated plan
    return this.getPlanByName(plan.name);
  }

  async updatePlanByName(name: string, data: PlanUpdateDTO) {
    const plans = this.getPlansWithUpdates();
    const plan = plans.find(p => p.name === name);
    
    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    // Store update in memory
    setPlanUpdate(name, {
      ...data,
      updatedAt: new Date(),
    });

    // Return updated plan
    return this.getPlanByName(name);
  }

  async updateSubscriberCounts() {
    // Calculate subscriber counts from database
    const agencyCounts = await prisma.agency.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    const userCounts = await prisma.user.groupBy({
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

