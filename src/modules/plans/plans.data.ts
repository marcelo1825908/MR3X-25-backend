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

// Entity type for plan limits differentiation
export type EntityType = 'agency' | 'independent_owner';

// Plan limits structure for different entity types
export interface PlanLimits {
  properties: number;
  users: number;
  apiAccess: boolean;
  advancedReports: boolean;
  automations: boolean;
}

// Plan limits by entity type - INDEPENDENT_OWNER has SAME limits as AGENCY (Director)
export const PLAN_LIMITS: Record<string, Record<EntityType, PlanLimits>> = {
  FREE: {
    agency: {
      properties: 1,      // Agencies on FREE get only 1 active property
      users: 5,           // Agencies on FREE get 5 users
      apiAccess: false,
      advancedReports: false,
      automations: false,
    },
    independent_owner: {
      properties: 1,      // Same as agency - 1 active property
      users: 5,           // Same as agency - 5 users (tenants)
      apiAccess: false,
      advancedReports: false,
      automations: false,
    },
  },
  ESSENTIAL: {
    agency: {
      properties: 50,
      users: 10,
      apiAccess: false,
      advancedReports: true,
      automations: false,
    },
    independent_owner: {
      properties: 50,
      users: 10,
      apiAccess: false,
      advancedReports: true,
      automations: false,
    },
  },
  PROFESSIONAL: {
    agency: {
      properties: 100,
      users: 20,
      apiAccess: true,
      advancedReports: true,
      automations: true,
    },
    independent_owner: {
      properties: 100,
      users: 20,
      apiAccess: true,
      advancedReports: true,
      automations: true,
    },
  },
  ENTERPRISE: {
    agency: {
      properties: 500,
      users: 100,
      apiAccess: true,
      advancedReports: true,
      automations: true,
    },
    independent_owner: {
      properties: 500,
      users: 100,
      apiAccess: true,
      advancedReports: true,
      automations: true,
    },
  },
};

// Helper function to get plan limits for a specific entity type
export function getPlanLimitsForEntity(planName: string, entityType: EntityType): PlanLimits {
  const planLimits = PLAN_LIMITS[planName] || PLAN_LIMITS['FREE'];
  return planLimits[entityType] || planLimits['agency'];
}

// Default plans for backward compatibility (uses agency limits as default display)
export const DEFAULT_PLANS: Omit<Plan, 'id' | 'subscribers' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'FREE',
    price: 0,
    propertyLimit: 1,     // Display agency limit (1 property)
    userLimit: 5,         // Display agency limit (5 users)
    features: ['1 imóvel ativo', '5 usuários', 'Suporte por email', 'Visualização de dados históricos'],
    description: 'Plano gratuito para começar - Imóveis extras são congelados, não excluídos',
    isActive: true,
  },
  {
    name: 'ESSENTIAL',
    price: 99.90,
    propertyLimit: 50,
    userLimit: 10,
    features: ['50 imóveis', '10 usuários', 'Suporte prioritário', 'Relatórios básicos'],
    description: 'Ideal para agências pequenas',
    isActive: true,
  },
  {
    name: 'PROFESSIONAL',
    price: 199.90,
    propertyLimit: 100,
    userLimit: 20,
    features: ['100 imóveis', '20 usuários', 'Suporte prioritário', 'Relatórios avançados', 'API access', 'Automações'],
    description: 'Para agências em crescimento',
    isActive: true,
  },
  {
    name: 'ENTERPRISE',
    price: 499.90,
    propertyLimit: 500,
    userLimit: 100,
    features: ['500 imóveis', '100 usuários', 'Suporte 24/7', 'API access', 'White-label', 'Analytics avançado', 'Automações ilimitadas'],
    description: 'Para grandes agências e empresas',
    isActive: true,
  },
];

// In-memory storage for plan updates
const planUpdates = new Map<string, Partial<Plan>>();

export function getPlanUpdates(): Map<string, Partial<Plan>> {
  return planUpdates;
}

export function setPlanUpdate(planName: string, update: Partial<Plan>): void {
  const existing = planUpdates.get(planName) || {};
  planUpdates.set(planName, { ...existing, ...update });
}

