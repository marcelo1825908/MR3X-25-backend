import { UserRole } from '@prisma/client';

/**
 * Owner Permission Constants
 *
 * PROPRIETARIO (Owner linked to agency):
 * - Has READ-ONLY access to most modules
 * - Cannot sign rental contracts (agency represents them)
 * - Cannot edit/create/delete tenant analysis, payments, inspections, agreements
 * - Can ONLY sign service contracts with the agency
 *
 * INDEPENDENT_OWNER (Owner without agency):
 * - Has FULL control over their properties
 * - Can perform all operations
 */

export enum OwnerAccessLevel {
  NONE = 'none',           // No access at all
  VIEW_ONLY = 'view_only', // Can only view, no modifications
  FULL = 'full',           // Full CRUD access
}

export enum OwnerAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  SIGN = 'sign',
  APPROVE = 'approve',
  EXPORT = 'export',
}

export interface ModulePermission {
  accessLevel: OwnerAccessLevel;
  allowedActions: OwnerAction[];
  message?: string;
}

/**
 * Permission matrix for PROPRIETARIO (agency-managed owner)
 * Key principle: Owner views, Agency acts on their behalf
 */
export const PROPRIETARIO_PERMISSIONS: Record<string, ModulePermission> = {
  // Dashboard - can view their property metrics
  dashboard: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Proprietário pode visualizar o dashboard de seus imóveis',
  },

  // Properties - can view their properties
  properties: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Proprietário pode visualizar seus imóveis, mas alterações são feitas pela imobiliária',
  },

  // Tenant Analysis - READ ONLY
  tenant_analysis: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Análise de inquilinos é realizada pela imobiliária',
  },

  // Payments - READ ONLY (can view, but agency collects)
  payments: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
    message: 'Pagamentos são gerenciados pela imobiliária',
  },

  // Invoices - READ ONLY
  invoices: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
    message: 'Faturas são gerenciadas pela imobiliária',
  },

  // Contracts (Rental) - READ ONLY, CANNOT SIGN
  contracts: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Contratos de aluguel são assinados pela imobiliária em nome do proprietário',
  },

  // Service Contracts (Agency-Owner) - CAN VIEW AND SIGN
  service_contracts: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.SIGN],
    message: 'Proprietário assina apenas o contrato de prestação de serviços com a imobiliária',
  },

  // Inspections - READ ONLY
  inspections: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Vistorias são realizadas pela imobiliária',
  },

  // Agreements - READ ONLY
  agreements: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Acordos são gerenciados pela imobiliária',
  },

  // Reports - can view reports about their properties
  reports: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
    message: 'Proprietário pode visualizar e exportar relatórios de seus imóveis',
  },

  // Notifications - can view
  notifications: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Proprietário recebe notificações sobre seus imóveis',
  },

  // Chat - can communicate with agency
  chat: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE],
    message: 'Proprietário pode se comunicar com a imobiliária',
  },

  // Profile - can manage their own profile
  profile: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EDIT],
    message: 'Proprietário pode gerenciar seu perfil',
  },

  // Documents - can view documents related to their properties
  documents: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
    message: 'Proprietário pode visualizar documentos de seus imóveis',
  },
};

/**
 * Permission matrix for INDEPENDENT_OWNER (self-managed owner)
 * Full control - they manage their own properties without agency
 */
export const INDEPENDENT_OWNER_PERMISSIONS: Record<string, ModulePermission> = {
  dashboard: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW],
  },
  properties: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE, OwnerAction.EDIT, OwnerAction.DELETE],
  },
  tenant_analysis: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE],
  },
  payments: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE, OwnerAction.EDIT, OwnerAction.DELETE, OwnerAction.EXPORT],
  },
  invoices: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE, OwnerAction.EDIT, OwnerAction.DELETE, OwnerAction.EXPORT],
  },
  contracts: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE, OwnerAction.EDIT, OwnerAction.DELETE, OwnerAction.SIGN],
  },
  inspections: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE, OwnerAction.EDIT, OwnerAction.DELETE, OwnerAction.SIGN],
  },
  agreements: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE, OwnerAction.EDIT, OwnerAction.DELETE, OwnerAction.SIGN, OwnerAction.APPROVE],
  },
  reports: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
  },
  notifications: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE],
  },
  chat: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE],
  },
  profile: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EDIT],
  },
  documents: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE, OwnerAction.DELETE, OwnerAction.EXPORT],
  },
};

/**
 * Get permissions for a user role and module
 */
export function getOwnerPermissions(role: UserRole, module: string): ModulePermission | null {
  if (role === UserRole.PROPRIETARIO) {
    return PROPRIETARIO_PERMISSIONS[module] || null;
  }
  if (role === UserRole.INDEPENDENT_OWNER) {
    return INDEPENDENT_OWNER_PERMISSIONS[module] || null;
  }
  return null;
}

/**
 * Check if an owner role can perform a specific action on a module
 */
export function canOwnerPerformAction(
  role: UserRole,
  module: string,
  action: OwnerAction,
): { allowed: boolean; message?: string } {
  const permissions = getOwnerPermissions(role, module);

  if (!permissions) {
    return { allowed: true }; // Not an owner role, let other guards handle
  }

  if (permissions.accessLevel === OwnerAccessLevel.NONE) {
    return {
      allowed: false,
      message: permissions.message || `Acesso negado ao módulo ${module}`,
    };
  }

  if (!permissions.allowedActions.includes(action)) {
    return {
      allowed: false,
      message: permissions.message || `Ação '${action}' não permitida para proprietário no módulo ${module}`,
    };
  }

  return { allowed: true };
}

/**
 * Check if user is an agency-managed owner (PROPRIETARIO)
 */
export function isAgencyManagedOwner(role: UserRole): boolean {
  return role === UserRole.PROPRIETARIO;
}

/**
 * Check if user is an independent owner
 */
export function isIndependentOwner(role: UserRole): boolean {
  return role === UserRole.INDEPENDENT_OWNER;
}

/**
 * Check if user is any type of owner
 */
export function isOwner(role: UserRole): boolean {
  return role === UserRole.PROPRIETARIO || role === UserRole.INDEPENDENT_OWNER;
}

/**
 * Roles that can act on behalf of agency-managed owners
 */
export const AGENCY_REPRESENTATIVE_ROLES = [
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_MANAGER,
  UserRole.BROKER,
];

/**
 * Check if a role can act on behalf of owners in an agency
 */
export function canActOnBehalfOfOwner(role: UserRole): boolean {
  return AGENCY_REPRESENTATIVE_ROLES.includes(role);
}
