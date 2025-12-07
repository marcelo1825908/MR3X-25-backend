import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PLAN_LIMITS, getPlanLimitsForEntity, EntityType, PlanLimits } from './plans.data';
import { UserRole } from '@prisma/client';

// Message templates in Portuguese
export const PLAN_MESSAGES = {
  PROPERTY_FROZEN: 'Este imóvel está congelado. Seu plano atual permite apenas {limit} imóvel(eis) ativo(s). Faça upgrade para desbloquear.',
  USER_FROZEN: 'Este usuário está desativado devido ao limite do plano. Faça upgrade para reativar.',
  CREATE_PROPERTY_BLOCKED: 'Você atingiu o limite de {limit} imóvel(eis) do seu plano {plan}. Faça upgrade para adicionar mais imóveis.',
  CREATE_USER_BLOCKED: 'Você atingiu o limite de {limit} usuário(s) do seu plano {plan}. Faça upgrade para adicionar mais usuários.',
  CONTRACT_ON_FROZEN_PROPERTY: 'Não é possível criar contratos para imóveis congelados. Faça upgrade ou ative este imóvel primeiro.',
  PAYMENT_ON_FROZEN_PROPERTY: 'Não é possível registrar pagamentos para imóveis congelados.',
  INSPECTION_ON_FROZEN_PROPERTY: 'Não é possível registrar inspeções para imóveis congelados.',
  EDIT_FROZEN_PROPERTY: 'Este imóvel está congelado e não pode ser editado. Faça upgrade do seu plano.',
  EDIT_FROZEN_USER: 'Este usuário está congelado e não pode ser editado. Faça upgrade do seu plano.',
  UPGRADE_SUCCESS: 'Upgrade realizado com sucesso! Todos os seus imóveis e usuários foram desbloqueados.',
  DOWNGRADE_WARNING: 'Ao fazer downgrade para o plano {plan}, {freezeCount} imóvel(eis) e {userFreezeCount} usuário(s) serão congelados.',
  SWITCH_ACTIVE_SUCCESS: 'Imóvel ativo alterado com sucesso.',
  LOGIN_BLOCKED_FROZEN: 'Sua conta está temporariamente desativada devido ao limite do plano. Entre em contato com o administrador da agência.',
  API_DISABLED: 'Acesso à API não está disponível no plano FREE. Faça upgrade para habilitar.',
};

// Result interfaces
export interface OperationResult {
  allowed: boolean;
  message?: string;
  current?: number;
  limit?: number;
}

export interface FreezeResult {
  frozen: number;
  kept: string[];
  message: string;
}

export interface UnfreezeResult {
  unfrozen: number;
  message: string;
}

export interface EnforcementResult {
  propertiesFrozen: number;
  usersFrozen: number;
  propertiesUnfrozen: number;
  usersUnfrozen: number;
  message: string;
}

export interface SwitchResult {
  success: boolean;
  message: string;
  frozenProperty?: { id: string; name: string };
  activatedProperty?: { id: string; name: string };
}

export interface FrozenSummary {
  properties: {
    active: number;
    frozen: number;
    total: number;
    limit: number;
  };
  users: {
    active: number;
    frozen: number;
    total: number;
    limit: number;
  };
  isOverLimit: boolean;
  upgradeRequired: boolean;
  plan: string;
}

export interface FrozenEntity {
  id: string;
  name: string;
  frozenAt: string;
  frozenReason: string;
}

export interface FrozenEntitiesList {
  properties: FrozenEntity[];
  users: Array<FrozenEntity & { email: string }>;
}

@Injectable()
export class PlanEnforcementService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get plan limits for a specific entity type
   */
  getPlanLimits(planName: string, entityType: EntityType): PlanLimits {
    return getPlanLimitsForEntity(planName, entityType);
  }

  /**
   * Check if a property operation is allowed based on agency plan
   */
  async checkPropertyOperationAllowed(
    agencyId: string,
    operation: 'create' | 'update' | 'delete',
    propertyId?: string,
  ): Promise<OperationResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true, maxProperties: true },
    });

    if (!agency) {
      return { allowed: false, message: 'Agência não encontrada' };
    }

    const limits = this.getPlanLimits(agency.plan, 'agency');

    // For update/delete, check if the specific property is frozen
    if ((operation === 'update' || operation === 'delete') && propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: BigInt(propertyId) },
        select: { isFrozen: true, frozenReason: true },
      });

      if (property?.isFrozen) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.EDIT_FROZEN_PROPERTY,
        };
      }
    }

    // For create, check if agency has reached property limit
    if (operation === 'create') {
      const activePropertyCount = await this.prisma.property.count({
        where: {
          agencyId: BigInt(agencyId),
          deleted: false,
          isFrozen: false,
        },
      });

      if (activePropertyCount >= limits.properties) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.CREATE_PROPERTY_BLOCKED
            .replace('{limit}', limits.properties.toString())
            .replace('{plan}', agency.plan),
          current: activePropertyCount,
          limit: limits.properties,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if a user operation is allowed based on agency plan
   */
  async checkUserOperationAllowed(
    agencyId: string,
    operation: 'create' | 'update' | 'delete',
    userId?: string,
  ): Promise<OperationResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true, maxUsers: true },
    });

    if (!agency) {
      return { allowed: false, message: 'Agência não encontrada' };
    }

    const limits = this.getPlanLimits(agency.plan, 'agency');

    // For update/delete, check if the specific user is frozen
    if ((operation === 'update' || operation === 'delete') && userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { isFrozen: true, frozenReason: true },
      });

      if (user?.isFrozen) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.EDIT_FROZEN_USER,
        };
      }
    }

    // For create, check if agency has reached user limit
    if (operation === 'create') {
      const activeUserCount = await this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
        },
      });

      if (activeUserCount >= limits.users) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.CREATE_USER_BLOCKED
            .replace('{limit}', limits.users.toString())
            .replace('{plan}', agency.plan),
          current: activeUserCount,
          limit: limits.users,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if a contract can be created for a property
   */
  async checkContractOperationAllowed(propertyId: string): Promise<OperationResult> {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(propertyId) },
      select: { isFrozen: true, frozenReason: true },
    });

    if (!property) {
      return { allowed: false, message: 'Imóvel não encontrado' };
    }

    if (property.isFrozen) {
      return {
        allowed: false,
        message: PLAN_MESSAGES.CONTRACT_ON_FROZEN_PROPERTY,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if payment can be registered for a property
   */
  async checkPaymentOperationAllowed(propertyId: string): Promise<OperationResult> {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(propertyId) },
      select: { isFrozen: true },
    });

    if (!property) {
      return { allowed: false, message: 'Imóvel não encontrado' };
    }

    if (property.isFrozen) {
      return {
        allowed: false,
        message: PLAN_MESSAGES.PAYMENT_ON_FROZEN_PROPERTY,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if a user can login (frozen users cannot login)
   */
  async checkUserCanLogin(userId: string): Promise<OperationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { isFrozen: true, frozenReason: true },
    });

    if (!user) {
      return { allowed: false, message: 'Usuário não encontrado' };
    }

    if (user.isFrozen) {
      return {
        allowed: false,
        message: PLAN_MESSAGES.LOGIN_BLOCKED_FROZEN,
      };
    }

    return { allowed: true };
  }

  /**
   * Enforce plan limits when agency plan changes
   * This is the main entry point for plan enforcement
   */
  async enforcePlanLimits(agencyId: string, newPlan: string): Promise<EnforcementResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const oldPlan = agency.plan;
    const oldLimits = this.getPlanLimits(oldPlan, 'agency');
    const newLimits = this.getPlanLimits(newPlan, 'agency');

    let result: EnforcementResult = {
      propertiesFrozen: 0,
      usersFrozen: 0,
      propertiesUnfrozen: 0,
      usersUnfrozen: 0,
      message: '',
    };

    // Downgrade scenario: freeze excess entities
    if (newLimits.properties < oldLimits.properties || newLimits.users < oldLimits.users) {
      // Freeze excess properties
      const propertyResult = await this.freezeExcessProperties(agencyId, newLimits.properties);
      result.propertiesFrozen = propertyResult.frozen;

      // Freeze excess users
      const userResult = await this.freezeExcessUsers(agencyId, newLimits.users);
      result.usersFrozen = userResult.frozen;

      // Disable API access if downgrading to a plan without API
      if (!newLimits.apiAccess) {
        await this.disableApiAccess(agencyId);
      }

      result.message = `Plano alterado de ${oldPlan} para ${newPlan}. ${result.propertiesFrozen} imóvel(eis) e ${result.usersFrozen} usuário(s) foram congelados.`;
    }
    // Upgrade scenario: unfreeze entities up to new limit
    else if (newLimits.properties > oldLimits.properties || newLimits.users > oldLimits.users) {
      // Unfreeze properties up to new limit
      const propertyResult = await this.unfreezeProperties(agencyId, newLimits.properties);
      result.propertiesUnfrozen = propertyResult.unfrozen;

      // Unfreeze users up to new limit
      const userResult = await this.unfreezeUsers(agencyId, newLimits.users);
      result.usersUnfrozen = userResult.unfrozen;

      // Enable API access if upgrading to a plan with API
      if (newLimits.apiAccess) {
        await this.enableApiAccess(agencyId);
      }

      result.message = `Upgrade realizado de ${oldPlan} para ${newPlan}. ${result.propertiesUnfrozen} imóvel(eis) e ${result.usersUnfrozen} usuário(s) foram desbloqueados.`;
    }
    else {
      result.message = `Plano mantido em ${newPlan}. Nenhuma alteração necessária.`;
    }

    // Update agency plan and tracking fields
    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        plan: newPlan,
        maxProperties: newLimits.properties,
        maxUsers: newLimits.users,
        lastPlanChange: new Date(),
        frozenPropertiesCount: await this.countFrozenProperties(agencyId),
        frozenUsersCount: await this.countFrozenUsers(agencyId),
      },
    });

    // Log the enforcement action
    await this.logEnforcementAction(agencyId, 'PLAN_CHANGED', result);

    return result;
  }

  /**
   * Freeze properties exceeding the limit
   * Keeps the most recently created properties active
   */
  async freezeExcessProperties(agencyId: string, limit: number): Promise<FreezeResult> {
    // Get all active (non-frozen, non-deleted) properties for agency
    const activeProperties = await this.prisma.property.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      select: { id: true, name: true, address: true, status: true, createdAt: true },
    });

    // If within limit, nothing to freeze
    if (activeProperties.length <= limit) {
      return {
        frozen: 0,
        kept: activeProperties.map(p => p.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    // Keep the most recent 'limit' properties active
    const toKeepActive = activeProperties.slice(0, limit);
    const toFreeze = activeProperties.slice(limit);

    // Freeze excess properties
    const frozenIds: string[] = [];
    for (const property of toFreeze) {
      await this.prisma.property.update({
        where: { id: property.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.PROPERTY_FROZEN.replace('{limit}', limit.toString()),
          previousStatus: property.status,
        },
      });
      frozenIds.push(property.id.toString());
    }

    return {
      frozen: toFreeze.length,
      kept: toKeepActive.map(p => p.id.toString()),
      message: `${toFreeze.length} imóvel(eis) foram congelados devido ao limite do plano.`,
    };
  }

  /**
   * Freeze users exceeding the limit
   * Keeps the most recently created users active
   */
  async freezeExcessUsers(agencyId: string, limit: number): Promise<FreezeResult> {
    // Get all active (non-frozen) users for agency
    // Exclude certain roles that shouldn't be frozen (like AGENCY_ADMIN)
    const activeUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: {
          notIn: [UserRole.CEO, UserRole.ADMIN], // Don't freeze platform admins
        },
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // If within limit, nothing to freeze
    if (activeUsers.length <= limit) {
      return {
        frozen: 0,
        kept: activeUsers.map(u => u.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    // Keep AGENCY_ADMIN users active (don't count against limit, don't freeze)
    const agencyAdmins = activeUsers.filter(u => u.role === UserRole.AGENCY_ADMIN);
    const otherUsers = activeUsers.filter(u => u.role !== UserRole.AGENCY_ADMIN);

    // From remaining users, keep the most recent ones up to (limit - agencyAdmins.length)
    const effectiveLimit = Math.max(0, limit - agencyAdmins.length);
    const toKeepActive = otherUsers.slice(0, effectiveLimit);
    const toFreeze = otherUsers.slice(effectiveLimit);

    // Freeze excess users
    const frozenIds: string[] = [];
    for (const user of toFreeze) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.USER_FROZEN,
        },
      });
      frozenIds.push(user.id.toString());
    }

    return {
      frozen: toFreeze.length,
      kept: [...agencyAdmins, ...toKeepActive].map(u => u.id.toString()),
      message: `${toFreeze.length} usuário(s) foram desativados devido ao limite do plano.`,
    };
  }

  /**
   * Unfreeze properties up to the new limit
   * Unfreezes in order of when they were frozen (oldest frozen first)
   */
  async unfreezeProperties(agencyId: string, newLimit: number): Promise<UnfreezeResult> {
    // Get current active properties count
    const activeCount = await this.prisma.property.count({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
      },
    });

    // Calculate how many can be unfrozen
    const canUnfreeze = Math.max(0, newLimit - activeCount);

    if (canUnfreeze === 0) {
      return {
        unfrozen: 0,
        message: 'Nenhum imóvel para descongelar.',
      };
    }

    // Get frozen properties, oldest frozen first
    const frozenProperties = await this.prisma.property.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: true,
      },
      orderBy: { frozenAt: 'asc' }, // Oldest frozen first
      take: canUnfreeze,
      select: { id: true, previousStatus: true },
    });

    // Unfreeze properties
    for (const property of frozenProperties) {
      await this.prisma.property.update({
        where: { id: property.id },
        data: {
          isFrozen: false,
          frozenAt: null,
          frozenReason: null,
          status: property.previousStatus || 'DISPONIVEL',
          previousStatus: null,
        },
      });
    }

    return {
      unfrozen: frozenProperties.length,
      message: `${frozenProperties.length} imóvel(eis) foram desbloqueados.`,
    };
  }

  /**
   * Unfreeze users up to the new limit
   */
  async unfreezeUsers(agencyId: string, newLimit: number): Promise<UnfreezeResult> {
    // Get current active users count
    const activeCount = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
      },
    });

    // Calculate how many can be unfrozen
    const canUnfreeze = Math.max(0, newLimit - activeCount);

    if (canUnfreeze === 0) {
      return {
        unfrozen: 0,
        message: 'Nenhum usuário para descongelar.',
      };
    }

    // Get frozen users, oldest frozen first
    const frozenUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: true,
      },
      orderBy: { frozenAt: 'asc' },
      take: canUnfreeze,
      select: { id: true },
    });

    // Unfreeze users
    for (const user of frozenUsers) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isFrozen: false,
          frozenAt: null,
          frozenReason: null,
        },
      });
    }

    return {
      unfrozen: frozenUsers.length,
      message: `${frozenUsers.length} usuário(s) foram reativados.`,
    };
  }

  /**
   * Switch which property is active (for FREE plan with 1 property limit)
   * Freezes the current active property and unfreezes the selected one
   */
  async switchActiveProperty(agencyId: string, newActivePropertyId: string): Promise<SwitchResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const limits = this.getPlanLimits(agency.plan, 'agency');

    // This operation is mainly for FREE plan or when limit is 1
    if (limits.properties > 1) {
      throw new BadRequestException('Esta operação só é disponível para planos com limite de 1 imóvel.');
    }

    // Get the property to activate
    const newActiveProperty = await this.prisma.property.findFirst({
      where: {
        id: BigInt(newActivePropertyId),
        agencyId: BigInt(agencyId),
        deleted: false,
      },
      select: { id: true, name: true, address: true, isFrozen: true, previousStatus: true },
    });

    if (!newActiveProperty) {
      throw new NotFoundException('Imóvel não encontrado ou não pertence a esta agência.');
    }

    // Get the currently active property
    const currentActiveProperty = await this.prisma.property.findFirst({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
      },
      select: { id: true, name: true, address: true, status: true },
    });

    // If the new property is already active, no change needed
    if (!newActiveProperty.isFrozen) {
      return {
        success: false,
        message: 'Este imóvel já está ativo.',
      };
    }

    // Freeze the current active property (if exists)
    if (currentActiveProperty) {
      await this.prisma.property.update({
        where: { id: currentActiveProperty.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.PROPERTY_FROZEN.replace('{limit}', '1'),
          previousStatus: currentActiveProperty.status,
        },
      });
    }

    // Unfreeze the new active property
    await this.prisma.property.update({
      where: { id: newActiveProperty.id },
      data: {
        isFrozen: false,
        frozenAt: null,
        frozenReason: null,
        status: newActiveProperty.previousStatus || 'DISPONIVEL',
        previousStatus: null,
      },
    });

    // Update frozen count
    await this.updateFrozenCounts(agencyId);

    return {
      success: true,
      message: PLAN_MESSAGES.SWITCH_ACTIVE_SUCCESS,
      frozenProperty: currentActiveProperty ? {
        id: currentActiveProperty.id.toString(),
        name: currentActiveProperty.name || currentActiveProperty.address,
      } : undefined,
      activatedProperty: {
        id: newActiveProperty.id.toString(),
        name: newActiveProperty.name || newActiveProperty.address,
      },
    };
  }

  /**
   * Get summary of frozen entities for an agency
   */
  async getFrozenEntitiesSummary(agencyId: string): Promise<FrozenSummary> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const limits = this.getPlanLimits(agency.plan, 'agency');

    // Count properties
    const [activeProperties, frozenProperties, totalProperties] = await Promise.all([
      this.prisma.property.count({
        where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: false },
      }),
      this.prisma.property.count({
        where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: true },
      }),
      this.prisma.property.count({
        where: { agencyId: BigInt(agencyId), deleted: false },
      }),
    ]);

    // Count users
    const [activeUsers, frozenUsers, totalUsers] = await Promise.all([
      this.prisma.user.count({
        where: { agencyId: BigInt(agencyId), isFrozen: false, status: 'ACTIVE' },
      }),
      this.prisma.user.count({
        where: { agencyId: BigInt(agencyId), isFrozen: true },
      }),
      this.prisma.user.count({
        where: { agencyId: BigInt(agencyId) },
      }),
    ]);

    const isOverLimit = activeProperties > limits.properties || activeUsers > limits.users;

    return {
      properties: {
        active: activeProperties,
        frozen: frozenProperties,
        total: totalProperties,
        limit: limits.properties,
      },
      users: {
        active: activeUsers,
        frozen: frozenUsers,
        total: totalUsers,
        limit: limits.users,
      },
      isOverLimit,
      upgradeRequired: frozenProperties > 0 || frozenUsers > 0,
      plan: agency.plan,
    };
  }

  /**
   * Get list of frozen entities for an agency
   */
  async getFrozenEntitiesList(agencyId: string): Promise<FrozenEntitiesList> {
    // Get frozen properties
    const frozenProperties = await this.prisma.property.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: true,
      },
      select: {
        id: true,
        name: true,
        address: true,
        frozenAt: true,
        frozenReason: true,
      },
      orderBy: { frozenAt: 'desc' },
    });

    // Get frozen users
    const frozenUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        frozenAt: true,
        frozenReason: true,
      },
      orderBy: { frozenAt: 'desc' },
    });

    return {
      properties: frozenProperties.map(p => ({
        id: p.id.toString(),
        name: p.name || p.address,
        frozenAt: p.frozenAt?.toISOString() || '',
        frozenReason: p.frozenReason || '',
      })),
      users: frozenUsers.map(u => ({
        id: u.id.toString(),
        name: u.name || '',
        email: u.email,
        frozenAt: u.frozenAt?.toISOString() || '',
        frozenReason: u.frozenReason || '',
      })),
    };
  }

  /**
   * Check if a specific property is frozen
   */
  async isPropertyFrozen(propertyId: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(propertyId) },
      select: { isFrozen: true },
    });
    return property?.isFrozen ?? false;
  }

  /**
   * Check if a specific user is frozen
   */
  async isUserFrozen(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { isFrozen: true },
    });
    return user?.isFrozen ?? false;
  }

  /**
   * Preview what would happen if agency changes to a different plan
   */
  async previewPlanChange(agencyId: string, newPlan: string): Promise<{
    propertiesWouldFreeze: number;
    usersWouldFreeze: number;
    propertiesWouldUnfreeze: number;
    usersWouldUnfreeze: number;
    warning?: string;
  }> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const currentLimits = this.getPlanLimits(agency.plan, 'agency');
    const newLimits = this.getPlanLimits(newPlan, 'agency');

    // Count current active entities
    const activeProperties = await this.prisma.property.count({
      where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: false },
    });

    const activeUsers = await this.prisma.user.count({
      where: { agencyId: BigInt(agencyId), isFrozen: false, status: 'ACTIVE' },
    });

    // Count currently frozen entities
    const frozenProperties = await this.prisma.property.count({
      where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: true },
    });

    const frozenUsers = await this.prisma.user.count({
      where: { agencyId: BigInt(agencyId), isFrozen: true },
    });

    // Calculate what would happen
    const propertiesWouldFreeze = Math.max(0, activeProperties - newLimits.properties);
    const usersWouldFreeze = Math.max(0, activeUsers - newLimits.users);

    const canUnfreezeProperties = Math.max(0, newLimits.properties - activeProperties);
    const propertiesWouldUnfreeze = Math.min(canUnfreezeProperties, frozenProperties);

    const canUnfreezeUsers = Math.max(0, newLimits.users - activeUsers);
    const usersWouldUnfreeze = Math.min(canUnfreezeUsers, frozenUsers);

    let warning: string | undefined;
    if (propertiesWouldFreeze > 0 || usersWouldFreeze > 0) {
      warning = PLAN_MESSAGES.DOWNGRADE_WARNING
        .replace('{plan}', newPlan)
        .replace('{freezeCount}', propertiesWouldFreeze.toString())
        .replace('{userFreezeCount}', usersWouldFreeze.toString());
    }

    return {
      propertiesWouldFreeze,
      usersWouldFreeze,
      propertiesWouldUnfreeze,
      usersWouldUnfreeze,
      warning,
    };
  }

  // Private helper methods

  private async countFrozenProperties(agencyId: string): Promise<number> {
    return this.prisma.property.count({
      where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: true },
    });
  }

  private async countFrozenUsers(agencyId: string): Promise<number> {
    return this.prisma.user.count({
      where: { agencyId: BigInt(agencyId), isFrozen: true },
    });
  }

  private async updateFrozenCounts(agencyId: string): Promise<void> {
    const [frozenProperties, frozenUsers] = await Promise.all([
      this.countFrozenProperties(agencyId),
      this.countFrozenUsers(agencyId),
    ]);

    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        frozenPropertiesCount: frozenProperties,
        frozenUsersCount: frozenUsers,
      },
    });
  }

  private async disableApiAccess(agencyId: string): Promise<void> {
    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        apiEnabled: false,
        apiKey: null,
      },
    });
  }

  private async enableApiAccess(agencyId: string): Promise<void> {
    // Generate new API key if upgrading to a plan with API access
    const apiKey = this.generateApiKey();
    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        apiEnabled: true,
        apiKey,
      },
    });
  }

  private generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'mr3x_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async logEnforcementAction(
    agencyId: string,
    action: string,
    details: any,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        event: action,
        entity: 'Agency',
        entityId: BigInt(agencyId),
        dataAfter: JSON.stringify(details),
      },
    });
  }
}
