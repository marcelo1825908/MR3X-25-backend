import { UserRole } from '@prisma/client';

/**
 * Agreement Permission Actions
 * Defines all possible actions on agreements
 */
export enum AgreementAction {
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  SIGN = 'sign',
  SEND_FOR_SIGNATURE = 'send_for_signature',
  APPROVE = 'approve',
  REJECT = 'reject',
  CANCEL = 'cancel',
}

/**
 * Agreement Status Constants
 */
export enum AgreementStatusValue {
  RASCUNHO = 'RASCUNHO',
  AGUARDANDO_ASSINATURA = 'AGUARDANDO_ASSINATURA',
  ASSINADO = 'ASSINADO',
  CONCLUIDO = 'CONCLUIDO',
  REJEITADO = 'REJEITADO',
  CANCELADO = 'CANCELADO',
}

/**
 * Signature Type - indicates which party is signing
 */
export enum SignatureType {
  TENANT = 'tenant',
  OWNER = 'owner',
  AGENCY = 'agency',
  BROKER = 'broker',
  WITNESS = 'witness',
}

/**
 * Access Scope - defines the scope of data access
 */
export enum AccessScope {
  ALL = 'all',                    // Can see all agreements (CEO, Auditor)
  AGENCY = 'agency',              // Can see agency agreements
  OWN_CREATED = 'own_created',    // Can see only agreements they created
  PARTY_TO = 'party_to',          // Can see agreements where they are a party
  NONE = 'none',                  // No access
}

/**
 * Role Permission Matrix Interface
 */
export interface RolePermissions {
  view: AccessScope;
  create: boolean;
  edit: boolean;           // Subject to status restrictions
  delete: boolean;         // Subject to status restrictions
  sign: boolean;           // Subject to party validation
  signatureTypes: SignatureType[];  // Which signatures this role can provide
  approve: boolean;
  reject: boolean;
  cancel: boolean;
  sendForSignature: boolean;
  requiresCreci?: boolean; // For brokers - requires valid CRECI to sign
}

/**
 * Complete Permission Matrix by Role
 * Based on the business rules provided:
 *
 * 1. CEO (MR3X) - Read-only access to all for governance/audit
 * 2. Admin (MR3X) - Read-only access for support/compliance
 * 3. Manager (MR3X) - Read-only access for client assistance
 * 4. Director/Agency Owner - Full control within agency
 * 5. Manager (Agency) - Full operational control within agency
 * 6. Broker - Limited to own scope with CRECI requirement for signing
 * 7. Owner (linked to Agency) - Party access, can sign
 * 8. Independent Owner - Full control for own properties
 * 9. Tenant - Party access, can sign when requested
 * 10. Building Manager - Limited informational access
 * 11. Auditor (MR3X) - Full read access for audit/LGPD
 * 12. Sales Representative (MR3X) - No access
 * 13. API Client - Scoped access based on token
 */
export const AGREEMENT_PERMISSION_MATRIX: Record<UserRole, RolePermissions> = {
  // 1. CEO (MR3X) - Read-only, governance and audits
  [UserRole.CEO]: {
    view: AccessScope.ALL,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  // 2. Admin (MR3X) - Read-only for support and compliance
  [UserRole.ADMIN]: {
    view: AccessScope.ALL,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  // 3. Platform Manager (MR3X) - Read-only for client assistance
  [UserRole.PLATFORM_MANAGER]: {
    view: AccessScope.ALL,  // Can view when assisting specific clients
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  // 4. Agency Admin/Director - Full control within agency
  [UserRole.AGENCY_ADMIN]: {
    view: AccessScope.AGENCY,
    create: true,
    edit: true,           // While draft or under negotiation
    delete: true,         // Only draft, never signed
    sign: true,           // As legal representative
    signatureTypes: [SignatureType.AGENCY, SignatureType.OWNER],
    approve: true,
    reject: true,
    cancel: true,
    sendForSignature: true,
  },

  // 5. Agency Manager - Full operational control
  [UserRole.AGENCY_MANAGER]: {
    view: AccessScope.AGENCY,
    create: true,
    edit: true,           // For unsigned agreements
    delete: true,         // Only draft, never signed
    sign: true,           // Optional, depends on configuration
    signatureTypes: [SignatureType.AGENCY],
    approve: true,
    reject: true,
    cancel: true,
    sendForSignature: true,
  },

  // 6. Broker - Limited to own scope
  [UserRole.BROKER]: {
    view: AccessScope.OWN_CREATED,  // Only linked contracts/properties
    create: true,                    // As proposal or draft
    edit: true,                      // While in draft or under review
    delete: true,                    // Only own drafts, never signed
    sign: true,                      // As intermediary, when CRECI valid
    signatureTypes: [SignatureType.BROKER, SignatureType.WITNESS],
    approve: false,
    reject: false,
    cancel: true,
    sendForSignature: true,
    requiresCreci: true,
  },

  // 7. Owner (linked to Agency) - Participatory role
  [UserRole.PROPRIETARIO]: {
    view: AccessScope.PARTY_TO,      // Only agreements where they are a party
    create: false,                   // At most can suggest/request
    edit: false,                     // Once created by agency or broker
    delete: false,
    sign: true,                      // When they are a party
    signatureTypes: [SignatureType.OWNER],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  // 8. Independent Owner - Similar to Agency Manager for own properties
  [UserRole.INDEPENDENT_OWNER]: {
    view: AccessScope.OWN_CREATED,
    create: true,
    edit: true,           // While not signed
    delete: true,         // If draft and not signed
    sign: true,           // As landlord
    signatureTypes: [SignatureType.OWNER, SignatureType.AGENCY],
    approve: true,
    reject: true,
    cancel: true,
    sendForSignature: true,
  },

  // 9. Tenant - Participatory role
  [UserRole.INQUILINO]: {
    view: AccessScope.PARTY_TO,      // Only agreements where they are a party
    create: false,
    edit: false,
    delete: false,
    sign: true,                      // When requested
    signatureTypes: [SignatureType.TENANT],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  // 10. Building Manager - Informational, rarely contractual
  [UserRole.BUILDING_MANAGER]: {
    view: AccessScope.PARTY_TO,      // Only if tagged as involving building/condominium
    create: false,
    edit: false,
    delete: false,
    sign: true,                      // Only if formal party to specific agreement
    signatureTypes: [],              // Rarely signs
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  // 11. Legal Auditor - Pure read-only with deep visibility
  [UserRole.LEGAL_AUDITOR]: {
    view: AccessScope.ALL,           // All agreements including history
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  // 12. Representative/Sales - No access to agreements
  [UserRole.REPRESENTATIVE]: {
    view: AccessScope.NONE,
    create: false,
    edit: false,
    delete: false,
    sign: false,
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },

  // 13. API Client - Scoped based on token
  [UserRole.API_CLIENT]: {
    view: AccessScope.AGENCY,        // Only if token has agreement:read scope
    create: false,                   // Limited, requires agreement:write scope
    edit: false,                     // Strongly limited
    delete: false,                   // Not allowed
    sign: false,                     // Signatures should be human
    signatureTypes: [],
    approve: false,
    reject: false,
    cancel: false,
    sendForSignature: false,
  },
};

/**
 * Status-based edit restrictions
 * Defines which statuses allow editing
 */
export const EDITABLE_STATUSES = [
  AgreementStatusValue.RASCUNHO,
  AgreementStatusValue.AGUARDANDO_ASSINATURA,
];

/**
 * Status-based delete restrictions
 * Only RASCUNHO (draft) can be deleted, and never if signed
 */
export const DELETABLE_STATUSES = [
  AgreementStatusValue.RASCUNHO,
];

/**
 * Statuses where signing is allowed
 */
export const SIGNABLE_STATUSES = [
  AgreementStatusValue.RASCUNHO,
  AgreementStatusValue.AGUARDANDO_ASSINATURA,
];

/**
 * Statuses that indicate the agreement has been signed
 * (used to prevent deletion)
 */
export const SIGNED_STATUSES = [
  AgreementStatusValue.ASSINADO,
  AgreementStatusValue.CONCLUIDO,
];

/**
 * Immutable statuses - no modifications allowed
 */
export const IMMUTABLE_STATUSES = [
  AgreementStatusValue.CONCLUIDO,
  AgreementStatusValue.REJEITADO,
];

/**
 * Roles that can view audit/metadata information
 */
export const AUDIT_VIEW_ROLES = [
  UserRole.CEO,
  UserRole.ADMIN,
  UserRole.LEGAL_AUDITOR,
];

/**
 * MR3X Platform roles (read-only access)
 */
export const MR3X_ROLES: UserRole[] = [
  UserRole.CEO,
  UserRole.ADMIN,
  UserRole.PLATFORM_MANAGER,
  UserRole.LEGAL_AUDITOR,
  UserRole.REPRESENTATIVE,
];

/**
 * Agency operational roles
 */
export const AGENCY_OPERATIONAL_ROLES: UserRole[] = [
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_MANAGER,
  UserRole.BROKER,
];

/**
 * Check if a role is a platform (MR3X) role
 */
export function isMR3XRole(role: UserRole): boolean {
  return MR3X_ROLES.includes(role);
}

/**
 * Check if a role is an agency operational role
 */
export function isAgencyRole(role: UserRole): boolean {
  return AGENCY_OPERATIONAL_ROLES.includes(role);
}

/**
 * Default permissions for unknown/invalid roles (no access)
 */
export const DEFAULT_NO_ACCESS_PERMISSIONS: RolePermissions = {
  view: AccessScope.NONE,
  create: false,
  edit: false,
  delete: false,
  sign: false,
  signatureTypes: [],
  approve: false,
  reject: false,
  cancel: false,
  sendForSignature: false,
};

/**
 * Get permissions for a specific role
 * Returns no-access permissions if role is invalid or not found
 */
export function getPermissionsForRole(role: UserRole): RolePermissions {
  if (!role || !AGREEMENT_PERMISSION_MATRIX[role]) {
    return DEFAULT_NO_ACCESS_PERMISSIONS;
  }
  return AGREEMENT_PERMISSION_MATRIX[role];
}

/**
 * Check if status allows editing
 */
export function isEditableStatus(status: string): boolean {
  return EDITABLE_STATUSES.includes(status as AgreementStatusValue);
}

/**
 * Check if status allows deletion
 */
export function isDeletableStatus(status: string): boolean {
  return DELETABLE_STATUSES.includes(status as AgreementStatusValue);
}

/**
 * Check if agreement has been signed (prevents deletion)
 */
export function hasBeenSigned(agreement: any): boolean {
  return !!(
    agreement.tenantSignature ||
    agreement.ownerSignature ||
    agreement.agencySignature
  );
}

/**
 * Check if status is immutable
 */
export function isImmutableStatus(status: string): boolean {
  return IMMUTABLE_STATUSES.includes(status as AgreementStatusValue);
}
