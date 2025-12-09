import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlanEnforcementService } from '../plans/plan-enforcement.service';
import { getPlanLimitsForEntity } from '../plans/plans.data';

export interface AgencyCreateDTO {
  name: string;
  cnpj: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  plan?: string;
  maxProperties?: number;
  maxUsers?: number;
  agencyFee?: number;
}

export interface AgencyUpdateDTO {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  plan?: string;
  status?: string;
  maxProperties?: number;
  maxUsers?: number;
  agencyFee?: number;
}

@Injectable()
export class AgenciesService {
  constructor(
    private prisma: PrismaService,
    private planEnforcement: PlanEnforcementService,
  ) {}

  async createAgency(data: AgencyCreateDTO) {
    // Check if agency with this CNPJ already exists
    const cleanCnpj = data.cnpj.replace(/\D/g, '');
    const existingAgency = await this.prisma.agency.findUnique({
      where: { cnpj: cleanCnpj },
    });

    if (existingAgency) {
      throw new BadRequestException('Agency with this CNPJ already exists');
    }

    // Check if agency with this email already exists
    const existingEmail = await this.prisma.agency.findFirst({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new BadRequestException('Agency with this email already exists');
    }

    // Get plan limits for the selected plan
    const planName = data.plan || 'FREE';
    const planLimits = getPlanLimitsForEntity(planName, 'agency');

    const agency = await this.prisma.agency.create({
      data: {
        name: data.name,
        cnpj: cleanCnpj,
        email: data.email,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        plan: planName,
        status: 'ACTIVE',
        maxProperties: planLimits.contracts, // Use contract-based plan limits
        maxUsers: planLimits.users, // Use plan limits
        agencyFee: data.agencyFee ?? 8,
        apiEnabled: planLimits.apiAccess,
        lastPlanChange: new Date(),
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        apiEnabled: true,
        frozenPropertiesCount: true,
        frozenUsersCount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    return {
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties || 0,
      maxUsers: agency.maxUsers || 0,
      agencyFee: agency.agencyFee ?? 8,
      apiEnabled: agency.apiEnabled,
      frozenPropertiesCount: agency.frozenPropertiesCount,
      frozenUsersCount: agency.frozenUsersCount,
      userCount: agency._count.users,
      propertyCount: agency._count.properties,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
    };
  }

  async getAgencies() {
    const agencies = await this.prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to match frontend expectations
    return agencies.map(agency => ({
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties || 0,
      maxUsers: agency.maxUsers || 0,
      agencyFee: agency.agencyFee ?? 8,
      userCount: agency._count.users,
      propertyCount: agency._count.properties,
    }));
  }

  async getAgencyById(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        properties: {
          select: {
            id: true,
            name: true,
            address: true,
            status: true,
          },
        },
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    return {
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties,
      maxUsers: agency.maxUsers,
      agencyFee: agency.agencyFee,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
      users: agency.users.map(u => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
      properties: agency.properties.map(p => ({
        id: p.id.toString(),
        name: p.name,
        address: p.address,
        status: p.status,
      })),
    };
  }

  async updateAgency(id: string, data: AgencyUpdateDTO) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    // If email is being updated, check for duplicates
    if (data.email && data.email !== agency.email) {
      const existingEmail = await this.prisma.agency.findFirst({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new BadRequestException('Agency with this email already exists');
      }
    }

    // Check if plan is being changed
    const isPlanChange = data.plan && data.plan !== agency.plan;
    let planEnforcementResult: Awaited<ReturnType<typeof this.planEnforcement.enforcePlanLimits>> | null = null;

    // If plan is changing, enforce plan limits AFTER updating the agency
    if (isPlanChange && data.plan) {
      // Get new plan limits
      const newPlanLimits = getPlanLimitsForEntity(data.plan, 'agency');

      // Update agency with new plan and limits
      const updated = await this.prisma.agency.update({
        where: { id: BigInt(id) },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          plan: data.plan,
          status: data.status,
          maxProperties: newPlanLimits.contracts,
          maxUsers: newPlanLimits.users,
          agencyFee: data.agencyFee !== undefined ? Math.max(0, Math.min(100, data.agencyFee)) : undefined,
          lastPlanChange: new Date(),
        },
        select: {
          id: true,
          name: true,
          cnpj: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          status: true,
          plan: true,
          maxProperties: true,
          maxUsers: true,
          agencyFee: true,
          apiEnabled: true,
          frozenPropertiesCount: true,
          frozenUsersCount: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              properties: true,
            },
          },
        },
      });

      // Now enforce plan limits (freeze/unfreeze as needed)
      planEnforcementResult = await this.planEnforcement.enforcePlanLimits(id, data.plan!);

      // Get updated frozen counts after enforcement
      const updatedAgency = await this.prisma.agency.findUnique({
        where: { id: BigInt(id) },
        select: {
          frozenPropertiesCount: true,
          frozenUsersCount: true,
        },
      });

      return {
        id: updated.id.toString(),
        name: updated.name,
        cnpj: updated.cnpj,
        email: updated.email,
        phone: updated.phone || '',
        address: updated.address || '',
        city: updated.city || '',
        state: updated.state || '',
        zipCode: updated.zipCode || '',
        status: updated.status,
        plan: updated.plan,
        maxProperties: updated.maxProperties,
        maxUsers: updated.maxUsers,
        agencyFee: updated.agencyFee,
        apiEnabled: updated.apiEnabled,
        frozenPropertiesCount: updatedAgency?.frozenPropertiesCount || 0,
        frozenUsersCount: updatedAgency?.frozenUsersCount || 0,
        propertyCount: updated._count.properties,
        userCount: updated._count.users,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        planEnforcement: planEnforcementResult,
      };
    }

    // No plan change - normal update without enforcement
    const updated = await this.prisma.agency.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        status: data.status,
        agencyFee: data.agencyFee !== undefined ? Math.max(0, Math.min(100, data.agencyFee)) : undefined,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        apiEnabled: true,
        frozenPropertiesCount: true,
        frozenUsersCount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    return {
      id: updated.id.toString(),
      name: updated.name,
      cnpj: updated.cnpj,
      email: updated.email,
      phone: updated.phone || '',
      address: updated.address || '',
      city: updated.city || '',
      state: updated.state || '',
      zipCode: updated.zipCode || '',
      status: updated.status,
      plan: updated.plan,
      maxProperties: updated.maxProperties,
      maxUsers: updated.maxUsers,
      agencyFee: updated.agencyFee,
      apiEnabled: updated.apiEnabled,
      frozenPropertiesCount: updated.frozenPropertiesCount,
      frozenUsersCount: updated.frozenUsersCount,
      propertyCount: updated._count.properties,
      userCount: updated._count.users,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteAgency(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
      include: {
        users: true,
        properties: true,
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    if (agency.users.length > 0) {
      throw new BadRequestException('Cannot delete agency with associated users');
    }

    if (agency.properties.length > 0) {
      throw new BadRequestException('Cannot delete agency with associated properties');
    }

    await this.prisma.agency.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Agency deleted successfully' };
  }

  // Plan enforcement methods

  /**
   * Get plan usage summary for an agency
   */
  async getPlanUsage(agencyId: string) {
    return this.planEnforcement.getFrozenEntitiesSummary(agencyId);
  }

  /**
   * Get list of frozen entities for an agency
   */
  async getFrozenEntities(agencyId: string) {
    return this.planEnforcement.getFrozenEntitiesList(agencyId);
  }

  /**
   * Preview what would happen if agency changes to a different plan
   */
  async previewPlanChange(agencyId: string, newPlan: string) {
    return this.planEnforcement.previewPlanChange(agencyId, newPlan);
  }

  /**
   * Switch active contract for FREE plan (only 1 contract allowed)
   */
  async switchActiveContract(agencyId: string, newActiveContractId: string) {
    return this.planEnforcement.switchActiveContract(agencyId, newActiveContractId);
  }

  /**
   * Manually enforce plan limits (admin operation)
   */
  async enforcePlanLimits(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    return this.planEnforcement.enforcePlanLimits(agencyId, agency.plan);
  }

  /**
   * Check if contract creation is allowed for the agency
   */
  async checkContractCreationAllowed(agencyId: string) {
    return this.planEnforcement.checkContractOperationAllowed(agencyId, 'create');
  }

  /**
   * Check if user creation is allowed for the agency
   */
  async checkUserCreationAllowed(agencyId: string) {
    return this.planEnforcement.checkUserOperationAllowed(agencyId, 'create');
  }
}
