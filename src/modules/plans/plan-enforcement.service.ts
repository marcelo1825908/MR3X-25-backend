import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PLANS_CONFIG, getPlanLimits, getPlanByName, EntityType, PlanLimits, getFreeUsageLimits } from './plans.data';
import { UserRole } from '@prisma/client';

// Platform-level roles that are NEVER subject to plan limits
// These users manage the platform itself and should never be frozen or blocked
export const PLATFORM_ROLES: UserRole[] = [
  UserRole.CEO,
  UserRole.ADMIN,
  UserRole.PLATFORM_MANAGER,
];

// Roles excluded from agency user counts (not counted against plan limits)
export const EXCLUDED_FROM_USER_COUNT: UserRole[] = [
  UserRole.CEO,
  UserRole.ADMIN,
  UserRole.PLATFORM_MANAGER,
  UserRole.AGENCY_ADMIN, // Agency admin is always allowed
];

export const PLAN_MESSAGES = {
  CONTRACT_FROZEN: 'Este contrato está congelado. Seu plano atual permite apenas {limit} contrato(s) ativo(s). Faça upgrade para desbloquear.',
  USER_FROZEN: 'Este usuário está congelados devido ao limite do plano. Faça upgrade para reativar.',
  CREATE_CONTRACT_BLOCKED: 'Você atingiu o limite de {limit} contrato(s) ativo(s) do seu plano {plan}. Você pode adicionar contratos extras por R$ {price}/cada ou fazer upgrade.',
  CREATE_USER_BLOCKED: 'Você atingiu o limite de {limit} usuário(s) do seu plano {plan}. Faça upgrade para adicionar mais usuários.',
  CREATE_PROPERTY_BLOCKED: 'Você atingiu o limite de {limit} imóvel(is) do seu plano {plan}. Faça upgrade para adicionar mais imóveis.',
  CREATE_TENANT_BLOCKED: 'Você atingiu o limite de {limit} inquilino(s) do seu plano {plan}. Faça upgrade para adicionar mais inquilinos.',
  OPERATION_ON_FROZEN_CONTRACT: 'Não é possível realizar esta operação em contratos congelados. Faça upgrade ou ative este contrato primeiro.',
  PAYMENT_ON_FROZEN_CONTRACT: 'Não é possível registrar pagamentos para contratos congelados.',
  INSPECTION_REQUIRES_PAYMENT: 'Vistorias requerem pagamento no plano {plan}. Valor: R$ {price}',
  SETTLEMENT_REQUIRES_PAYMENT: 'Acordos requerem pagamento no plano {plan}. Valor: R$ {price}',
  EDIT_FROZEN_CONTRACT: 'Este contrato está congelado e não pode ser editado. Faça upgrade do seu plano.',
  EDIT_FROZEN_USER: 'Este usuário está congelado e não pode ser editado. Faça upgrade do seu plano.',
  EDIT_FROZEN_PROPERTY: 'Este imóvel está congelado e não pode ser editado. Faça upgrade do seu plano.',
  UPGRADE_SUCCESS: 'Upgrade realizado com sucesso! Todos os seus contratos e usuários foram desbloqueados.',
  DOWNGRADE_WARNING: 'Ao fazer downgrade para o plano {plan}, {freezeCount} contrato(s) e {userFreezeCount} usuário(s) serão congelados.',
  SWITCH_ACTIVE_SUCCESS: 'Contrato ativo alterado com sucesso.',
  LOGIN_BLOCKED_FROZEN: 'Sua conta está temporariamente desativada devido ao limite do plano. Entre em contato com o administrador da agência.',
  API_DISABLED: 'Acesso à API não está disponível no plano FREE. Faça upgrade para habilitar.',
  API_ADDON_AVAILABLE: 'Acesso à API disponível como add-on por R$ 29,00/mês no plano PROFESSIONAL.',
};

export interface OperationResult {
  allowed: boolean;
  message?: string;
  current?: number;
  limit?: number;
  requiresPayment?: boolean;
  price?: number;
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
  contractsFrozen: number;
  usersFrozen: number;
  propertiesFrozen: number;
  tenantsFrozen: number;
  contractsUnfrozen: number;
  usersUnfrozen: number;
  propertiesUnfrozen: number;
  tenantsUnfrozen: number;
  message: string;
}

export interface SwitchResult {
  success: boolean;
  message: string;
  frozenContract?: { id: string; property: string };
  activatedContract?: { id: string; property: string };
}

export interface FrozenSummary {
  contracts: {
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
  planDisplayName: string;
  freeUsage?: {
    inspections: { current: number; limit: number };
    analyses: { current: number; limit: number };
    agreements: { current: number; limit: number };
    apiCalls: { current: number; limit: number };
  };
}

export interface FrozenEntity {
  id: string;
  name: string;
  frozenAt: string;
  frozenReason: string;
}

export interface FrozenEntitiesList {
  contracts: Array<FrozenEntity & { propertyAddress: string; tenantName: string }>;
  users: Array<FrozenEntity & { email: string }>;
}

@Injectable()
export class PlanEnforcementService {
  constructor(private prisma: PrismaService) {}

  getPlanLimitsForAgency(planName: string): PlanLimits {
    return getPlanLimits(planName, 'agency');
  }

  async checkContractOperationAllowed(
    agencyId: string,
    operation: 'create' | 'update' | 'delete',
    contractId?: string,
  ): Promise<OperationResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true, maxContracts: true },
    });

    if (!agency) {
      return { allowed: false, message: 'Agência não encontrada' };
    }

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;
    const limits = this.getPlanLimitsForAgency(agency.plan);

    if ((operation === 'update' || operation === 'delete') && contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: BigInt(contractId) },
        select: { isFrozen: true, frozenReason: true },
      });

      if (contract?.isFrozen) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.EDIT_FROZEN_CONTRACT,
        };
      }
    }

    if (operation === 'create') {
      const activeContractCount = await this.prisma.contract.count({
        where: {
          agencyId: BigInt(agencyId),
          deleted: false,
          isFrozen: false,
          status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
        },
      });

      if (activeContractCount >= limits.contracts) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.CREATE_CONTRACT_BLOCKED
            .replace('{limit}', limits.contracts.toString())
            .replace('{plan}', planConfig.displayName)
            .replace('{price}', planConfig.extraContractPrice.toFixed(2)),
          current: activeContractCount,
          limit: limits.contracts,
          requiresPayment: true,
          price: planConfig.extraContractPrice,
        };
      }
    }

    return { allowed: true };
  }

  async checkUserOperationAllowed(
    agencyId: string,
    operation: 'create' | 'update' | 'delete',
    userId?: string,
    targetRole?: UserRole,
  ): Promise<OperationResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true, maxUsers: true },
    });

    if (!agency) {
      return { allowed: false, message: 'Agência não encontrada' };
    }

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;
    const limits = this.getPlanLimitsForAgency(agency.plan);

    if ((operation === 'update' || operation === 'delete') && userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { isFrozen: true, frozenReason: true, role: true },
      });

      // Platform users are never subject to plan limits
      if (user?.role && PLATFORM_ROLES.includes(user.role)) {
        return { allowed: true };
      }

      if (user?.isFrozen) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.EDIT_FROZEN_USER,
        };
      }
    }

    if (operation === 'create') {
      // Check per-role limits if targetRole is provided
      if (targetRole) {
        const roleLimit = this.getRoleLimitFromPlan(planConfig, targetRole);
        const roleName = this.getRoleDisplayName(targetRole);

        if (roleLimit === -1 || roleLimit >= 9999) {
          return { allowed: true };
        }

        const roleCount = await this.prisma.user.count({
          where: {
            agencyId: BigInt(agencyId),
            isFrozen: false,
            status: 'ACTIVE',
            role: targetRole,
          },
        });

        if (roleCount >= roleLimit) {
          return {
            allowed: false,
            message: `Você atingiu o limite de ${roleLimit} ${roleName} do seu plano ${planConfig.displayName}. Faça upgrade para adicionar mais.`,
            current: roleCount,
            limit: roleLimit,
          };
        }

        return { allowed: true };
      }

      // Fallback to total user count if no specific role
      const activeUserCount = await this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
          role: {
            notIn: EXCLUDED_FROM_USER_COUNT,
          },
        },
      });

      if (planConfig.unlimitedUsers || limits.users >= 9999) {
        return { allowed: true };
      }

      if (activeUserCount >= limits.users) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.CREATE_USER_BLOCKED
            .replace('{limit}', limits.users.toString())
            .replace('{plan}', planConfig.displayName),
          current: activeUserCount,
          limit: limits.users,
        };
      }
    }

    return { allowed: true };
  }

  private getRoleLimitFromPlan(planConfig: any, role: UserRole): number {
    switch (role) {
      case UserRole.BROKER:
        return planConfig.maxBrokers ?? -1;
      case UserRole.AGENCY_MANAGER:
        return planConfig.maxManagers ?? -1;
      case UserRole.INQUILINO:
        return planConfig.maxTenants ?? -1;
      case UserRole.PROPRIETARIO:
        return planConfig.maxOwners ?? -1;
      default:
        return -1; // No limit for other roles
    }
  }

  private getRoleDisplayName(role: UserRole): string {
    switch (role) {
      case UserRole.BROKER:
        return 'corretor(es)';
      case UserRole.AGENCY_MANAGER:
        return 'gerente(s)';
      case UserRole.INQUILINO:
        return 'inquilino(s)';
      case UserRole.PROPRIETARIO:
        return 'proprietário(s)';
      default:
        return 'usuário(s)';
    }
  }

  async checkPropertyOperationAllowed(
    userId: string,
    operation: 'create' | 'update' | 'delete',
    propertyId?: string,
  ): Promise<OperationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, plan: true, role: true, agencyId: true },
    });

    if (!user) {
      return { allowed: false, message: 'Usuário não encontrado' };
    }

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

    if (operation === 'create') {
      if (user.agencyId) {
        const agency = await this.prisma.agency.findUnique({
          where: { id: user.agencyId },
          select: { id: true, plan: true },
        });

        if (agency) {
          const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;

          const propertyCount = await this.prisma.property.count({
            where: {
              agencyId: user.agencyId,
              deleted: false,
              isFrozen: false,
            },
          });

          if (propertyCount >= planConfig.maxProperties) {
            return {
              allowed: false,
              message: PLAN_MESSAGES.CREATE_PROPERTY_BLOCKED
                .replace('{limit}', planConfig.maxProperties.toString())
                .replace('{plan}', planConfig.displayName),
              current: propertyCount,
              limit: planConfig.maxProperties,
            };
          }
        }
      } else {
        const planConfig = getPlanByName(user.plan || 'FREE') || PLANS_CONFIG.FREE;

        const propertyCount = await this.prisma.property.count({
          where: {
            ownerId: user.id,
            deleted: false,
            isFrozen: false,
          },
        });

        if (propertyCount >= planConfig.maxProperties) {
          return {
            allowed: false,
            message: PLAN_MESSAGES.CREATE_PROPERTY_BLOCKED
              .replace('{limit}', planConfig.maxProperties.toString())
              .replace('{plan}', planConfig.displayName),
            current: propertyCount,
            limit: planConfig.maxProperties,
          };
        }
      }
    }

    return { allowed: true };
  }

  async checkTenantOperationAllowed(
    userId: string,
    operation: 'create' | 'update' | 'delete',
    tenantId?: string,
  ): Promise<OperationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, plan: true, role: true, agencyId: true },
    });

    if (!user) {
      return { allowed: false, message: 'Usuário não encontrado' };
    }

    if ((operation === 'update' || operation === 'delete') && tenantId) {
      const tenant = await this.prisma.user.findUnique({
        where: { id: BigInt(tenantId) },
        select: { isFrozen: true, frozenReason: true },
      });

      if (tenant?.isFrozen) {
        return {
          allowed: false,
          message: PLAN_MESSAGES.EDIT_FROZEN_USER,
        };
      }
    }

    if (operation === 'create') {
      if (user.agencyId) {
        const agency = await this.prisma.agency.findUnique({
          where: { id: user.agencyId },
          select: { id: true, plan: true },
        });

        if (agency) {
          const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;

          const tenantCount = await this.prisma.user.count({
            where: {
              agencyId: user.agencyId,
              role: UserRole.INQUILINO,
              status: 'ACTIVE',
              isFrozen: false,
            },
          });

          if (planConfig.maxTenants < 9999 && tenantCount >= planConfig.maxTenants) {
            return {
              allowed: false,
              message: PLAN_MESSAGES.CREATE_TENANT_BLOCKED
                .replace('{limit}', planConfig.maxTenants.toString())
                .replace('{plan}', planConfig.displayName),
              current: tenantCount,
              limit: planConfig.maxTenants,
            };
          }
        }
      } else {
        const planConfig = getPlanByName(user.plan || 'FREE') || PLANS_CONFIG.FREE;

        const tenantCount = await this.prisma.user.count({
          where: {
            createdBy: user.id,
            role: UserRole.INQUILINO,
            status: 'ACTIVE',
            isFrozen: false,
          },
        });

        if (planConfig.maxTenants < 9999 && tenantCount >= planConfig.maxTenants) {
          return {
            allowed: false,
            message: PLAN_MESSAGES.CREATE_TENANT_BLOCKED
              .replace('{limit}', planConfig.maxTenants.toString())
              .replace('{plan}', planConfig.displayName),
            current: tenantCount,
            limit: planConfig.maxTenants,
          };
        }
      }
    }

    return { allowed: true };
  }

  async checkInspectionAllowed(agencyId: string): Promise<OperationResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planConfig = getPlanByName(agency?.plan || 'FREE') || PLANS_CONFIG.FREE;

    if (planConfig.unlimitedInspections) {
      return { allowed: true, requiresPayment: false };
    }

    return {
      allowed: true,
      requiresPayment: true,
      price: planConfig.inspectionPrice || 3.90,
      message: PLAN_MESSAGES.INSPECTION_REQUIRES_PAYMENT
        .replace('{plan}', planConfig.displayName)
        .replace('{price}', (planConfig.inspectionPrice || 3.90).toFixed(2)),
    };
  }

  async checkSettlementAllowed(agencyId: string): Promise<OperationResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    const planConfig = getPlanByName(agency?.plan || 'FREE') || PLANS_CONFIG.FREE;

    if (planConfig.unlimitedSettlements) {
      return { allowed: true, requiresPayment: false };
    }

    return {
      allowed: true,
      requiresPayment: true,
      price: planConfig.settlementPrice || 6.90,
      message: PLAN_MESSAGES.SETTLEMENT_REQUIRES_PAYMENT
        .replace('{plan}', planConfig.displayName)
        .replace('{price}', (planConfig.settlementPrice || 6.90).toFixed(2)),
    };
  }

  async checkPaymentOperationAllowed(contractId: string): Promise<OperationResult> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      select: { isFrozen: true },
    });

    if (!contract) {
      return { allowed: false, message: 'Contrato não encontrado' };
    }

    if (contract.isFrozen) {
      return {
        allowed: false,
        message: PLAN_MESSAGES.PAYMENT_ON_FROZEN_CONTRACT,
      };
    }

    return { allowed: true };
  }

  async checkUserCanLogin(userId: string): Promise<OperationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { isFrozen: true, frozenReason: true, role: true },
    });

    if (!user) {
      return { allowed: false, message: 'Usuário não encontrado' };
    }

    // Platform users can ALWAYS login - they are never subject to plan limits
    if (user.role && PLATFORM_ROLES.includes(user.role)) {
      return { allowed: true };
    }

    if (user.isFrozen) {
      return {
        allowed: false,
        message: PLAN_MESSAGES.LOGIN_BLOCKED_FROZEN,
      };
    }

    return { allowed: true };
  }

  async checkApiAccessAllowed(agencyId: string): Promise<OperationResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true, apiEnabled: true, apiAddOnEnabled: true },
    });

    if (!agency) {
      return { allowed: false, message: 'Agência não encontrada' };
    }

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;

    if (planConfig.apiAccessIncluded && agency.apiEnabled) {
      return { allowed: true };
    }

    if (planConfig.apiAccessOptional && agency.apiAddOnEnabled && agency.apiEnabled) {
      return { allowed: true };
    }

    if (!planConfig.apiAccessIncluded && !planConfig.apiAccessOptional) {
      return {
        allowed: false,
        message: PLAN_MESSAGES.API_DISABLED,
      };
    }

    if (planConfig.apiAccessOptional && !agency.apiAddOnEnabled) {
      return {
        allowed: false,
        message: PLAN_MESSAGES.API_ADDON_AVAILABLE,
        requiresPayment: true,
        price: planConfig.apiAddOnPrice || 29.00,
      };
    }

    return { allowed: false, message: PLAN_MESSAGES.API_DISABLED };
  }

  async enforceCurrentPlanLimits(agencyId: string): Promise<EnforcementResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const currentPlan = agency.plan || 'FREE';
    const planConfig = getPlanByName(currentPlan) || PLANS_CONFIG.FREE;

    let result: EnforcementResult = {
      contractsFrozen: 0,
      usersFrozen: 0,
      propertiesFrozen: 0,
      tenantsFrozen: 0,
      contractsUnfrozen: 0,
      usersUnfrozen: 0,
      propertiesUnfrozen: 0,
      tenantsUnfrozen: 0,
      message: '',
    };

    const contractResult = await this.freezeExcessContracts(agencyId, planConfig.maxActiveContracts);
    result.contractsFrozen = contractResult.frozen;

    // Freeze excess users by role (per-role limits)
    let totalUsersFrozen = 0;

    // Freeze excess brokers
    if (planConfig.maxBrokers !== undefined && planConfig.maxBrokers !== -1 && planConfig.maxBrokers < 9999) {
      const brokerResult = await this.freezeExcessUsersByRole(agencyId, UserRole.BROKER, planConfig.maxBrokers);
      totalUsersFrozen += brokerResult.frozen;
    }

    // Freeze excess managers
    if (planConfig.maxManagers !== undefined && planConfig.maxManagers !== -1 && planConfig.maxManagers < 9999) {
      const managerResult = await this.freezeExcessUsersByRole(agencyId, UserRole.AGENCY_MANAGER, planConfig.maxManagers);
      totalUsersFrozen += managerResult.frozen;
    }

    // Freeze excess owners (proprietarios)
    if (planConfig.maxOwners !== undefined && planConfig.maxOwners !== -1 && planConfig.maxOwners < 9999) {
      const ownerResult = await this.freezeExcessUsersByRole(agencyId, UserRole.PROPRIETARIO, planConfig.maxOwners);
      totalUsersFrozen += ownerResult.frozen;
    }

    result.usersFrozen = totalUsersFrozen;

    const propertyResult = await this.freezeExcessProperties(agencyId, planConfig.maxProperties);
    result.propertiesFrozen = propertyResult.frozen;

    const tenantResult = await this.freezeExcessTenants(agencyId, planConfig.maxTenants);
    result.tenantsFrozen = tenantResult.frozen;

    const frozen: string[] = [];
    if (result.contractsFrozen > 0) frozen.push(`${result.contractsFrozen} contrato(s)`);
    if (result.usersFrozen > 0) frozen.push(`${result.usersFrozen} usuário(s)`);
    if (result.propertiesFrozen > 0) frozen.push(`${result.propertiesFrozen} imóvel(is)`);
    if (result.tenantsFrozen > 0) frozen.push(`${result.tenantsFrozen} inquilino(s)`);

    result.message = frozen.length > 0
      ? `Limites do plano ${planConfig.displayName} aplicados. ${frozen.join(', ')} foram congelados.`
      : `Todos os recursos estão dentro dos limites do plano ${planConfig.displayName}. Nenhuma alteração necessária.`;

    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        frozenContractsCount: await this.countFrozenContracts(agencyId),
        frozenUsersCount: await this.countFrozenUsers(agencyId),
      },
    });

    await this.logEnforcementAction(agencyId, 'PLAN_LIMITS_ENFORCED', result);

    return result;
  }

  async enforcePlanLimits(agencyId: string, newPlan: string): Promise<EnforcementResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const oldPlan = agency.plan;
    const oldConfig = getPlanByName(oldPlan) || PLANS_CONFIG.FREE;
    const newConfig = getPlanByName(newPlan) || PLANS_CONFIG.FREE;

    let result: EnforcementResult = {
      contractsFrozen: 0,
      usersFrozen: 0,
      propertiesFrozen: 0,
      tenantsFrozen: 0,
      contractsUnfrozen: 0,
      usersUnfrozen: 0,
      propertiesUnfrozen: 0,
      tenantsUnfrozen: 0,
      message: '',
    };

    const isDowngrade =
      newConfig.maxActiveContracts < oldConfig.maxActiveContracts ||
      newConfig.maxProperties < oldConfig.maxProperties ||
      newConfig.maxTenants < oldConfig.maxTenants ||
      (newConfig.maxInternalUsers !== -1 && newConfig.maxInternalUsers < (oldConfig.maxInternalUsers === -1 ? 9999 : oldConfig.maxInternalUsers));

    const isUpgrade =
      newConfig.maxActiveContracts > oldConfig.maxActiveContracts ||
      newConfig.maxProperties > oldConfig.maxProperties ||
      newConfig.maxTenants > oldConfig.maxTenants ||
      (newConfig.maxInternalUsers === -1 || newConfig.maxInternalUsers > (oldConfig.maxInternalUsers === -1 ? 9999 : oldConfig.maxInternalUsers));

    if (isDowngrade) {
      const contractResult = await this.freezeExcessContracts(agencyId, newConfig.maxActiveContracts);
      result.contractsFrozen = contractResult.frozen;

      // Freeze excess users by role (per-role limits)
      let totalUsersFrozen = 0;
      if (newConfig.maxBrokers !== undefined && newConfig.maxBrokers !== -1 && newConfig.maxBrokers < 9999) {
        const brokerResult = await this.freezeExcessUsersByRole(agencyId, UserRole.BROKER, newConfig.maxBrokers);
        totalUsersFrozen += brokerResult.frozen;
      }
      if (newConfig.maxManagers !== undefined && newConfig.maxManagers !== -1 && newConfig.maxManagers < 9999) {
        const managerResult = await this.freezeExcessUsersByRole(agencyId, UserRole.AGENCY_MANAGER, newConfig.maxManagers);
        totalUsersFrozen += managerResult.frozen;
      }
      if (newConfig.maxOwners !== undefined && newConfig.maxOwners !== -1 && newConfig.maxOwners < 9999) {
        const ownerResult = await this.freezeExcessUsersByRole(agencyId, UserRole.PROPRIETARIO, newConfig.maxOwners);
        totalUsersFrozen += ownerResult.frozen;
      }
      result.usersFrozen = totalUsersFrozen;

      const propertyResult = await this.freezeExcessProperties(agencyId, newConfig.maxProperties);
      result.propertiesFrozen = propertyResult.frozen;

      const tenantResult = await this.freezeExcessTenants(agencyId, newConfig.maxTenants);
      result.tenantsFrozen = tenantResult.frozen;

      if (!newConfig.apiAccessIncluded && !newConfig.apiAccessOptional) {
        await this.disableApiAccess(agencyId);
      }

      const frozen: string[] = [];
      if (result.contractsFrozen > 0) frozen.push(`${result.contractsFrozen} contrato(s)`);
      if (result.usersFrozen > 0) frozen.push(`${result.usersFrozen} usuário(s)`);
      if (result.propertiesFrozen > 0) frozen.push(`${result.propertiesFrozen} imóvel(is)`);
      if (result.tenantsFrozen > 0) frozen.push(`${result.tenantsFrozen} inquilino(s)`);

      result.message = `Plano alterado de ${oldConfig.displayName} para ${newConfig.displayName}. ${frozen.length > 0 ? frozen.join(', ') + ' foram congelados.' : 'Nenhuma entidade foi congelada.'}`;
    }
    else if (isUpgrade) {
      const contractResult = await this.unfreezeContracts(agencyId, newConfig.maxActiveContracts);
      result.contractsUnfrozen = contractResult.unfrozen;

      // Unfreeze users by role (per-role limits)
      let totalUsersUnfrozen = 0;
      if (newConfig.maxBrokers !== undefined && (newConfig.maxBrokers === -1 || newConfig.maxBrokers >= 9999)) {
        const brokerResult = await this.unfreezeUsersByRole(agencyId, UserRole.BROKER);
        totalUsersUnfrozen += brokerResult.unfrozen;
      } else if (newConfig.maxBrokers !== undefined) {
        const brokerResult = await this.unfreezeUsersByRoleWithLimit(agencyId, UserRole.BROKER, newConfig.maxBrokers);
        totalUsersUnfrozen += brokerResult.unfrozen;
      }
      if (newConfig.maxManagers !== undefined && (newConfig.maxManagers === -1 || newConfig.maxManagers >= 9999)) {
        const managerResult = await this.unfreezeUsersByRole(agencyId, UserRole.AGENCY_MANAGER);
        totalUsersUnfrozen += managerResult.unfrozen;
      } else if (newConfig.maxManagers !== undefined) {
        const managerResult = await this.unfreezeUsersByRoleWithLimit(agencyId, UserRole.AGENCY_MANAGER, newConfig.maxManagers);
        totalUsersUnfrozen += managerResult.unfrozen;
      }
      if (newConfig.maxOwners !== undefined && (newConfig.maxOwners === -1 || newConfig.maxOwners >= 9999)) {
        const ownerResult = await this.unfreezeUsersByRole(agencyId, UserRole.PROPRIETARIO);
        totalUsersUnfrozen += ownerResult.unfrozen;
      } else if (newConfig.maxOwners !== undefined) {
        const ownerResult = await this.unfreezeUsersByRoleWithLimit(agencyId, UserRole.PROPRIETARIO, newConfig.maxOwners);
        totalUsersUnfrozen += ownerResult.unfrozen;
      }
      result.usersUnfrozen = totalUsersUnfrozen;

      const propertyResult = await this.unfreezeProperties(agencyId, newConfig.maxProperties);
      result.propertiesUnfrozen = propertyResult.unfrozen;

      const tenantResult = await this.unfreezeTenants(agencyId, newConfig.maxTenants);
      result.tenantsUnfrozen = tenantResult.unfrozen;

      if (newConfig.apiAccessIncluded) {
        await this.enableApiAccess(agencyId);
      }

      const unfrozen: string[] = [];
      if (result.contractsUnfrozen > 0) unfrozen.push(`${result.contractsUnfrozen} contrato(s)`);
      if (result.usersUnfrozen > 0) unfrozen.push(`${result.usersUnfrozen} usuário(s)`);
      if (result.propertiesUnfrozen > 0) unfrozen.push(`${result.propertiesUnfrozen} imóvel(is)`);
      if (result.tenantsUnfrozen > 0) unfrozen.push(`${result.tenantsUnfrozen} inquilino(s)`);

      result.message = `Upgrade realizado de ${oldConfig.displayName} para ${newConfig.displayName}. ${unfrozen.length > 0 ? unfrozen.join(', ') + ' foram desbloqueados.' : 'Nenhuma entidade foi desbloqueada.'}`;
    }
    else {
      result.message = `Plano mantido em ${newConfig.displayName}. Nenhuma alteração necessária.`;
    }

    const limits = this.getPlanLimitsForAgency(newPlan);
    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        plan: newPlan,
        maxContracts: newConfig.maxActiveContracts,
        maxUsers: newConfig.maxInternalUsers === -1 ? 9999 : newConfig.maxInternalUsers,
        lastPlanChange: new Date(),
        frozenContractsCount: await this.countFrozenContracts(agencyId),
        frozenUsersCount: await this.countFrozenUsers(agencyId),
        supportTier: newConfig.supportTier,
      },
    });

    await this.logEnforcementAction(agencyId, 'PLAN_CHANGED', result);

    return result;
  }

  async enforcePlanLimitsForOwner(ownerId: string, newPlan: string): Promise<EnforcementResult> {
    const owner = await this.prisma.user.findUnique({
      where: { id: BigInt(ownerId) },
      select: { id: true, plan: true, role: true },
    });

    if (!owner) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const oldPlan = owner.plan || 'FREE';
    const oldConfig = getPlanByName(oldPlan) || PLANS_CONFIG.FREE;
    const newConfig = getPlanByName(newPlan) || PLANS_CONFIG.FREE;

    let result: EnforcementResult = {
      contractsFrozen: 0,
      usersFrozen: 0,
      propertiesFrozen: 0,
      tenantsFrozen: 0,
      contractsUnfrozen: 0,
      usersUnfrozen: 0,
      propertiesUnfrozen: 0,
      tenantsUnfrozen: 0,
      message: '',
    };

    const isDowngrade =
      newConfig.maxProperties < oldConfig.maxProperties ||
      newConfig.maxTenants < oldConfig.maxTenants;

    const isUpgrade =
      newConfig.maxProperties > oldConfig.maxProperties ||
      newConfig.maxTenants > oldConfig.maxTenants;

    if (isDowngrade) {
      const propertyResult = await this.freezeExcessPropertiesForOwner(ownerId, newConfig.maxProperties);
      result.propertiesFrozen = propertyResult.frozen;

      const tenantResult = await this.freezeExcessTenantsForOwner(ownerId, newConfig.maxTenants);
      result.tenantsFrozen = tenantResult.frozen;

      const frozen: string[] = [];
      if (result.propertiesFrozen > 0) frozen.push(`${result.propertiesFrozen} imóvel(is)`);
      if (result.tenantsFrozen > 0) frozen.push(`${result.tenantsFrozen} inquilino(s)`);

      result.message = `Plano alterado de ${oldConfig.displayName} para ${newConfig.displayName}. ${frozen.length > 0 ? frozen.join(', ') + ' foram congelados.' : 'Nenhuma entidade foi congelada.'}`;
    }
    else if (isUpgrade) {
      const propertyResult = await this.unfreezePropertiesForOwner(ownerId, newConfig.maxProperties);
      result.propertiesUnfrozen = propertyResult.unfrozen;

      const tenantResult = await this.unfreezeTenantsForOwner(ownerId, newConfig.maxTenants);
      result.tenantsUnfrozen = tenantResult.unfrozen;

      const unfrozen: string[] = [];
      if (result.propertiesUnfrozen > 0) unfrozen.push(`${result.propertiesUnfrozen} imóvel(is)`);
      if (result.tenantsUnfrozen > 0) unfrozen.push(`${result.tenantsUnfrozen} inquilino(s)`);

      result.message = `Upgrade realizado de ${oldConfig.displayName} para ${newConfig.displayName}. ${unfrozen.length > 0 ? unfrozen.join(', ') + ' foram desbloqueados.' : 'Nenhuma entidade foi desbloqueada.'}`;
    }
    else {
      result.message = `Plano mantido em ${newConfig.displayName}. Nenhuma alteração necessária.`;
    }

    await this.prisma.user.update({
      where: { id: BigInt(ownerId) },
      data: {
        plan: newPlan,
      },
    });

    await this.logEnforcementAction(ownerId, 'OWNER_PLAN_CHANGED', result);

    return result;
  }

  async enforceCurrentPlanLimitsForOwner(ownerId: string): Promise<EnforcementResult> {
    const owner = await this.prisma.user.findUnique({
      where: { id: BigInt(ownerId) },
      select: { id: true, plan: true, role: true },
    });

    if (!owner) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const currentPlan = owner.plan || 'FREE';
    const planConfig = getPlanByName(currentPlan) || PLANS_CONFIG.FREE;

    let result: EnforcementResult = {
      contractsFrozen: 0,
      usersFrozen: 0,
      propertiesFrozen: 0,
      tenantsFrozen: 0,
      contractsUnfrozen: 0,
      usersUnfrozen: 0,
      propertiesUnfrozen: 0,
      tenantsUnfrozen: 0,
      message: '',
    };

    const propertyResult = await this.freezeExcessPropertiesForOwner(ownerId, planConfig.maxProperties);
    result.propertiesFrozen = propertyResult.frozen;

    const tenantResult = await this.freezeExcessTenantsForOwner(ownerId, planConfig.maxTenants);
    result.tenantsFrozen = tenantResult.frozen;

    const frozen: string[] = [];
    if (result.propertiesFrozen > 0) frozen.push(`${result.propertiesFrozen} imóvel(is)`);
    if (result.tenantsFrozen > 0) frozen.push(`${result.tenantsFrozen} inquilino(s)`);

    result.message = frozen.length > 0
      ? `Limites do plano ${planConfig.displayName} aplicados. ${frozen.join(', ')} foram congelados.`
      : `Todos os recursos estão dentro dos limites do plano ${planConfig.displayName}. Nenhuma alteração necessária.`;

    await this.logEnforcementAction(ownerId, 'OWNER_PLAN_LIMITS_ENFORCED', result);

    return result;
  }

  async freezeExcessContracts(agencyId: string, limit: number): Promise<FreezeResult> {
    const activeContracts = await this.prisma.contract.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
        status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        property: { select: { address: true } },
      },
    });

    if (activeContracts.length <= limit) {
      return {
        frozen: 0,
        kept: activeContracts.map(c => c.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    const toKeepActive = activeContracts.slice(0, limit);
    const toFreeze = activeContracts.slice(limit);

    const frozenIds: string[] = [];
    for (const contract of toFreeze) {
      await this.prisma.contract.update({
        where: { id: contract.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.CONTRACT_FROZEN.replace('{limit}', limit.toString()),
          previousStatus: contract.status,
        },
      });
      frozenIds.push(contract.id.toString());
    }

    return {
      frozen: toFreeze.length,
      kept: toKeepActive.map(c => c.id.toString()),
      message: `${toFreeze.length} contrato(s) foram congelados devido ao limite do plano.`,
    };
  }

  async freezeExcessUsersByRole(agencyId: string, role: UserRole, limit: number): Promise<FreezeResult> {
    const activeUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: role,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (activeUsers.length <= limit) {
      return {
        frozen: 0,
        kept: activeUsers.map(u => u.id.toString()),
        message: `${this.getRoleDisplayName(role)} dentro do limite do plano`,
      };
    }

    const toKeepActive = activeUsers.slice(0, limit);
    const toFreeze = activeUsers.slice(limit);

    const frozenIds: string[] = [];
    for (const user of toFreeze) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: `Limite de ${limit} ${this.getRoleDisplayName(role)} atingido. ${PLAN_MESSAGES.USER_FROZEN}`,
        },
      });
      frozenIds.push(user.id.toString());
    }

    return {
      frozen: frozenIds.length,
      kept: toKeepActive.map(u => u.id.toString()),
      message: `${frozenIds.length} ${this.getRoleDisplayName(role)} foram congelados devido ao limite do plano.`,
    };
  }

  async freezeExcessUsers(agencyId: string, limit: number): Promise<FreezeResult> {
    // Only count users subject to plan limits (exclude platform and agency admin roles)
    const activeUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: {
          notIn: EXCLUDED_FROM_USER_COUNT,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (limit >= 9999 || limit === -1) {
      return {
        frozen: 0,
        kept: activeUsers.map(u => u.id.toString()),
        message: 'Usuários ilimitados no plano',
      };
    }

    if (activeUsers.length <= limit) {
      return {
        frozen: 0,
        kept: activeUsers.map(u => u.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    const toKeepActive = activeUsers.slice(0, limit);
    const toFreeze = activeUsers.slice(limit);

    const frozenIds: string[] = [];
    for (const user of toFreeze) {
      // Double-check: Never freeze platform users (safety check)
      if (user.role && PLATFORM_ROLES.includes(user.role)) {
        continue;
      }

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
      frozen: frozenIds.length,
      kept: toKeepActive.map(u => u.id.toString()),
      message: `${frozenIds.length} usuário(s) foram congelados devido ao limite do plano.`,
    };
  }

  async unfreezeContracts(agencyId: string, newLimit: number): Promise<UnfreezeResult> {
    const activeCount = await this.prisma.contract.count({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
        status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
      },
    });

    const canUnfreeze = Math.max(0, newLimit - activeCount);

    if (canUnfreeze === 0) {
      return {
        unfrozen: 0,
        message: 'Nenhum contrato para descongelar.',
      };
    }

    const frozenContracts = await this.prisma.contract.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: true,
      },
      orderBy: { frozenAt: 'asc' },
      take: canUnfreeze,
      select: { id: true, previousStatus: true },
    });

    for (const contract of frozenContracts) {
      await this.prisma.contract.update({
        where: { id: contract.id },
        data: {
          isFrozen: false,
          frozenAt: null,
          frozenReason: null,
          status: contract.previousStatus || 'ATIVO',
          previousStatus: null,
        },
      });
    }

    return {
      unfrozen: frozenContracts.length,
      message: `${frozenContracts.length} contrato(s) foram desbloqueados.`,
    };
  }

  async unfreezeUsersByRole(agencyId: string, role: UserRole): Promise<UnfreezeResult> {
    // Unfreeze all frozen users of this role
    const frozenUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: true,
        role: role,
      },
      select: { id: true },
    });

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
      message: `${frozenUsers.length} ${this.getRoleDisplayName(role)} foram reativados.`,
    };
  }

  async unfreezeUsersByRoleWithLimit(agencyId: string, role: UserRole, limit: number): Promise<UnfreezeResult> {
    const activeCount = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: role,
      },
    });

    const canUnfreeze = Math.max(0, limit - activeCount);

    if (canUnfreeze === 0) {
      return {
        unfrozen: 0,
        message: `Nenhum ${this.getRoleDisplayName(role)} para descongelar.`,
      };
    }

    const frozenUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: true,
        role: role,
      },
      orderBy: { frozenAt: 'asc' },
      take: canUnfreeze,
      select: { id: true },
    });

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
      message: `${frozenUsers.length} ${this.getRoleDisplayName(role)} foram reativados.`,
    };
  }

  async unfreezeUsers(agencyId: string, newLimit: number): Promise<UnfreezeResult> {
    // Count only users subject to plan limits (exclude platform and agency admin roles)
    const activeCount = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: {
          notIn: EXCLUDED_FROM_USER_COUNT,
        },
      },
    });

    const canUnfreeze = Math.max(0, newLimit - activeCount);

    if (canUnfreeze === 0) {
      return {
        unfrozen: 0,
        message: 'Nenhum usuário para descongelar.',
      };
    }

    // Only unfreeze non-platform users (platform users should never be frozen in the first place)
    const frozenUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: true,
        role: {
          notIn: PLATFORM_ROLES,
        },
      },
      orderBy: { frozenAt: 'asc' },
      take: canUnfreeze,
      select: { id: true },
    });

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

  async freezeExcessProperties(agencyId: string, limit: number): Promise<FreezeResult> {
    const activeProperties = await this.prisma.property.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        address: true,
        createdAt: true,
      },
    });

    if (activeProperties.length <= limit) {
      return {
        frozen: 0,
        kept: activeProperties.map(p => p.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    const toKeepActive = activeProperties.slice(0, limit);
    const toFreeze = activeProperties.slice(limit);

    const frozenIds: string[] = [];
    for (const property of toFreeze) {
      await this.prisma.property.update({
        where: { id: property.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.CREATE_PROPERTY_BLOCKED.replace('{limit}', limit.toString()).replace('{plan}', ''),
          previousStatus: property.status,
        },
      });
      frozenIds.push(property.id.toString());
    }

    return {
      frozen: toFreeze.length,
      kept: toKeepActive.map(p => p.id.toString()),
      message: `${toFreeze.length} imóvel(is) foram congelados devido ao limite do plano.`,
    };
  }

  async freezeExcessPropertiesForOwner(ownerId: string, limit: number): Promise<FreezeResult> {
    const activeProperties = await this.prisma.property.findMany({
      where: {
        ownerId: BigInt(ownerId),
        deleted: false,
        isFrozen: false,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        address: true,
        createdAt: true,
      },
    });

    if (activeProperties.length <= limit) {
      return {
        frozen: 0,
        kept: activeProperties.map(p => p.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    const toKeepActive = activeProperties.slice(0, limit);
    const toFreeze = activeProperties.slice(limit);

    for (const property of toFreeze) {
      await this.prisma.property.update({
        where: { id: property.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.CREATE_PROPERTY_BLOCKED.replace('{limit}', limit.toString()).replace('{plan}', ''),
          previousStatus: property.status,
        },
      });
    }

    return {
      frozen: toFreeze.length,
      kept: toKeepActive.map(p => p.id.toString()),
      message: `${toFreeze.length} imóvel(is) foram congelados devido ao limite do plano.`,
    };
  }

  async unfreezeProperties(agencyId: string, newLimit: number): Promise<UnfreezeResult> {
    const activeCount = await this.prisma.property.count({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
      },
    });

    const canUnfreeze = Math.max(0, newLimit - activeCount);

    if (canUnfreeze === 0) {
      return {
        unfrozen: 0,
        message: 'Nenhum imóvel para descongelar.',
      };
    }

    const frozenProperties = await this.prisma.property.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: true,
      },
      orderBy: { frozenAt: 'asc' },
      take: canUnfreeze,
      select: { id: true, previousStatus: true },
    });

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
      message: `${frozenProperties.length} imóvel(is) foram desbloqueados.`,
    };
  }

  async unfreezePropertiesForOwner(ownerId: string, newLimit: number): Promise<UnfreezeResult> {
    const activeCount = await this.prisma.property.count({
      where: {
        ownerId: BigInt(ownerId),
        deleted: false,
        isFrozen: false,
      },
    });

    const canUnfreeze = Math.max(0, newLimit - activeCount);

    if (canUnfreeze === 0) {
      return {
        unfrozen: 0,
        message: 'Nenhum imóvel para descongelar.',
      };
    }

    const frozenProperties = await this.prisma.property.findMany({
      where: {
        ownerId: BigInt(ownerId),
        deleted: false,
        isFrozen: true,
      },
      orderBy: { frozenAt: 'asc' },
      take: canUnfreeze,
      select: { id: true, previousStatus: true },
    });

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
      message: `${frozenProperties.length} imóvel(is) foram desbloqueados.`,
    };
  }

  async freezeExcessTenants(agencyId: string, limit: number): Promise<FreezeResult> {
    if (limit >= 9999) {
      return {
        frozen: 0,
        kept: [],
        message: 'Inquilinos ilimitados no plano',
      };
    }

    const activeTenants = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.INQUILINO,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (activeTenants.length <= limit) {
      return {
        frozen: 0,
        kept: activeTenants.map(t => t.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    const toKeepActive = activeTenants.slice(0, limit);
    const toFreeze = activeTenants.slice(limit);

    for (const tenant of toFreeze) {
      await this.prisma.user.update({
        where: { id: tenant.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.CREATE_TENANT_BLOCKED.replace('{limit}', limit.toString()).replace('{plan}', ''),
        },
      });
    }

    return {
      frozen: toFreeze.length,
      kept: toKeepActive.map(t => t.id.toString()),
      message: `${toFreeze.length} inquilino(s) foram congelados devido ao limite do plano.`,
    };
  }

  async freezeExcessTenantsForOwner(ownerId: string, limit: number): Promise<FreezeResult> {
    if (limit >= 9999) {
      return {
        frozen: 0,
        kept: [],
        message: 'Inquilinos ilimitados no plano',
      };
    }

    const activeTenants = await this.prisma.user.findMany({
      where: {
        ownerId: BigInt(ownerId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.INQUILINO,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (activeTenants.length <= limit) {
      return {
        frozen: 0,
        kept: activeTenants.map(t => t.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    const toKeepActive = activeTenants.slice(0, limit);
    const toFreeze = activeTenants.slice(limit);

    for (const tenant of toFreeze) {
      await this.prisma.user.update({
        where: { id: tenant.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.CREATE_TENANT_BLOCKED.replace('{limit}', limit.toString()).replace('{plan}', ''),
        },
      });
    }

    return {
      frozen: toFreeze.length,
      kept: toKeepActive.map(t => t.id.toString()),
      message: `${toFreeze.length} inquilino(s) foram congelados devido ao limite do plano.`,
    };
  }

  async unfreezeTenants(agencyId: string, newLimit: number): Promise<UnfreezeResult> {
    const effectiveLimit = newLimit >= 9999 ? 9999 : newLimit;

    const activeCount = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.INQUILINO,
      },
    });

    const canUnfreeze = Math.max(0, effectiveLimit - activeCount);

    if (canUnfreeze === 0 && effectiveLimit < 9999) {
      return {
        unfrozen: 0,
        message: 'Nenhum inquilino para descongelar.',
      };
    }

    const frozenTenants = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: true,
        role: UserRole.INQUILINO,
      },
      orderBy: { frozenAt: 'asc' },
      take: effectiveLimit >= 9999 ? undefined : canUnfreeze,
      select: { id: true },
    });

    for (const tenant of frozenTenants) {
      await this.prisma.user.update({
        where: { id: tenant.id },
        data: {
          isFrozen: false,
          frozenAt: null,
          frozenReason: null,
        },
      });
    }

    return {
      unfrozen: frozenTenants.length,
      message: `${frozenTenants.length} inquilino(s) foram reativados.`,
    };
  }

  async unfreezeTenantsForOwner(ownerId: string, newLimit: number): Promise<UnfreezeResult> {
    const effectiveLimit = newLimit >= 9999 ? 9999 : newLimit;

    const activeCount = await this.prisma.user.count({
      where: {
        ownerId: BigInt(ownerId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.INQUILINO,
      },
    });

    const canUnfreeze = Math.max(0, effectiveLimit - activeCount);

    if (canUnfreeze === 0 && effectiveLimit < 9999) {
      return {
        unfrozen: 0,
        message: 'Nenhum inquilino para descongelar.',
      };
    }

    const frozenTenants = await this.prisma.user.findMany({
      where: {
        ownerId: BigInt(ownerId),
        isFrozen: true,
        role: UserRole.INQUILINO,
      },
      orderBy: { frozenAt: 'asc' },
      take: effectiveLimit >= 9999 ? undefined : canUnfreeze,
      select: { id: true },
    });

    for (const tenant of frozenTenants) {
      await this.prisma.user.update({
        where: { id: tenant.id },
        data: {
          isFrozen: false,
          frozenAt: null,
          frozenReason: null,
        },
      });
    }

    return {
      unfrozen: frozenTenants.length,
      message: `${frozenTenants.length} inquilino(s) foram reativados.`,
    };
  }

  async switchActiveContract(agencyId: string, newActiveContractId: string): Promise<SwitchResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;

    if (planConfig.maxActiveContracts > 1) {
      throw new BadRequestException('Esta operação só é disponível para planos com limite de 1 contrato.');
    }

    const newActiveContract = await this.prisma.contract.findFirst({
      where: {
        id: BigInt(newActiveContractId),
        agencyId: BigInt(agencyId),
        deleted: false,
      },
      select: {
        id: true,
        isFrozen: true,
        previousStatus: true,
        property: { select: { address: true } },
      },
    });

    if (!newActiveContract) {
      throw new NotFoundException('Contrato não encontrado ou não pertence a esta agência.');
    }

    const currentActiveContract = await this.prisma.contract.findFirst({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
        status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
      },
      select: {
        id: true,
        status: true,
        property: { select: { address: true } },
      },
    });

    if (!newActiveContract.isFrozen) {
      return {
        success: false,
        message: 'Este contrato já está ativo.',
      };
    }

    if (currentActiveContract) {
      await this.prisma.contract.update({
        where: { id: currentActiveContract.id },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: PLAN_MESSAGES.CONTRACT_FROZEN.replace('{limit}', '1'),
          previousStatus: currentActiveContract.status,
        },
      });
    }

    await this.prisma.contract.update({
      where: { id: newActiveContract.id },
      data: {
        isFrozen: false,
        frozenAt: null,
        frozenReason: null,
        status: newActiveContract.previousStatus || 'ATIVO',
        previousStatus: null,
      },
    });

    await this.updateFrozenCounts(agencyId);

    return {
      success: true,
      message: PLAN_MESSAGES.SWITCH_ACTIVE_SUCCESS,
      frozenContract: currentActiveContract ? {
        id: currentActiveContract.id.toString(),
        property: currentActiveContract.property.address,
      } : undefined,
      activatedContract: {
        id: newActiveContract.id.toString(),
        property: newActiveContract.property.address,
      },
    };
  }

  async getFrozenEntitiesSummary(agencyId: string): Promise<FrozenSummary> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { 
        id: true, 
        plan: true,
        monthlyInspectionsUsed: true,
        monthlySettlementsUsed: true,
        monthlyScreeningsUsed: true,
        monthlyApiCallsUsed: true,
      },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;
    const limits = this.getPlanLimitsForAgency(agency.plan);
    const freeLimits = getFreeUsageLimits(agency.plan);

    // Calculate actual usage from records for current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Count actual analyses created this month
    const actualScreeningsCount = await this.prisma.tenantAnalysis.count({
      where: {
        agencyId: BigInt(agencyId),
        analyzedAt: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth,
        },
      },
    });

    const [activeContracts, frozenContracts, totalContracts] = await Promise.all([
      this.prisma.contract.count({
        where: {
          agencyId: BigInt(agencyId),
          deleted: false,
          isFrozen: false,
          status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
        },
      }),
      this.prisma.contract.count({
        where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: true },
      }),
      this.prisma.contract.count({
        where: { agencyId: BigInt(agencyId), deleted: false },
      }),
    ]);

    const [activeUsers, frozenUsers, totalUsers] = await Promise.all([
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
          role: { notIn: EXCLUDED_FROM_USER_COUNT },
        },
      }),
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: true,
          role: { notIn: EXCLUDED_FROM_USER_COUNT },
        },
      }),
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          role: { notIn: EXCLUDED_FROM_USER_COUNT },
        },
      }),
    ]);

    const isOverLimit = activeContracts > limits.contracts || activeUsers > limits.users;

    return {
      contracts: {
        active: activeContracts,
        frozen: frozenContracts,
        total: totalContracts,
        limit: limits.contracts,
      },
      users: {
        active: activeUsers,
        frozen: frozenUsers,
        total: totalUsers,
        limit: limits.users,
      },
      isOverLimit,
      upgradeRequired: frozenContracts > 0 || frozenUsers > 0,
      plan: agency.plan,
      planDisplayName: planConfig.displayName,
      freeUsage: {
        inspections: {
          current: agency.monthlyInspectionsUsed || 0,
          limit: freeLimits.freeInspections === -1 ? -1 : freeLimits.freeInspections,
        },
        analyses: {
          current: actualScreeningsCount || agency.monthlyScreeningsUsed || 0,
          limit: freeLimits.freeSearches === -1 ? -1 : freeLimits.freeSearches,
        },
        agreements: {
          current: agency.monthlySettlementsUsed || 0,
          limit: freeLimits.freeSettlements === -1 ? -1 : freeLimits.freeSettlements,
        },
        apiCalls: {
          current: agency.monthlyApiCallsUsed || 0,
          limit: freeLimits.freeApiCalls === -1 ? -1 : freeLimits.freeApiCalls,
        },
      },
    };
  }

  async getFrozenEntitiesList(agencyId: string): Promise<FrozenEntitiesList> {
    const frozenContracts = await this.prisma.contract.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: true,
      },
      select: {
        id: true,
        frozenAt: true,
        frozenReason: true,
        property: { select: { address: true } },
        tenantUser: { select: { name: true } },
      },
      orderBy: { frozenAt: 'desc' },
    });

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
      contracts: frozenContracts.map(c => ({
        id: c.id.toString(),
        name: `Contrato - ${c.property.address}`,
        propertyAddress: c.property.address,
        tenantName: c.tenantUser.name || '',
        frozenAt: c.frozenAt?.toISOString() || '',
        frozenReason: c.frozenReason || '',
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

  async isContractFrozen(contractId: string): Promise<boolean> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      select: { isFrozen: true },
    });
    return contract?.isFrozen ?? false;
  }

  async isUserFrozen(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { isFrozen: true },
    });
    return user?.isFrozen ?? false;
  }

  async previewPlanChange(agencyId: string, newPlan: string): Promise<{
    currentPlan: string;
    newPlan: string;
    currentLimits: { 
      properties: number; 
      users: number;
      tenants: number;
      owners: number;
      brokers: number;
      managers: number;
    };
    newLimits: { 
      properties: number; 
      users: number;
      tenants: number;
      owners: number;
      brokers: number;
      managers: number;
    };
    currentUsage: { 
      properties: number; 
      users: number;
      tenants: number;
      owners: number;
      brokers: number;
      managers: number;
    };
    willFreeze: { 
      properties: number; 
      users: number;
      tenants: number;
      owners: number;
      brokers: number;
      managers: number;
    };
    willUnfreeze: { 
      properties: number; 
      users: number;
      tenants: number;
      owners: number;
      brokers: number;
      managers: number;
    };
    isUpgrade: boolean;
    warning?: string;
  }> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const currentConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;
    const newConfig = getPlanByName(newPlan) || PLANS_CONFIG.FREE;

    const activeContracts = await this.prisma.contract.count({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
        status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
      },
    });

    // Count active users by role
    const [activeTenants, activeOwners, activeBrokers, activeManagers] = await Promise.all([
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
          role: UserRole.INQUILINO,
        },
      }),
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
          role: UserRole.PROPRIETARIO,
        },
      }),
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
          role: UserRole.BROKER,
        },
      }),
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
          role: UserRole.AGENCY_MANAGER,
        },
      }),
    ]);

    const activeUsers = activeTenants + activeOwners + activeBrokers + activeManagers;

    const frozenContracts = await this.prisma.contract.count({
      where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: true },
    });

    // Count frozen users by role
    const [frozenTenants, frozenOwners, frozenBrokers, frozenManagers] = await Promise.all([
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: true,
          role: UserRole.INQUILINO,
        },
      }),
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: true,
          role: UserRole.PROPRIETARIO,
        },
      }),
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: true,
          role: UserRole.BROKER,
        },
      }),
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: true,
          role: UserRole.AGENCY_MANAGER,
        },
      }),
    ]);

    const frozenUsers = frozenTenants + frozenOwners + frozenBrokers + frozenManagers;

    // Calculate what would freeze for contracts
    const contractsWouldFreeze = Math.max(0, activeContracts - newConfig.maxActiveContracts);
    const canUnfreezeContracts = Math.max(0, newConfig.maxActiveContracts - activeContracts);
    const contractsWouldUnfreeze = Math.min(canUnfreezeContracts, frozenContracts);

    // Calculate what would freeze/unfreeze for each user type
    const currentTenantLimit = currentConfig.maxTenants === -1 ? 9999 : currentConfig.maxTenants;
    const newTenantLimit = newConfig.maxTenants === -1 ? 9999 : newConfig.maxTenants;
    const tenantsWouldFreeze = Math.max(0, activeTenants - newTenantLimit);
    const canUnfreezeTenants = Math.max(0, newTenantLimit - activeTenants);
    const tenantsWouldUnfreeze = Math.min(canUnfreezeTenants, frozenTenants);

    const currentOwnerLimit = currentConfig.maxOwners === -1 ? 9999 : currentConfig.maxOwners;
    const newOwnerLimit = newConfig.maxOwners === -1 ? 9999 : newConfig.maxOwners;
    const ownersWouldFreeze = Math.max(0, activeOwners - newOwnerLimit);
    const canUnfreezeOwners = Math.max(0, newOwnerLimit - activeOwners);
    const ownersWouldUnfreeze = Math.min(canUnfreezeOwners, frozenOwners);

    const currentBrokerLimit = currentConfig.maxBrokers === -1 ? 9999 : currentConfig.maxBrokers;
    const newBrokerLimit = newConfig.maxBrokers === -1 ? 9999 : newConfig.maxBrokers;
    const brokersWouldFreeze = Math.max(0, activeBrokers - newBrokerLimit);
    const canUnfreezeBrokers = Math.max(0, newBrokerLimit - activeBrokers);
    const brokersWouldUnfreeze = Math.min(canUnfreezeBrokers, frozenBrokers);

    const currentManagerLimit = currentConfig.maxManagers === -1 ? 9999 : currentConfig.maxManagers;
    const newManagerLimit = newConfig.maxManagers === -1 ? 9999 : newConfig.maxManagers;
    const managersWouldFreeze = Math.max(0, activeManagers - newManagerLimit);
    const canUnfreezeManagers = Math.max(0, newManagerLimit - activeManagers);
    const managersWouldUnfreeze = Math.min(canUnfreezeManagers, frozenManagers);

    // Calculate total users that would freeze (sum of all roles)
    const usersWouldFreeze = tenantsWouldFreeze + ownersWouldFreeze + brokersWouldFreeze + managersWouldFreeze;
    const usersWouldUnfreeze = tenantsWouldUnfreeze + ownersWouldUnfreeze + brokersWouldUnfreeze + managersWouldUnfreeze;

    let warning: string | undefined;
    if (contractsWouldFreeze > 0 || usersWouldFreeze > 0) {
      warning = PLAN_MESSAGES.DOWNGRADE_WARNING
        .replace('{plan}', newConfig.displayName)
        .replace('{freezeCount}', contractsWouldFreeze.toString())
        .replace('{userFreezeCount}', usersWouldFreeze.toString());
    }

    const currentUserLimit = currentConfig.maxInternalUsers === -1 ? 9999 : currentConfig.maxInternalUsers;
    const newUserLimit = newConfig.maxInternalUsers === -1 ? 9999 : newConfig.maxInternalUsers;

    const isUpgrade = newConfig.maxProperties > currentConfig.maxProperties ||
                      newUserLimit > currentUserLimit ||
                      newTenantLimit > currentTenantLimit ||
                      newOwnerLimit > currentOwnerLimit ||
                      newBrokerLimit > currentBrokerLimit ||
                      newManagerLimit > currentManagerLimit;

    return {
      currentPlan: agency.plan,
      newPlan: newPlan,
      currentLimits: {
        properties: currentConfig.maxProperties,
        users: currentUserLimit,
        tenants: currentTenantLimit,
        owners: currentOwnerLimit,
        brokers: currentBrokerLimit,
        managers: currentManagerLimit,
      },
      newLimits: {
        properties: newConfig.maxProperties,
        users: newUserLimit,
        tenants: newTenantLimit,
        owners: newOwnerLimit,
        brokers: newBrokerLimit,
        managers: newManagerLimit,
      },
      currentUsage: {
        properties: activeContracts,
        users: activeUsers,
        tenants: activeTenants,
        owners: activeOwners,
        brokers: activeBrokers,
        managers: activeManagers,
      },
      willFreeze: {
        properties: contractsWouldFreeze,
        users: usersWouldFreeze,
        tenants: tenantsWouldFreeze,
        owners: ownersWouldFreeze,
        brokers: brokersWouldFreeze,
        managers: managersWouldFreeze,
      },
      willUnfreeze: {
        properties: contractsWouldUnfreeze,
        users: usersWouldUnfreeze,
        tenants: tenantsWouldUnfreeze,
        owners: ownersWouldUnfreeze,
        brokers: brokersWouldUnfreeze,
        managers: managersWouldUnfreeze,
      },
      isUpgrade,
      warning,
    };
  }

  private async countFrozenContracts(agencyId: string): Promise<number> {
    return this.prisma.contract.count({
      where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: true },
    });
  }

  private async countFrozenUsers(agencyId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: true,
        role: { notIn: EXCLUDED_FROM_USER_COUNT }
      },
    });
  }

  private async updateFrozenCounts(agencyId: string): Promise<void> {
    const [frozenContracts, frozenUsers] = await Promise.all([
      this.countFrozenContracts(agencyId),
      this.countFrozenUsers(agencyId),
    ]);

    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        frozenContractsCount: frozenContracts,
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
        apiAddOnEnabled: false,
      },
    });
  }

  private async enableApiAccess(agencyId: string): Promise<void> {
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
    userId?: string,
    ip?: string,
  ): Promise<void> {
    const crypto = require('crypto');
    const timestamp = new Date().toISOString();
    const dataAfter = JSON.stringify(details);
    const hashData = `${action}|${userId || 'system'}|Agency|${agencyId}|${dataAfter}|${ip || ''}|${timestamp}`;
    const integrityHash = crypto.createHash('sha256').update(hashData).digest('hex');
    
    await this.prisma.auditLog.create({
      data: {
        event: action,
        userId: userId ? BigInt(userId) : null,
        entity: 'Agency',
        entityId: BigInt(agencyId),
        dataAfter,
        ip: ip || null,
        integrityHash,
      },
    });
  }
}
