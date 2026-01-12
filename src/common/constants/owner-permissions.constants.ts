import { UserRole } from '@prisma/client';

export enum OwnerAccessLevel {
  NONE = 'none',
  VIEW_ONLY = 'view_only',
  FULL = 'full',
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

export const PROPRIETARIO_PERMISSIONS: Record<string, ModulePermission> = {
  dashboard: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Proprietário pode visualizar o dashboard de seus imóveis',
  },

  properties: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Proprietário pode visualizar seus imóveis, mas alterações são feitas pela imobiliária',
  },

  tenant_analysis: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Análise de inquilinos é realizada pela imobiliária',
  },

  payments: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
    message: 'Pagamentos são gerenciados pela imobiliária',
  },

  invoices: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
    message: 'Faturas são gerenciadas pela imobiliária',
  },

  contracts: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.SIGN],
    message: 'Proprietário pode visualizar e assinar contratos de aluguel onde é parte',
  },

  service_contracts: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.SIGN],
    message: 'Proprietário assina apenas o contrato de prestação de serviços com a imobiliária',
  },

  inspections: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Vistorias são realizadas pela imobiliária',
  },

  agreements: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.SIGN],
    message: 'Proprietário pode visualizar e assinar acordos onde é parte',
  },

  reports: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
    message: 'Proprietário pode visualizar e exportar relatórios de seus imóveis',
  },

  notifications: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW],
    message: 'Proprietário recebe notificações sobre seus imóveis',
  },

  chat: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.CREATE],
    message: 'Proprietário pode se comunicar com a imobiliária',
  },

  profile: {
    accessLevel: OwnerAccessLevel.FULL,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EDIT],
    message: 'Proprietário pode gerenciar seu perfil',
  },

  documents: {
    accessLevel: OwnerAccessLevel.VIEW_ONLY,
    allowedActions: [OwnerAction.VIEW, OwnerAction.EXPORT],
    message: 'Proprietário pode visualizar documentos de seus imóveis',
  },
};

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

export function getOwnerPermissions(role: UserRole, module: string): ModulePermission | null {
  if (role === UserRole.PROPRIETARIO) {
    return PROPRIETARIO_PERMISSIONS[module] || null;
  }
  if (role === UserRole.INDEPENDENT_OWNER) {
    return INDEPENDENT_OWNER_PERMISSIONS[module] || null;
  }
  return null;
}

export function canOwnerPerformAction(
  role: UserRole,
  module: string,
  action: OwnerAction,
): { allowed: boolean; message?: string } {
  const permissions = getOwnerPermissions(role, module);

  if (!permissions) {
    return { allowed: true };
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

export function isAgencyManagedOwner(role: UserRole): boolean {
  return role === UserRole.PROPRIETARIO;
}

export function isIndependentOwner(role: UserRole): boolean {
  return role === UserRole.INDEPENDENT_OWNER;
}

export function isOwner(role: UserRole): boolean {
  return role === UserRole.PROPRIETARIO || role === UserRole.INDEPENDENT_OWNER;
}

export const AGENCY_REPRESENTATIVE_ROLES = [
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_MANAGER,
  UserRole.BROKER,
];

export function canActOnBehalfOfOwner(role: UserRole): boolean {
  return (AGENCY_REPRESENTATIVE_ROLES as readonly UserRole[]).includes(role);
}
