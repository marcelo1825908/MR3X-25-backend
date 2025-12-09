/**
 * MR3X Subscription Plans Configuration
 *
 * Plan Structure (Contract-Based Limits):
 * - FREE: R$ 0 - 1 active contract, 2 internal users
 * - BASIC: R$ 89.90 - 20 active contracts, 5 internal users
 * - PROFESSIONAL: R$ 189.90 - 60 active contracts, 10 internal users
 * - ENTERPRISE: R$ 449.90 - 200 active contracts, unlimited internal users
 */

export interface PlanConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;

  // Contract-based limits (primary limit)
  maxActiveContracts: number;
  maxInternalUsers: number;

  // Feature flags
  unlimitedInspections: boolean;
  unlimitedSettlements: boolean;
  unlimitedUsers: boolean;
  apiAccessIncluded: boolean;
  apiAccessOptional: boolean;
  advancedReports: boolean;
  automations: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  support24x7: boolean;

  // Pay-per-use pricing (R$)
  extraContractPrice: number;
  inspectionPrice: number | null;
  settlementPrice: number | null;
  screeningPrice: number;
  apiAddOnPrice: number | null;

  // Support tier
  supportTier: 'EMAIL' | 'PRIORITY' | '24X7';

  // Display properties
  features: string[];
  isPopular: boolean;
  displayOrder: number;
}

export interface MicrotransactionPricing {
  extraContract: number;
  inspection: number | null;
  settlement: number | null;
  screening: number;
  extraUser?: number;
  extraProperty?: number;
  apiCall?: number;
}

// Plan names as constants
export const PLAN_NAMES = {
  FREE: 'FREE',
  BASIC: 'BASIC',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
} as const;

export type PlanName = keyof typeof PLAN_NAMES;

// Entity type for plan limits differentiation
export type EntityType = 'agency' | 'independent_owner';

// Plan limits structure for different entity types
export interface PlanLimits {
  contracts: number;
  users: number;
  apiAccess: boolean;
  advancedReports: boolean;
  automations: boolean;
  unlimitedInspections: boolean;
  unlimitedSettlements: boolean;
}

/**
 * Complete plan configuration based on the strategic analysis
 */
export const PLANS_CONFIG: Record<string, PlanConfig> = {
  FREE: {
    id: 'free',
    name: 'FREE',
    displayName: 'Gratuito',
    description: 'Plano gratuito para testar e iniciar - Ideal para onboarding',
    price: 0,

    // Contract-based limits
    maxActiveContracts: 1,
    maxInternalUsers: 2,

    // Features
    unlimitedInspections: false,
    unlimitedSettlements: false,
    unlimitedUsers: false,
    apiAccessIncluded: false,
    apiAccessOptional: false,
    advancedReports: false,
    automations: false,
    whiteLabel: false,
    prioritySupport: false,
    support24x7: false,

    // Pay-per-use pricing (R$)
    extraContractPrice: 4.90,
    inspectionPrice: 3.90,
    settlementPrice: 6.90,
    screeningPrice: 8.90,
    apiAddOnPrice: null, // Not available

    supportTier: 'EMAIL',

    features: [
      '1 contrato ativo',
      '2 usuários internos',
      'Contratos extras: R$ 4,90/cada',
      'Vistorias: R$ 3,90/cada',
      'Acordos: R$ 6,90/cada',
      'Análise de inquilino: R$ 8,90',
      'Suporte por email',
    ],
    isPopular: false,
    displayOrder: 1,
  },

  BASIC: {
    id: 'basic',
    name: 'BASIC',
    displayName: 'Básico',
    description: 'Entrada real para pequenas imobiliárias',
    price: 89.90,

    // Contract-based limits
    maxActiveContracts: 20,
    maxInternalUsers: 5,

    // Features
    unlimitedInspections: true, // Included
    unlimitedSettlements: false,
    unlimitedUsers: false,
    apiAccessIncluded: false,
    apiAccessOptional: false,
    advancedReports: true,
    automations: false,
    whiteLabel: false,
    prioritySupport: true,
    support24x7: false,

    // Pay-per-use pricing (R$)
    extraContractPrice: 2.90,
    inspectionPrice: null, // Unlimited/Included
    settlementPrice: 4.90,
    screeningPrice: 6.90,
    apiAddOnPrice: null, // Not available

    supportTier: 'PRIORITY',

    features: [
      '20 contratos ativos',
      '5 usuários internos',
      'Vistorias ilimitadas',
      'Contratos extras: R$ 2,90/cada',
      'Acordos: R$ 4,90/cada',
      'Análise de inquilino: R$ 6,90',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    isPopular: true,
    displayOrder: 2,
  },

  PROFESSIONAL: {
    id: 'professional',
    name: 'PROFESSIONAL',
    displayName: 'Profissional',
    description: 'Para imobiliárias em expansão',
    price: 189.90,

    // Contract-based limits
    maxActiveContracts: 60,
    maxInternalUsers: 10,

    // Features
    unlimitedInspections: true,
    unlimitedSettlements: true, // Included
    unlimitedUsers: false,
    apiAccessIncluded: false,
    apiAccessOptional: true, // Can add API for R$ 29/month
    advancedReports: true,
    automations: true,
    whiteLabel: false,
    prioritySupport: true,
    support24x7: false,

    // Pay-per-use pricing (R$)
    extraContractPrice: 1.90,
    inspectionPrice: null, // Unlimited/Included
    settlementPrice: null, // Unlimited/Included
    screeningPrice: 4.90,
    apiAddOnPrice: 29.00, // Optional add-on

    supportTier: 'PRIORITY',

    features: [
      '60 contratos ativos',
      '10 usuários internos',
      'Todos os recursos liberados',
      'Vistorias ilimitadas',
      'Acordos ilimitados',
      'Análise de inquilino: R$ 4,90',
      'API opcional: +R$ 29/mês',
      'Automações',
      'Relatórios avançados',
    ],
    isPopular: false,
    displayOrder: 3,
  },

  ENTERPRISE: {
    id: 'enterprise',
    name: 'ENTERPRISE',
    displayName: 'Enterprise',
    description: 'Para grandes imobiliárias - Máximo retorno',
    price: 449.90,

    // Contract-based limits
    maxActiveContracts: 200,
    maxInternalUsers: -1, // Unlimited

    // Features
    unlimitedInspections: true,
    unlimitedSettlements: true,
    unlimitedUsers: true,
    apiAccessIncluded: true,
    apiAccessOptional: false,
    advancedReports: true,
    automations: true,
    whiteLabel: true,
    prioritySupport: true,
    support24x7: true,

    // Pay-per-use pricing (R$)
    extraContractPrice: 0.90, // R$ 0.90 per excess contract
    inspectionPrice: null, // Unlimited/Included
    settlementPrice: null, // Unlimited/Included
    screeningPrice: 3.90,
    apiAddOnPrice: null, // Already included

    supportTier: '24X7',

    features: [
      '200 contratos ativos',
      'Usuários ilimitados',
      'R$ 0,90/contrato excedente',
      'API + automações incluídos',
      'Análise de inquilino: R$ 3,90',
      'Integrações avançadas',
      'White-label',
      'Analytics avançado',
      'Suporte 24/7',
    ],
    isPopular: false,
    displayOrder: 4,
  },
};

/**
 * Get microtransaction pricing for a specific plan
 */
export function getMicrotransactionPricing(planName: string): MicrotransactionPricing {
  const plan = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;

  return {
    extraContract: plan.extraContractPrice,
    inspection: plan.inspectionPrice,
    settlement: plan.settlementPrice,
    screening: plan.screeningPrice,
  };
}

/**
 * Get plan limits for a specific entity type
 * Note: Both agency and independent_owner have the same limits now
 */
export function getPlanLimits(planName: string, entityType: EntityType = 'agency'): PlanLimits {
  const plan = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;

  return {
    contracts: plan.maxActiveContracts,
    users: plan.maxInternalUsers === -1 ? 9999 : plan.maxInternalUsers,
    apiAccess: plan.apiAccessIncluded || plan.apiAccessOptional,
    advancedReports: plan.advancedReports,
    automations: plan.automations,
    unlimitedInspections: plan.unlimitedInspections,
    unlimitedSettlements: plan.unlimitedSettlements,
  };
}

// Legacy alias for backward compatibility
export const getPlanLimitsForEntity = getPlanLimits;

/**
 * Plan limits by entity type - for backward compatibility
 * Now both types have the same limits
 */
export const PLAN_LIMITS: Record<string, Record<EntityType, PlanLimits>> = {
  FREE: {
    agency: getPlanLimits('FREE', 'agency'),
    independent_owner: getPlanLimits('FREE', 'independent_owner'),
  },
  BASIC: {
    agency: getPlanLimits('BASIC', 'agency'),
    independent_owner: getPlanLimits('BASIC', 'independent_owner'),
  },
  PROFESSIONAL: {
    agency: getPlanLimits('PROFESSIONAL', 'agency'),
    independent_owner: getPlanLimits('PROFESSIONAL', 'independent_owner'),
  },
  ENTERPRISE: {
    agency: getPlanLimits('ENTERPRISE', 'agency'),
    independent_owner: getPlanLimits('ENTERPRISE', 'independent_owner'),
  },
};

/**
 * Check if a feature is available for a plan
 */
export function isPlanFeatureAvailable(
  planName: string,
  feature: 'inspections' | 'settlements' | 'api' | 'advancedReports' | 'automations' | 'whiteLabel'
): boolean {
  const plan = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;

  switch (feature) {
    case 'inspections':
      return plan.unlimitedInspections;
    case 'settlements':
      return plan.unlimitedSettlements;
    case 'api':
      return plan.apiAccessIncluded || plan.apiAccessOptional;
    case 'advancedReports':
      return plan.advancedReports;
    case 'automations':
      return plan.automations;
    case 'whiteLabel':
      return plan.whiteLabel;
    default:
      return false;
  }
}

/**
 * Check if a feature requires payment (pay-per-use)
 */
export function isFeaturePayPerUse(
  planName: string,
  feature: 'inspection' | 'settlement' | 'screening' | 'extraContract'
): boolean {
  const plan = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;

  switch (feature) {
    case 'inspection':
      return plan.inspectionPrice !== null;
    case 'settlement':
      return plan.settlementPrice !== null;
    case 'screening':
      return true; // Always pay-per-use
    case 'extraContract':
      return true; // Always pay-per-use
    default:
      return true;
  }
}

/**
 * Get the price for a specific feature
 */
export function getFeaturePrice(
  planName: string,
  feature: 'inspection' | 'settlement' | 'screening' | 'extraContract' | 'apiAddOn'
): number | null {
  const plan = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;

  switch (feature) {
    case 'inspection':
      return plan.inspectionPrice;
    case 'settlement':
      return plan.settlementPrice;
    case 'screening':
      return plan.screeningPrice;
    case 'extraContract':
      return plan.extraContractPrice;
    case 'apiAddOn':
      return plan.apiAddOnPrice;
    default:
      return null;
  }
}

/**
 * Get all plans for display (sorted by displayOrder)
 */
export function getAllPlansForDisplay(): PlanConfig[] {
  return Object.values(PLANS_CONFIG).sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Get plan by name
 */
export function getPlanByName(planName: string): PlanConfig | null {
  return PLANS_CONFIG[planName] || null;
}

/**
 * Calculate upgrade cost between plans
 */
export function calculateUpgradeCost(
  currentPlan: string,
  targetPlan: string,
  daysRemaining: number = 30
): { proratedAmount: number; newMonthlyPrice: number } {
  const current = PLANS_CONFIG[currentPlan] || PLANS_CONFIG.FREE;
  const target = PLANS_CONFIG[targetPlan];

  if (!target) {
    throw new Error(`Invalid target plan: ${targetPlan}`);
  }

  const priceDifference = target.price - current.price;
  const proratedAmount = (priceDifference * daysRemaining) / 30;

  return {
    proratedAmount: Math.max(0, proratedAmount),
    newMonthlyPrice: target.price,
  };
}

// Legacy interfaces for backward compatibility
export interface Plan {
  id: string;
  name: string;
  price: number;
  propertyLimit: number;
  userLimit: number;
  features: string[];
  description: string;
  isActive: boolean;
  subscribers: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Convert PlanConfig to legacy Plan format
 */
export function toLegacyPlan(config: PlanConfig): Omit<Plan, 'subscribers' | 'createdAt' | 'updatedAt'> {
  return {
    id: config.id,
    name: config.name,
    price: config.price,
    propertyLimit: config.maxActiveContracts, // Now represents contracts
    userLimit: config.maxInternalUsers === -1 ? 9999 : config.maxInternalUsers,
    features: config.features,
    description: config.description,
    isActive: true,
  };
}

// Export default plans in legacy format for backward compatibility
export const DEFAULT_PLANS = Object.values(PLANS_CONFIG).map(toLegacyPlan);

// In-memory storage for plan updates (if needed for dynamic pricing)
const planUpdates = new Map<string, Partial<PlanConfig>>();

export function getPlanUpdates(): Map<string, Partial<PlanConfig>> {
  return planUpdates;
}

export function setPlanUpdate(planName: string, update: Partial<PlanConfig>): void {
  const existing = planUpdates.get(planName) || {};
  planUpdates.set(planName, { ...existing, ...update });
}
