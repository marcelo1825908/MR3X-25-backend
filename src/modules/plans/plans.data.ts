export interface PlanConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;

  maxActiveContracts: number;
  maxInternalUsers: number;

  maxProperties: number;
  maxTenants: number;

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

  extraContractPrice: number;
  inspectionPrice: number | null;
  settlementPrice: number | null;
  screeningPrice: number;
  apiAddOnPrice: number | null;

  // Free usage limits per billing period (charges apply after exceeding)
  freeInspections: number;
  freeSearches: number;
  freeSettlements: number;
  freeApiCalls: number;

  supportTier: 'EMAIL' | 'PRIORITY' | '24X7';

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

export const PLAN_NAMES = {
  FREE: 'FREE',
  BASIC: 'BASIC',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
} as const;

export type PlanName = keyof typeof PLAN_NAMES;

export type EntityType = 'agency' | 'independent_owner';

export interface PlanLimits {
  contracts: number;
  users: number;
  properties: number;
  tenants: number;
  apiAccess: boolean;
  advancedReports: boolean;
  automations: boolean;
  unlimitedInspections: boolean;
  unlimitedSettlements: boolean;
}

export const PLANS_CONFIG: Record<string, PlanConfig> = {
  FREE: {
    id: 'free',
    name: 'FREE',
    displayName: 'Gratuito',
    description: 'Plano gratuito para testar e iniciar - Ideal para onboarding',
    price: 0,

    maxActiveContracts: 1,
    maxInternalUsers: 2,

    maxProperties: 1,
    maxTenants: 2,

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

    extraContractPrice: 4.90,
    inspectionPrice: 3.90,
    settlementPrice: 6.90,
    screeningPrice: 8.90,
    apiAddOnPrice: null,

    // Free usage limits
    freeInspections: 2,
    freeSearches: 5,
    freeSettlements: 1,
    freeApiCalls: 0,

    supportTier: 'EMAIL',

    features: [
      '1 contrato ativo',
      '2 usuários',
      '2 vistorias gratuitas/mês',
      '5 análises gratuitas/mês',
      '1 acordo gratuito/mês',
      'Contratos extras: R$ 4,90/cada',
      'Vistorias extras: R$ 3,90/cada',
      'Acordos extras: R$ 6,90/cada',
      'Análise extra: R$ 8,90/cada',
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

    maxActiveContracts: 20,
    maxInternalUsers: 5,

    maxProperties: 20,
    maxTenants: 5,

    unlimitedInspections: true,
    unlimitedSettlements: false,
    unlimitedUsers: false,
    apiAccessIncluded: false,
    apiAccessOptional: false,
    advancedReports: true,
    automations: false,
    whiteLabel: false,
    prioritySupport: true,
    support24x7: false,

    extraContractPrice: 2.90,
    inspectionPrice: null,
    settlementPrice: 4.90,
    screeningPrice: 6.90,
    apiAddOnPrice: null,

    // Free usage limits (inspections unlimited)
    freeInspections: -1, // unlimited
    freeSearches: 10,
    freeSettlements: 5,
    freeApiCalls: 0,

    supportTier: 'PRIORITY',

    features: [
      '20 contratos ativos',
      '5 usuários',
      'Vistorias ilimitadas',
      '10 análises gratuitas/mês',
      '5 acordos gratuitos/mês',
      'Contratos extras: R$ 2,90/cada',
      'Acordos extras: R$ 4,90/cada',
      'Análise extra: R$ 6,90/cada',
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

    maxActiveContracts: 60,
    maxInternalUsers: 10,

    maxProperties: 60,
    maxTenants: 10,

    unlimitedInspections: true,
    unlimitedSettlements: true,
    unlimitedUsers: false,
    apiAccessIncluded: false,
    apiAccessOptional: true,
    advancedReports: true,
    automations: true,
    whiteLabel: false,
    prioritySupport: true,
    support24x7: false,

    extraContractPrice: 1.90,
    inspectionPrice: null,
    settlementPrice: null,
    screeningPrice: 4.90,
    apiAddOnPrice: 29.00,

    // Free usage limits (inspections and settlements unlimited)
    freeInspections: -1, // unlimited
    freeSearches: 20,
    freeSettlements: -1, // unlimited
    freeApiCalls: 100,

    supportTier: 'PRIORITY',

    features: [
      '60 contratos ativos',
      '10 usuários',
      'Vistorias ilimitadas',
      'Acordos ilimitados',
      '20 análises gratuitas/mês',
      '100 chamadas API gratuitas/mês',
      'Análise extra: R$ 4,90/cada',
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

    maxActiveContracts: 200,
    maxInternalUsers: -1,

    maxProperties: 200,
    maxTenants: 9999,

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

    extraContractPrice: 0.90,
    inspectionPrice: null,
    settlementPrice: null,
    screeningPrice: 3.90,
    apiAddOnPrice: null,

    // Free usage limits (all unlimited except searches)
    freeInspections: -1, // unlimited
    freeSearches: 50,
    freeSettlements: -1, // unlimited
    freeApiCalls: -1, // unlimited

    supportTier: '24X7',

    features: [
      '200 contratos ativos',
      'Usuários ilimitados',
      'Vistorias ilimitadas',
      'Acordos ilimitados',
      '50 análises gratuitas/mês',
      'API ilimitada incluída',
      'Análise extra: R$ 3,90/cada',
      'R$ 0,90/contrato excedente',
      'Integrações avançadas',
      'White-label',
      'Analytics avançado',
      'Suporte 24/7',
    ],
    isPopular: false,
    displayOrder: 4,
  },
};

export interface FreeUsageLimits {
  freeInspections: number;
  freeSearches: number;
  freeSettlements: number;
  freeApiCalls: number;
}

export function getMicrotransactionPricing(planName: string): MicrotransactionPricing {
  const plan = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;

  return {
    extraContract: plan.extraContractPrice,
    inspection: plan.inspectionPrice,
    settlement: plan.settlementPrice,
    screening: plan.screeningPrice,
  };
}

export function getFreeUsageLimits(planName: string): FreeUsageLimits {
  const plan = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;

  return {
    freeInspections: plan.freeInspections,
    freeSearches: plan.freeSearches,
    freeSettlements: plan.freeSettlements,
    freeApiCalls: plan.freeApiCalls,
  };
}

export function isWithinFreeLimit(
  planName: string,
  feature: 'inspections' | 'searches' | 'settlements' | 'apiCalls',
  currentUsage: number
): boolean {
  const limits = getFreeUsageLimits(planName);

  switch (feature) {
    case 'inspections':
      return limits.freeInspections === -1 || currentUsage < limits.freeInspections;
    case 'searches':
      return limits.freeSearches === -1 || currentUsage < limits.freeSearches;
    case 'settlements':
      return limits.freeSettlements === -1 || currentUsage < limits.freeSettlements;
    case 'apiCalls':
      return limits.freeApiCalls === -1 || currentUsage < limits.freeApiCalls;
    default:
      return false;
  }
}

export function getPlanLimits(planName: string, entityType: EntityType = 'agency'): PlanLimits {
  const plan = PLANS_CONFIG[planName] || PLANS_CONFIG.FREE;

  return {
    contracts: plan.maxActiveContracts,
    users: plan.maxInternalUsers === -1 ? 9999 : plan.maxInternalUsers,
    properties: plan.maxProperties,
    tenants: plan.maxTenants,
    apiAccess: plan.apiAccessIncluded || plan.apiAccessOptional,
    advancedReports: plan.advancedReports,
    automations: plan.automations,
    unlimitedInspections: plan.unlimitedInspections,
    unlimitedSettlements: plan.unlimitedSettlements,
  };
}

export const getPlanLimitsForEntity = getPlanLimits;

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
      return true;
    case 'extraContract':
      return true;
    default:
      return true;
  }
}

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

export function getAllPlansForDisplay(): PlanConfig[] {
  return Object.values(PLANS_CONFIG).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getPlanByName(planName: string): PlanConfig | null {
  return PLANS_CONFIG[planName] || null;
}

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

export function toLegacyPlan(config: PlanConfig): Omit<Plan, 'subscribers' | 'createdAt' | 'updatedAt'> {
  return {
    id: config.id,
    name: config.name,
    price: config.price,
    propertyLimit: config.maxActiveContracts,
    userLimit: config.maxInternalUsers === -1 ? 9999 : config.maxInternalUsers,
    features: config.features,
    description: config.description,
    isActive: true,
  };
}

export const DEFAULT_PLANS = Object.values(PLANS_CONFIG).map(toLegacyPlan);

const planUpdates = new Map<string, Partial<PlanConfig>>();

export function getPlanUpdates(): Map<string, Partial<PlanConfig>> {
  return planUpdates;
}

export function setPlanUpdate(planName: string, update: Partial<PlanConfig>): void {
  const existing = planUpdates.get(planName) || {};
  planUpdates.set(planName, { ...existing, ...update });
}
