import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

// Define permissions for each role
export const ROLE_PERMISSIONS = {
  [UserRole.CEO]: [
    'dashboard:read',
    'users:read', 'users:create', 'users:update', 'users:delete',
    'companies:read', 'companies:create', 'companies:update', 'companies:delete',
    'agencies:read', 'agencies:create', 'agencies:update', 'agencies:delete',
    'properties:read', 'properties:create', 'properties:update', 'properties:delete',
    'contracts:read', 'contracts:create', 'contracts:update', 'contracts:delete',
    'payments:read', 'payments:create', 'payments:update', 'payments:delete',
    'reports:read', 'reports:create', 'reports:export',
    'chat:read', 'chat:create', 'chat:update', 'chat:delete',
    'notifications:read', 'notifications:create', 'notifications:update', 'notifications:delete',
    'audit:read', 'audit:create',
    'documents:read', 'documents:create',
    'settings:read', 'settings:update',
    'billing:read', 'billing:update',
    'integrations:read', 'integrations:create', 'integrations:update', 'integrations:delete',
  ],
  [UserRole.ADMIN]: [
    'dashboard:read',
    'users:read', 'users:create', 'users:update', 'users:delete',
    'companies:read', 'companies:create', 'companies:update', 'companies:delete',
    'agencies:read', 'agencies:create', 'agencies:update', 'agencies:delete',
    'properties:read', 'properties:create', 'properties:update', 'properties:delete',
    'contracts:read', 'contracts:create', 'contracts:update', 'contracts:delete',
    'payments:read', 'payments:create', 'payments:update', 'payments:delete',
    'reports:read', 'reports:create', 'reports:export',
    'chat:read', 'chat:create', 'chat:update', 'chat:delete',
    'notifications:read', 'notifications:create', 'notifications:update', 'notifications:delete',
    'audit:read', 'audit:create',
    'documents:read', 'documents:create',
    'settings:read', 'settings:update',
    'billing:read', 'billing:update',
    'integrations:read', 'integrations:create', 'integrations:update', 'integrations:delete',
  ],
  [UserRole.AGENCY_ADMIN]: [
    'dashboard:read',
    'users:read', 'users:create', 'users:update', 'users:delete', // Can manage all agency users (managers, brokers)
    'companies:read', 'companies:update', // Can update their agency settings
    'agencies:read', 'agencies:update', // Can view and update their own agency
    'properties:read', 'properties:create', 'properties:update', 'properties:delete', // Full agency portfolio visibility
    'contracts:read', 'contracts:create', 'contracts:update', 'contracts:delete', 'contracts:approve',
    'payments:read', 'payments:create', 'payments:update', 'payments:delete', 'payments:approve',
    'reports:read', 'reports:create', 'reports:export', // Agency-wide reports and KPIs
    'chat:read', 'chat:create', 'chat:update', 'chat:delete',
    'notifications:read', 'notifications:create', 'notifications:update', 'notifications:delete',
    'audit:read', // Can view agency audit logs
    'documents:read', 'documents:create',
    'settings:read', 'settings:update', // Agency settings (commissions, plans, integrations)
    'billing:read', 'billing:update', // Agency billing and payouts
    'integrations:read', 'integrations:update', // Agency integrations (Asaas, ZapSign, etc.)
    'legal:read', 'legal:create', 'legal:approve', // Legal actions and escalations
  ],
  [UserRole.AGENCY_MANAGER]: [
    'dashboard:read',
    'users:read', 'users:create', 'users:update',
    'companies:read', 'companies:update',
    'properties:read', 'properties:create', 'properties:update', 'properties:delete',
    'contracts:read', 'contracts:create', 'contracts:update', 'contracts:delete',
    'payments:read', 'payments:create', 'payments:update', 'payments:delete',
    'reports:read', 'reports:create', 'reports:export',
    'chat:read', 'chat:create', 'chat:update',
    'notifications:read', 'notifications:create', 'notifications:update',
    'audit:read',
    'settings:read',
  ],
  [UserRole.PROPRIETARIO]: [
    'dashboard:read',
    'users:read', 'users:create', 'users:update',
    'properties:read', 'properties:create', 'properties:update', 'properties:delete',
    'contracts:read', 'contracts:create', 'contracts:update', 'contracts:delete',
    'payments:read', 'payments:create', 'payments:update', 'payments:delete',
    'reports:read', 'reports:export',
    'chat:read', 'chat:create', 'chat:update',
    'notifications:read', 'notifications:create', 'notifications:update',
    'settings:read', 'settings:update',
  ],
  [UserRole.INDEPENDENT_OWNER]: [
    'dashboard:read',
    'users:read', 'users:create', 'users:update', 'users:delete', // Can manage tenants
    'properties:read', 'properties:create', 'properties:update', 'properties:delete', // Full property management
    'contracts:read', 'contracts:create', 'contracts:update', 'contracts:delete', // Full contract management with digital signatures
    'payments:read', 'payments:create', 'payments:update', 'payments:delete', 'payments:approve', // Full payment control
    'reports:read', 'reports:create', 'reports:export', // Full reporting (Excel/XML)
    'chat:read', 'chat:create', 'chat:update', 'chat:delete',
    'notifications:read', 'notifications:create', 'notifications:update', 'notifications:delete',
    'documents:read', 'documents:create', // Receipts, invoices, XML generation
    'settings:read', 'settings:update', // Payment split configuration (MR3X + owner)
    'integrations:read', 'integrations:update', // Zapsign, payment gateways
  ],
  [UserRole.BROKER]: [
    'dashboard:read',
    'users:read',
    'properties:read', 'properties:create', 'properties:update',
    'contracts:read', 'contracts:create', 'contracts:update',
    'payments:read', 'payments:create',
    'reports:read',
    'chat:read', 'chat:create', 'chat:update',
    'notifications:read', 'notifications:create',
  ],
  [UserRole.INQUILINO]: [
    'dashboard:read',
    'properties:read',
    'contracts:read',
    'payments:read', 'payments:create',
    'reports:read',
    'chat:read', 'chat:create',
    'notifications:read',
    'settings:read', 'settings:update',
  ],
  [UserRole.LEGAL_AUDITOR]: [
    'dashboard:read',
    'users:read',
    'companies:read',
    'properties:read',
    'contracts:read',
    'payments:read',
    'reports:read', 'reports:export',
    'audit:read',
  ],
  [UserRole.BUILDING_MANAGER]: [
    'dashboard:read',
    'users:read',
    'properties:read', 'properties:create', 'properties:update',
    'contracts:read', 'contracts:create', 'contracts:update',
    'payments:read', 'payments:create',
    'reports:read',
    'chat:read', 'chat:create',
    'notifications:read', 'notifications:create',
  ],
  [UserRole.REPRESENTATIVE]: [
    'dashboard:read',
    'properties:read',
    'contracts:read',
    'payments:read',
    'reports:read',
    'chat:read', 'chat:create',
    'notifications:read',
  ],
  [UserRole.API_CLIENT]: [
    'properties:read',
    'contracts:read',
    'payments:read',
    'reports:read',
  ],
};

// Role hierarchy (higher roles inherit permissions from lower roles)
export const ROLE_HIERARCHY = {
  [UserRole.CEO]: 10,
  [UserRole.ADMIN]: 9,
  [UserRole.AGENCY_ADMIN]: 8,
  [UserRole.AGENCY_MANAGER]: 7,
  [UserRole.BROKER]: 6,
  [UserRole.PROPRIETARIO]: 5,
  [UserRole.INQUILINO]: 4,
  [UserRole.BUILDING_MANAGER]: 3,
  [UserRole.LEGAL_AUDITOR]: 2,
  [UserRole.REPRESENTATIVE]: 1,
  [UserRole.API_CLIENT]: 0,
};

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
    plan?: string;
    companyId?: string;
    ownerId?: string;
    agencyId?: string;
    brokerId?: string;
  };
}

// Middleware to check if user has required permission
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permission,
        userRole: userRole
      });
    }

    next();
  };
};

// Middleware to check if user has any of the required permissions
export const requireAnyPermission = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permissions,
        userRole: userRole
      });
    }

    next();
  };
};

// Middleware to check if user has required role or higher
export const requireRole = (requiredRole: UserRole) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({ 
        message: 'Insufficient role level',
        required: requiredRole,
        userRole: userRole
      });
    }

    next();
  };
};

// Middleware to check if user has any of the required roles
export const requireAnyRole = (requiredRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;

    if (!requiredRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: 'Insufficient role',
        required: requiredRoles,
        userRole: userRole
      });
    }

    next();
  };
};

// Middleware to check if user owns the resource or has admin access
export const requireOwnershipOrAdmin = (resourceOwnerField: string = 'ownerId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const userId = req.user.userId;

    // Admin roles can access any resource
    if (userRole === UserRole.CEO || userRole === UserRole.ADMIN || userRole === UserRole.AGENCY_MANAGER) {
      return next();
    }

    // Check if user owns the resource
    const resourceOwnerId = req.params[resourceOwnerField] || req.body[resourceOwnerField];
    
    if (resourceOwnerId && resourceOwnerId === userId) {
      return next();
    }

    return res.status(403).json({ 
      message: 'Access denied: You can only access your own resources',
      userRole: userRole
    });
  };
};

// Helper function to get user permissions
export const getUserPermissions = (role: UserRole): string[] => {
  return ROLE_PERMISSIONS[role] || [];
};

// Helper function to check if user has permission
export const hasPermission = (role: UserRole, permission: string): boolean => {
  const permissions = getUserPermissions(role);
  return permissions.includes(permission);
};

// Helper function to check if user has any of the permissions
export const hasAnyPermission = (role: UserRole, permissions: string[]): boolean => {
  const userPermissions = getUserPermissions(role);
  return permissions.some(permission => userPermissions.includes(permission));
};
