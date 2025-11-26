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

export const DEFAULT_PLANS: Omit<Plan, 'id' | 'subscribers' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'FREE',
    price: 0,
    propertyLimit: 5,
    userLimit: 3,
    features: ['5 propriedades', '3 usuários', 'Suporte por email'],
    description: 'Plano básico para começar',
    isActive: true,
  },
  {
    name: 'ESSENTIAL',
    price: 99.90,
    propertyLimit: 50,
    userLimit: 10,
    features: ['50 propriedades', '10 usuários', 'Suporte prioritário', 'Relatórios básicos'],
    description: 'Ideal para agências pequenas',
    isActive: true,
  },
  {
    name: 'PROFESSIONAL',
    price: 199.90,
    propertyLimit: 100,
    userLimit: 20,
    features: ['100 propriedades', '20 usuários', 'Suporte prioritário', 'Relatórios avançados', 'API access'],
    description: 'Para agências em crescimento',
    isActive: true,
  },
  {
    name: 'ENTERPRISE',
    price: 499.90,
    propertyLimit: 500,
    userLimit: 100,
    features: ['500 propriedades', '100 usuários', 'Suporte 24/7', 'API access', 'White-label', 'Analytics avançado'],
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

