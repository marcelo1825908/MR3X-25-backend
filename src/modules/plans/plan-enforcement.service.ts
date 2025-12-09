import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PLANS_CONFIG, getPlanLimits, getPlanByName, EntityType, PlanLimits } from './plans.data';
import { UserRole } from '@prisma/client';

// Message templates in Portuguese
export const PLAN_MESSAGES = {
  CONTRACT_FROZEN: 'Este contrato está congelado. Seu plano atual permite apenas {limit} contrato(s) ativo(s). Faça upgrade para desbloquear.',
  USER_FROZEN: 'Este usuário está desativado devido ao limite do plano. Faça upgrade para reativar.',
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

// Result interfaces
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

  /**
   * Get plan limits for a specific entity type
   */
  getPlanLimitsForAgency(planName: string): PlanLimits {
    return getPlanLimits(planName, 'agency');
  }

  /**
   * Check if a contract operation is allowed based on agency plan
   */
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

    // For update/delete, check if the specific contract is frozen
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

    // For create, check if agency has reached contract limit
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

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;
    const limits = this.getPlanLimitsForAgency(agency.plan);

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
      // Count internal users (AGENCY_ADMIN, AGENCY_MANAGER, BROKER)
      const activeUserCount = await this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
          role: {
            in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER],
          },
        },
      });

      // Check if unlimited users
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

  /**
   * Check if a property operation is allowed based on user/agency plan
   * This checks against maxProperties limit
   */
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

    // For create, check property limits
    if (operation === 'create') {
      // If user belongs to an agency, check agency limits
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
        // For independent owners, check their personal plan limits
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

  /**
   * Check if a tenant operation is allowed based on user/agency plan
   * This checks against maxTenants limit
   */
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

    // For update/delete, check if the specific tenant user is frozen
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

    // For create, check tenant limits
    if (operation === 'create') {
      // If user belongs to an agency, check agency limits
      if (user.agencyId) {
        const agency = await this.prisma.agency.findUnique({
          where: { id: user.agencyId },
          select: { id: true, plan: true },
        });

        if (agency) {
          const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;

          // Count tenants (INQUILINO role users) linked to this agency
          const tenantCount = await this.prisma.user.count({
            where: {
              agencyId: user.agencyId,
              role: UserRole.INQUILINO,
              status: 'ACTIVE',
              isFrozen: false,
            },
          });

          // maxTenants 9999 means unlimited
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
        // For independent owners, check their personal plan limits
        const planConfig = getPlanByName(user.plan || 'FREE') || PLANS_CONFIG.FREE;

        // Count tenants linked to this independent owner's properties
        const tenantCount = await this.prisma.user.count({
          where: {
            createdBy: user.id,
            role: UserRole.INQUILINO,
            status: 'ACTIVE',
            isFrozen: false,
          },
        });

        // maxTenants 9999 means unlimited
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

  /**
   * Check if an inspection can be performed
   */
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

  /**
   * Check if a settlement/agreement can be created
   */
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

  /**
   * Check if payment can be registered for a contract
   */
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
   * Check if API access is allowed
   */
  async checkApiAccessAllowed(agencyId: string): Promise<OperationResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true, apiEnabled: true, apiAddOnEnabled: true },
    });

    if (!agency) {
      return { allowed: false, message: 'Agência não encontrada' };
    }

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;

    // API included in plan
    if (planConfig.apiAccessIncluded && agency.apiEnabled) {
      return { allowed: true };
    }

    // API add-on enabled for PROFESSIONAL
    if (planConfig.apiAccessOptional && agency.apiAddOnEnabled && agency.apiEnabled) {
      return { allowed: true };
    }

    // API not available
    if (!planConfig.apiAccessIncluded && !planConfig.apiAccessOptional) {
      return {
        allowed: false,
        message: PLAN_MESSAGES.API_DISABLED,
      };
    }

    // API add-on available but not enabled
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

    // Check if downgrading any limit
    const isDowngrade =
      newConfig.maxActiveContracts < oldConfig.maxActiveContracts ||
      newConfig.maxProperties < oldConfig.maxProperties ||
      newConfig.maxTenants < oldConfig.maxTenants ||
      (newConfig.maxInternalUsers !== -1 && newConfig.maxInternalUsers < (oldConfig.maxInternalUsers === -1 ? 9999 : oldConfig.maxInternalUsers));

    // Check if upgrading any limit
    const isUpgrade =
      newConfig.maxActiveContracts > oldConfig.maxActiveContracts ||
      newConfig.maxProperties > oldConfig.maxProperties ||
      newConfig.maxTenants > oldConfig.maxTenants ||
      (newConfig.maxInternalUsers === -1 || newConfig.maxInternalUsers > (oldConfig.maxInternalUsers === -1 ? 9999 : oldConfig.maxInternalUsers));

    // Downgrade scenario: freeze excess entities
    if (isDowngrade) {
      // Freeze excess contracts
      const contractResult = await this.freezeExcessContracts(agencyId, newConfig.maxActiveContracts);
      result.contractsFrozen = contractResult.frozen;

      // Freeze excess users (internal)
      const userLimit = newConfig.maxInternalUsers === -1 ? 9999 : newConfig.maxInternalUsers;
      const userResult = await this.freezeExcessUsers(agencyId, userLimit);
      result.usersFrozen = userResult.frozen;

      // Freeze excess properties
      const propertyResult = await this.freezeExcessProperties(agencyId, newConfig.maxProperties);
      result.propertiesFrozen = propertyResult.frozen;

      // Freeze excess tenants
      const tenantResult = await this.freezeExcessTenants(agencyId, newConfig.maxTenants);
      result.tenantsFrozen = tenantResult.frozen;

      // Disable API access if downgrading to a plan without API
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
    // Upgrade scenario: unfreeze entities up to new limit
    else if (isUpgrade) {
      // Unfreeze contracts up to new limit
      const contractResult = await this.unfreezeContracts(agencyId, newConfig.maxActiveContracts);
      result.contractsUnfrozen = contractResult.unfrozen;

      // Unfreeze users up to new limit
      const userLimit = newConfig.maxInternalUsers === -1 ? 9999 : newConfig.maxInternalUsers;
      const userResult = await this.unfreezeUsers(agencyId, userLimit);
      result.usersUnfrozen = userResult.unfrozen;

      // Unfreeze properties up to new limit
      const propertyResult = await this.unfreezeProperties(agencyId, newConfig.maxProperties);
      result.propertiesUnfrozen = propertyResult.unfrozen;

      // Unfreeze tenants up to new limit
      const tenantResult = await this.unfreezeTenants(agencyId, newConfig.maxTenants);
      result.tenantsUnfrozen = tenantResult.unfrozen;

      // Enable API access if upgrading to a plan with API
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

    // Update agency plan and tracking fields
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

    // Log the enforcement action
    await this.logEnforcementAction(agencyId, 'PLAN_CHANGED', result);

    return result;
  }

  /**
   * Enforce plan limits when independent owner plan changes
   */
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

    // Check if downgrading any limit
    const isDowngrade =
      newConfig.maxProperties < oldConfig.maxProperties ||
      newConfig.maxTenants < oldConfig.maxTenants;

    // Check if upgrading any limit
    const isUpgrade =
      newConfig.maxProperties > oldConfig.maxProperties ||
      newConfig.maxTenants > oldConfig.maxTenants;

    // Downgrade scenario: freeze excess entities
    if (isDowngrade) {
      // Freeze excess properties
      const propertyResult = await this.freezeExcessPropertiesForOwner(ownerId, newConfig.maxProperties);
      result.propertiesFrozen = propertyResult.frozen;

      // Freeze excess tenants
      const tenantResult = await this.freezeExcessTenantsForOwner(ownerId, newConfig.maxTenants);
      result.tenantsFrozen = tenantResult.frozen;

      const frozen: string[] = [];
      if (result.propertiesFrozen > 0) frozen.push(`${result.propertiesFrozen} imóvel(is)`);
      if (result.tenantsFrozen > 0) frozen.push(`${result.tenantsFrozen} inquilino(s)`);

      result.message = `Plano alterado de ${oldConfig.displayName} para ${newConfig.displayName}. ${frozen.length > 0 ? frozen.join(', ') + ' foram congelados.' : 'Nenhuma entidade foi congelada.'}`;
    }
    // Upgrade scenario: unfreeze entities up to new limit
    else if (isUpgrade) {
      // Unfreeze properties up to new limit
      const propertyResult = await this.unfreezePropertiesForOwner(ownerId, newConfig.maxProperties);
      result.propertiesUnfrozen = propertyResult.unfrozen;

      // Unfreeze tenants up to new limit
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

    // Update owner plan
    await this.prisma.user.update({
      where: { id: BigInt(ownerId) },
      data: {
        plan: newPlan,
      },
    });

    // Log the enforcement action
    await this.logEnforcementAction(ownerId, 'OWNER_PLAN_CHANGED', result);

    return result;
  }

  /**
   * Freeze contracts exceeding the limit
   * Keeps the most recently created contracts active
   */
  async freezeExcessContracts(agencyId: string, limit: number): Promise<FreezeResult> {
    // Get all active (non-frozen, non-deleted) contracts for agency
    const activeContracts = await this.prisma.contract.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
        status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      select: {
        id: true,
        status: true,
        createdAt: true,
        property: { select: { address: true } },
      },
    });

    // If within limit, nothing to freeze
    if (activeContracts.length <= limit) {
      return {
        frozen: 0,
        kept: activeContracts.map(c => c.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    // Keep the most recent 'limit' contracts active
    const toKeepActive = activeContracts.slice(0, limit);
    const toFreeze = activeContracts.slice(limit);

    // Freeze excess contracts
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

  /**
   * Freeze users exceeding the limit
   * Keeps the most recently created users active
   */
  async freezeExcessUsers(agencyId: string, limit: number): Promise<FreezeResult> {
    // Get all active (non-frozen) internal users for agency
    const activeUsers = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: {
          in: [UserRole.AGENCY_MANAGER, UserRole.BROKER],
          // AGENCY_ADMIN never frozen
        },
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    // Count AGENCY_ADMIN separately (they don't count against limit and never freeze)
    const agencyAdmins = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.AGENCY_ADMIN,
      },
    });

    // If unlimited users
    if (limit >= 9999) {
      return {
        frozen: 0,
        kept: activeUsers.map(u => u.id.toString()),
        message: 'Usuários ilimitados no plano',
      };
    }

    // Effective limit for non-admin users
    const effectiveLimit = Math.max(0, limit - agencyAdmins);

    // If within limit, nothing to freeze
    if (activeUsers.length <= effectiveLimit) {
      return {
        frozen: 0,
        kept: activeUsers.map(u => u.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    // Keep the most recent users up to the effective limit
    const toKeepActive = activeUsers.slice(0, effectiveLimit);
    const toFreeze = activeUsers.slice(effectiveLimit);

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
      kept: toKeepActive.map(u => u.id.toString()),
      message: `${toFreeze.length} usuário(s) foram desativados devido ao limite do plano.`,
    };
  }

  /**
   * Unfreeze contracts up to the new limit
   * Unfreezes in order of when they were frozen (oldest frozen first)
   */
  async unfreezeContracts(agencyId: string, newLimit: number): Promise<UnfreezeResult> {
    // Get current active contracts count
    const activeCount = await this.prisma.contract.count({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
        status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
      },
    });

    // Calculate how many can be unfrozen
    const canUnfreeze = Math.max(0, newLimit - activeCount);

    if (canUnfreeze === 0) {
      return {
        unfrozen: 0,
        message: 'Nenhum contrato para descongelar.',
      };
    }

    // Get frozen contracts, oldest frozen first
    const frozenContracts = await this.prisma.contract.findMany({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: true,
      },
      orderBy: { frozenAt: 'asc' }, // Oldest frozen first
      take: canUnfreeze,
      select: { id: true, previousStatus: true },
    });

    // Unfreeze contracts
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
        role: {
          in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER],
        },
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
      select: {
        id: true,
        status: true,
        address: true,
        createdAt: true,
      },
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

  /**
   * Freeze properties for independent owner exceeding the limit
   */
  async freezeExcessPropertiesForOwner(ownerId: string, limit: number): Promise<FreezeResult> {
    // Get all active (non-frozen, non-deleted) properties for owner
    const activeProperties = await this.prisma.property.findMany({
      where: {
        ownerId: BigInt(ownerId),
        deleted: false,
        isFrozen: false,
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      select: {
        id: true,
        status: true,
        address: true,
        createdAt: true,
      },
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

  /**
   * Unfreeze properties up to the new limit
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
      message: `${frozenProperties.length} imóvel(is) foram desbloqueados.`,
    };
  }

  /**
   * Unfreeze properties for independent owner up to the new limit
   */
  async unfreezePropertiesForOwner(ownerId: string, newLimit: number): Promise<UnfreezeResult> {
    // Get current active properties count
    const activeCount = await this.prisma.property.count({
      where: {
        ownerId: BigInt(ownerId),
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
        ownerId: BigInt(ownerId),
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
      message: `${frozenProperties.length} imóvel(is) foram desbloqueados.`,
    };
  }

  /**
   * Freeze tenants exceeding the limit
   * Keeps the most recently created tenants active
   */
  async freezeExcessTenants(agencyId: string, limit: number): Promise<FreezeResult> {
    // If unlimited tenants (9999), nothing to freeze
    if (limit >= 9999) {
      return {
        frozen: 0,
        kept: [],
        message: 'Inquilinos ilimitados no plano',
      };
    }

    // Get all active (non-frozen) tenants for agency
    const activeTenants = await this.prisma.user.findMany({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.INQUILINO,
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      select: { id: true, name: true, email: true, createdAt: true },
    });

    // If within limit, nothing to freeze
    if (activeTenants.length <= limit) {
      return {
        frozen: 0,
        kept: activeTenants.map(t => t.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    // Keep the most recent 'limit' tenants active
    const toKeepActive = activeTenants.slice(0, limit);
    const toFreeze = activeTenants.slice(limit);

    // Freeze excess tenants
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

  /**
   * Freeze tenants for independent owner exceeding the limit
   */
  async freezeExcessTenantsForOwner(ownerId: string, limit: number): Promise<FreezeResult> {
    // If unlimited tenants (9999), nothing to freeze
    if (limit >= 9999) {
      return {
        frozen: 0,
        kept: [],
        message: 'Inquilinos ilimitados no plano',
      };
    }

    // Get all active (non-frozen) tenants created by this owner
    const activeTenants = await this.prisma.user.findMany({
      where: {
        createdBy: BigInt(ownerId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.INQUILINO,
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      select: { id: true, name: true, email: true, createdAt: true },
    });

    // If within limit, nothing to freeze
    if (activeTenants.length <= limit) {
      return {
        frozen: 0,
        kept: activeTenants.map(t => t.id.toString()),
        message: 'Dentro do limite do plano',
      };
    }

    // Keep the most recent 'limit' tenants active
    const toKeepActive = activeTenants.slice(0, limit);
    const toFreeze = activeTenants.slice(limit);

    // Freeze excess tenants
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

  /**
   * Unfreeze tenants up to the new limit
   */
  async unfreezeTenants(agencyId: string, newLimit: number): Promise<UnfreezeResult> {
    // If unlimited tenants (9999), unfreeze all
    const effectiveLimit = newLimit >= 9999 ? 9999 : newLimit;

    // Get current active tenants count
    const activeCount = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.INQUILINO,
      },
    });

    // Calculate how many can be unfrozen
    const canUnfreeze = Math.max(0, effectiveLimit - activeCount);

    if (canUnfreeze === 0 && effectiveLimit < 9999) {
      return {
        unfrozen: 0,
        message: 'Nenhum inquilino para descongelar.',
      };
    }

    // Get frozen tenants, oldest frozen first
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

    // Unfreeze tenants
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

  /**
   * Unfreeze tenants for independent owner up to the new limit
   */
  async unfreezeTenantsForOwner(ownerId: string, newLimit: number): Promise<UnfreezeResult> {
    // If unlimited tenants (9999), unfreeze all
    const effectiveLimit = newLimit >= 9999 ? 9999 : newLimit;

    // Get current active tenants count
    const activeCount = await this.prisma.user.count({
      where: {
        createdBy: BigInt(ownerId),
        isFrozen: false,
        status: 'ACTIVE',
        role: UserRole.INQUILINO,
      },
    });

    // Calculate how many can be unfrozen
    const canUnfreeze = Math.max(0, effectiveLimit - activeCount);

    if (canUnfreeze === 0 && effectiveLimit < 9999) {
      return {
        unfrozen: 0,
        message: 'Nenhum inquilino para descongelar.',
      };
    }

    // Get frozen tenants, oldest frozen first
    const frozenTenants = await this.prisma.user.findMany({
      where: {
        createdBy: BigInt(ownerId),
        isFrozen: true,
        role: UserRole.INQUILINO,
      },
      orderBy: { frozenAt: 'asc' },
      take: effectiveLimit >= 9999 ? undefined : canUnfreeze,
      select: { id: true },
    });

    // Unfreeze tenants
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

  /**
   * Switch which contract is active (for FREE plan with 1 contract limit)
   * Freezes the current active contract and unfreezes the selected one
   */
  async switchActiveContract(agencyId: string, newActiveContractId: string): Promise<SwitchResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agência não encontrada');
    }

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;

    // This operation is mainly for FREE plan or when limit is 1
    if (planConfig.maxActiveContracts > 1) {
      throw new BadRequestException('Esta operação só é disponível para planos com limite de 1 contrato.');
    }

    // Get the contract to activate
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

    // Get the currently active contract
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

    // If the new contract is already active, no change needed
    if (!newActiveContract.isFrozen) {
      return {
        success: false,
        message: 'Este contrato já está ativo.',
      };
    }

    // Freeze the current active contract (if exists)
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

    // Unfreeze the new active contract
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

    // Update frozen count
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

    const planConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;
    const limits = this.getPlanLimitsForAgency(agency.plan);

    // Count contracts
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

    // Count users
    const [activeUsers, frozenUsers, totalUsers] = await Promise.all([
      this.prisma.user.count({
        where: {
          agencyId: BigInt(agencyId),
          isFrozen: false,
          status: 'ACTIVE',
          role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER] },
        },
      }),
      this.prisma.user.count({
        where: { agencyId: BigInt(agencyId), isFrozen: true },
      }),
      this.prisma.user.count({
        where: { agencyId: BigInt(agencyId) },
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
    };
  }

  /**
   * Get list of frozen entities for an agency
   */
  async getFrozenEntitiesList(agencyId: string): Promise<FrozenEntitiesList> {
    // Get frozen contracts
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

  /**
   * Check if a specific contract is frozen
   */
  async isContractFrozen(contractId: string): Promise<boolean> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      select: { isFrozen: true },
    });
    return contract?.isFrozen ?? false;
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
    contractsWouldFreeze: number;
    usersWouldFreeze: number;
    contractsWouldUnfreeze: number;
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

    const currentConfig = getPlanByName(agency.plan) || PLANS_CONFIG.FREE;
    const newConfig = getPlanByName(newPlan) || PLANS_CONFIG.FREE;

    // Count current active entities
    const activeContracts = await this.prisma.contract.count({
      where: {
        agencyId: BigInt(agencyId),
        deleted: false,
        isFrozen: false,
        status: { in: ['ATIVO', 'ACTIVE', 'PENDENTE', 'PENDING'] },
      },
    });

    const activeUsers = await this.prisma.user.count({
      where: {
        agencyId: BigInt(agencyId),
        isFrozen: false,
        status: 'ACTIVE',
        role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER] },
      },
    });

    // Count currently frozen entities
    const frozenContracts = await this.prisma.contract.count({
      where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: true },
    });

    const frozenUsers = await this.prisma.user.count({
      where: { agencyId: BigInt(agencyId), isFrozen: true },
    });

    // Calculate what would happen
    const contractsWouldFreeze = Math.max(0, activeContracts - newConfig.maxActiveContracts);
    const newUserLimit = newConfig.maxInternalUsers === -1 ? 9999 : newConfig.maxInternalUsers;
    const usersWouldFreeze = Math.max(0, activeUsers - newUserLimit);

    const canUnfreezeContracts = Math.max(0, newConfig.maxActiveContracts - activeContracts);
    const contractsWouldUnfreeze = Math.min(canUnfreezeContracts, frozenContracts);

    const canUnfreezeUsers = Math.max(0, newUserLimit - activeUsers);
    const usersWouldUnfreeze = Math.min(canUnfreezeUsers, frozenUsers);

    let warning: string | undefined;
    if (contractsWouldFreeze > 0 || usersWouldFreeze > 0) {
      warning = PLAN_MESSAGES.DOWNGRADE_WARNING
        .replace('{plan}', newConfig.displayName)
        .replace('{freezeCount}', contractsWouldFreeze.toString())
        .replace('{userFreezeCount}', usersWouldFreeze.toString());
    }

    return {
      contractsWouldFreeze,
      usersWouldFreeze,
      contractsWouldUnfreeze,
      usersWouldUnfreeze,
      warning,
    };
  }

  // Private helper methods

  private async countFrozenContracts(agencyId: string): Promise<number> {
    return this.prisma.contract.count({
      where: { agencyId: BigInt(agencyId), deleted: false, isFrozen: true },
    });
  }

  private async countFrozenUsers(agencyId: string): Promise<number> {
    return this.prisma.user.count({
      where: { agencyId: BigInt(agencyId), isFrozen: true },
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
