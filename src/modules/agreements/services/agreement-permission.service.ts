import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { UserRole } from '@prisma/client';
import {
  AgreementAction,
  AccessScope,
  SignatureType,
  getPermissionsForRole,
  isEditableStatus,
  isDeletableStatus,
  hasBeenSigned,
  isImmutableStatus,
  isMR3XRole,
  SIGNABLE_STATUSES,
  AgreementStatusValue,
} from '../constants/agreement-permissions.constants';

/**
 * User context from JWT/request
 */
export interface UserContext {
  sub: string;           // User ID
  email: string;
  role: UserRole;
  agencyId?: string;
  brokerId?: string;
  creci?: string;        // For brokers
  document?: string;     // CPF/CNPJ
}

/**
 * Agreement with relations for permission checks
 */
export interface AgreementWithRelations {
  id: bigint;
  status: string;
  agencyId?: bigint | null;
  propertyId: bigint;
  contractId?: bigint | null;
  tenantId?: bigint | null;
  ownerId?: bigint | null;
  createdBy: bigint;
  tenantSignature?: string | null;
  ownerSignature?: string | null;
  agencySignature?: string | null;
  property?: {
    id: bigint;
    ownerId?: bigint | null;
    agencyId?: bigint | null;
    brokerId?: bigint | null;
    tenantId?: bigint | null;
  };
  contract?: {
    id: bigint;
    tenantId: bigint;
    ownerId?: bigint | null;
    agencyId?: bigint | null;
  };
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  restrictions?: string[];
}

@Injectable()
export class AgreementPermissionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if user can perform an action on agreements in general
   */
  canPerformAction(user: UserContext, action: AgreementAction): PermissionCheckResult {
    const permissions = getPermissionsForRole(user.role);

    // Debug logging - remove after troubleshooting
    console.log('[AgreementPermissionService] canPerformAction:', {
      role: user.role,
      action,
      permissions: permissions ? { view: permissions.view, create: permissions.create } : 'undefined',
    });

    switch (action) {
      case AgreementAction.VIEW:
        if (permissions.view === AccessScope.NONE) {
          console.log('[AgreementPermissionService] VIEW denied - AccessScope.NONE for role:', user.role);
          return { allowed: false, reason: 'Your role does not have permission to view agreements' };
        }
        return { allowed: true };

      case AgreementAction.CREATE:
        if (!permissions.create) {
          return { allowed: false, reason: 'Your role does not have permission to create agreements' };
        }
        return { allowed: true };

      case AgreementAction.EDIT:
        if (!permissions.edit) {
          return { allowed: false, reason: 'Your role does not have permission to edit agreements' };
        }
        return { allowed: true };

      case AgreementAction.DELETE:
        if (!permissions.delete) {
          return { allowed: false, reason: 'Your role does not have permission to delete agreements' };
        }
        return { allowed: true };

      case AgreementAction.SIGN:
        if (!permissions.sign) {
          return { allowed: false, reason: 'Your role does not have permission to sign agreements' };
        }
        if (permissions.requiresCreci && !user.creci) {
          return { allowed: false, reason: 'Valid CRECI registration is required to sign agreements' };
        }
        return { allowed: true };

      case AgreementAction.APPROVE:
        if (!permissions.approve) {
          return { allowed: false, reason: 'Your role does not have permission to approve agreements' };
        }
        return { allowed: true };

      case AgreementAction.REJECT:
        if (!permissions.reject) {
          return { allowed: false, reason: 'Your role does not have permission to reject agreements' };
        }
        return { allowed: true };

      case AgreementAction.CANCEL:
        if (!permissions.cancel) {
          return { allowed: false, reason: 'Your role does not have permission to cancel agreements' };
        }
        return { allowed: true };

      case AgreementAction.SEND_FOR_SIGNATURE:
        if (!permissions.sendForSignature) {
          return { allowed: false, reason: 'Your role does not have permission to send agreements for signature' };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Unknown action' };
    }
  }

  /**
   * Check if user can view a specific agreement
   */
  canViewAgreement(user: UserContext, agreement: AgreementWithRelations): PermissionCheckResult {
    const permissions = getPermissionsForRole(user.role);

    switch (permissions.view) {
      case AccessScope.ALL:
        return { allowed: true };

      case AccessScope.AGENCY:
        // User must belong to the same agency
        if (!user.agencyId) {
          return { allowed: false, reason: 'You are not associated with an agency' };
        }
        if (agreement.agencyId && agreement.agencyId.toString() !== user.agencyId) {
          return { allowed: false, reason: 'This agreement belongs to a different agency' };
        }
        return { allowed: true };

      case AccessScope.OWN_CREATED:
        // For brokers, also check if they are linked to the property/contract
        if (user.role === UserRole.BROKER) {
          const isLinked = this.isBrokerLinkedToAgreement(user, agreement);
          if (isLinked) return { allowed: true };
        }

        // Check if user created the agreement
        if (agreement.createdBy.toString() === user.sub) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'You can only view agreements you created or are linked to' };

      case AccessScope.PARTY_TO:
        // Check if user is a party to the agreement
        if (this.isPartyToAgreement(user, agreement)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'You can only view agreements where you are a party' };

      case AccessScope.NONE:
      default:
        return { allowed: false, reason: 'Your role does not have access to agreements' };
    }
  }

  /**
   * Check if user can edit a specific agreement
   */
  canEditAgreement(user: UserContext, agreement: AgreementWithRelations): PermissionCheckResult {
    // First check general permission
    const generalCheck = this.canPerformAction(user, AgreementAction.EDIT);
    if (!generalCheck.allowed) return generalCheck;

    // Check status-based restriction
    if (!isEditableStatus(agreement.status)) {
      return {
        allowed: false,
        reason: `Agreement in status '${agreement.status}' cannot be edited`
      };
    }

    // Check if status is immutable
    if (isImmutableStatus(agreement.status)) {
      return { allowed: false, reason: 'This agreement is in a final status and cannot be modified' };
    }

    // Check scope-based access
    const permissions = getPermissionsForRole(user.role);

    switch (permissions.view) {
      case AccessScope.ALL:
        // MR3X roles have read-only access even with AccessScope.ALL
        if (isMR3XRole(user.role)) {
          return { allowed: false, reason: 'Platform roles have read-only access to agreements' };
        }
        return { allowed: true };

      case AccessScope.AGENCY:
        if (!user.agencyId || (agreement.agencyId && agreement.agencyId.toString() !== user.agencyId)) {
          return { allowed: false, reason: 'You can only edit agreements from your agency' };
        }
        // Agency admin can edit any agency agreement, manager can edit unsigned
        if (user.role === UserRole.AGENCY_MANAGER && hasBeenSigned(agreement)) {
          return {
            allowed: false,
            reason: 'Managers cannot edit agreements that have been signed',
            restrictions: ['Already signed by at least one party']
          };
        }
        return { allowed: true };

      case AccessScope.OWN_CREATED:
        // Broker can only edit own drafts or drafts under review
        if (user.role === UserRole.BROKER) {
          const isOwn = agreement.createdBy.toString() === user.sub ||
                        this.isBrokerLinkedToAgreement(user, agreement);
          if (!isOwn) {
            return { allowed: false, reason: 'You can only edit your own agreements or those you are linked to' };
          }
        } else if (agreement.createdBy.toString() !== user.sub) {
          return { allowed: false, reason: 'You can only edit agreements you created' };
        }
        return { allowed: true };

      case AccessScope.PARTY_TO:
        // Parties (owner, tenant) cannot edit
        return { allowed: false, reason: 'Parties to an agreement cannot edit it' };

      default:
        return { allowed: false, reason: 'No edit permission for your role' };
    }
  }

  /**
   * Check if user can delete a specific agreement
   */
  canDeleteAgreement(user: UserContext, agreement: AgreementWithRelations): PermissionCheckResult {
    // First check general permission
    const generalCheck = this.canPerformAction(user, AgreementAction.DELETE);
    if (!generalCheck.allowed) return generalCheck;

    // Check if agreement is in deletable status
    if (!isDeletableStatus(agreement.status)) {
      return {
        allowed: false,
        reason: `Agreement in status '${agreement.status}' cannot be deleted. Only drafts can be deleted.`
      };
    }

    // Check if agreement has been signed (even in draft status, if somehow signed)
    if (hasBeenSigned(agreement)) {
      return {
        allowed: false,
        reason: 'Agreements that have been signed by any party cannot be deleted'
      };
    }

    // Check scope-based access
    const permissions = getPermissionsForRole(user.role);

    switch (permissions.view) {
      case AccessScope.AGENCY:
        if (!user.agencyId || (agreement.agencyId && agreement.agencyId.toString() !== user.agencyId)) {
          return { allowed: false, reason: 'You can only delete agreements from your agency' };
        }
        return { allowed: true };

      case AccessScope.OWN_CREATED:
        // Broker can only delete own drafts
        if (agreement.createdBy.toString() !== user.sub) {
          return { allowed: false, reason: 'You can only delete your own draft agreements' };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: 'No delete permission for your role' };
    }
  }

  /**
   * Check if user can sign a specific agreement
   */
  canSignAgreement(
    user: UserContext,
    agreement: AgreementWithRelations,
    signatureType: SignatureType
  ): PermissionCheckResult {
    // First check general permission
    const generalCheck = this.canPerformAction(user, AgreementAction.SIGN);
    if (!generalCheck.allowed) return generalCheck;

    // Check status allows signing
    if (!SIGNABLE_STATUSES.includes(agreement.status as AgreementStatusValue)) {
      return {
        allowed: false,
        reason: `Agreement in status '${agreement.status}' cannot be signed`
      };
    }

    const permissions = getPermissionsForRole(user.role);

    // Check if the user's role allows this signature type
    if (!permissions.signatureTypes.includes(signatureType)) {
      return {
        allowed: false,
        reason: `Your role cannot provide a ${signatureType} signature`
      };
    }

    // Validate the user is the appropriate party for this signature type
    switch (signatureType) {
      case SignatureType.TENANT:
        if (agreement.tenantId?.toString() !== user.sub) {
          // Also check if user is the tenant on the property/contract
          const isTenant = this.isUserTenantForAgreement(user, agreement);
          if (!isTenant) {
            return { allowed: false, reason: 'You are not the tenant for this agreement' };
          }
        }
        break;

      case SignatureType.OWNER:
        if (agreement.ownerId?.toString() !== user.sub) {
          // Also check if user is the owner on the property
          const isOwner = this.isUserOwnerForAgreement(user, agreement);
          if (!isOwner) {
            return { allowed: false, reason: 'You are not the owner for this agreement' };
          }
        }
        break;

      case SignatureType.AGENCY:
        if (!user.agencyId || (agreement.agencyId && agreement.agencyId.toString() !== user.agencyId)) {
          return { allowed: false, reason: 'You are not from the agency for this agreement' };
        }
        break;

      case SignatureType.BROKER:
        // Broker must be linked to the property/contract and have valid CRECI
        if (permissions.requiresCreci && !user.creci) {
          return { allowed: false, reason: 'Valid CRECI registration is required to sign as broker' };
        }
        if (!this.isBrokerLinkedToAgreement(user, agreement)) {
          return { allowed: false, reason: 'You are not the broker linked to this agreement' };
        }
        break;

      case SignatureType.WITNESS:
        // Witness can be anyone with signing permission
        break;
    }

    return { allowed: true };
  }

  /**
   * Check if user can approve a specific agreement
   */
  canApproveAgreement(user: UserContext, agreement: AgreementWithRelations): PermissionCheckResult {
    const generalCheck = this.canPerformAction(user, AgreementAction.APPROVE);
    if (!generalCheck.allowed) return generalCheck;

    // Check agreement is in approvable status
    if (agreement.status === AgreementStatusValue.CONCLUIDO) {
      return { allowed: false, reason: 'Agreement is already completed' };
    }

    if (agreement.status === AgreementStatusValue.REJEITADO) {
      return { allowed: false, reason: 'Cannot approve a rejected agreement' };
    }

    // Check scope
    const permissions = getPermissionsForRole(user.role);
    if (permissions.view === AccessScope.AGENCY) {
      if (!user.agencyId || (agreement.agencyId && agreement.agencyId.toString() !== user.agencyId)) {
        return { allowed: false, reason: 'You can only approve agreements from your agency' };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if user can cancel a specific agreement
   */
  canCancelAgreement(user: UserContext, agreement: AgreementWithRelations): PermissionCheckResult {
    const generalCheck = this.canPerformAction(user, AgreementAction.CANCEL);
    if (!generalCheck.allowed) return generalCheck;

    // Cannot cancel completed agreements
    if (agreement.status === AgreementStatusValue.CONCLUIDO) {
      return { allowed: false, reason: 'Completed agreements cannot be cancelled' };
    }

    // Check scope
    const permissions = getPermissionsForRole(user.role);

    if (permissions.view === AccessScope.AGENCY) {
      if (!user.agencyId || (agreement.agencyId && agreement.agencyId.toString() !== user.agencyId)) {
        return { allowed: false, reason: 'You can only cancel agreements from your agency' };
      }
    } else if (permissions.view === AccessScope.OWN_CREATED) {
      if (agreement.createdBy.toString() !== user.sub) {
        return { allowed: false, reason: 'You can only cancel your own agreements' };
      }
    }

    return { allowed: true };
  }

  /**
   * Get the data access filter for listing agreements
   * Returns Prisma where conditions based on user role
   */
  getAccessFilter(user: UserContext): any {
    const permissions = getPermissionsForRole(user.role);
    const userId = BigInt(user.sub);

    switch (permissions.view) {
      case AccessScope.ALL:
        // No filter - can see everything
        return {};

      case AccessScope.AGENCY:
        if (!user.agencyId) {
          // User should have agency, but fallback to own created
          return { createdBy: userId };
        }
        return { agencyId: BigInt(user.agencyId) };

      case AccessScope.OWN_CREATED:
        // For brokers, also include agreements they are linked to
        if (user.role === UserRole.BROKER) {
          return {
            OR: [
              { createdBy: userId },
              { property: { brokerId: userId } },
            ],
          };
        }
        return { createdBy: userId };

      case AccessScope.PARTY_TO:
        // Show agreements where user is tenant, owner, or on the property
        return {
          OR: [
            { tenantId: userId },
            { ownerId: userId },
            { property: { ownerId: userId } },
            { property: { tenantId: userId } },
          ],
        };

      case AccessScope.NONE:
      default:
        // Return impossible condition to show nothing
        return { id: BigInt(-1) };
    }
  }

  /**
   * Check if user is a party to the agreement
   */
  private isPartyToAgreement(user: UserContext, agreement: AgreementWithRelations): boolean {
    const userId = BigInt(user.sub);

    // Direct party
    if (agreement.tenantId === userId) return true;
    if (agreement.ownerId === userId) return true;

    // Property-based party
    if (agreement.property) {
      if (agreement.property.ownerId === userId) return true;
      if (agreement.property.tenantId === userId) return true;
    }

    // Contract-based party
    if (agreement.contract) {
      if (agreement.contract.tenantId === userId) return true;
      if (agreement.contract.ownerId === userId) return true;
    }

    return false;
  }

  /**
   * Check if broker is linked to the agreement's property or contract
   */
  private isBrokerLinkedToAgreement(user: UserContext, agreement: AgreementWithRelations): boolean {
    const userId = BigInt(user.sub);

    // Check property broker
    if (agreement.property?.brokerId === userId) return true;

    return false;
  }

  /**
   * Check if user is the tenant for this agreement
   */
  private isUserTenantForAgreement(user: UserContext, agreement: AgreementWithRelations): boolean {
    const userId = BigInt(user.sub);

    if (agreement.tenantId === userId) return true;
    if (agreement.property?.tenantId === userId) return true;
    if (agreement.contract?.tenantId === userId) return true;

    return false;
  }

  /**
   * Check if user is the owner for this agreement
   */
  private isUserOwnerForAgreement(user: UserContext, agreement: AgreementWithRelations): boolean {
    const userId = BigInt(user.sub);

    if (agreement.ownerId === userId) return true;
    if (agreement.property?.ownerId === userId) return true;
    if (agreement.contract?.ownerId === userId) return true;

    return false;
  }

  /**
   * Load agreement with relations needed for permission checks
   */
  async loadAgreementForPermissionCheck(agreementId: string): Promise<AgreementWithRelations | null> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(agreementId) },
      include: {
        property: {
          select: {
            id: true,
            ownerId: true,
            agencyId: true,
            brokerId: true,
            tenantId: true,
          },
        },
        contract: {
          select: {
            id: true,
            tenantId: true,
            ownerId: true,
            agencyId: true,
          },
        },
      },
    });

    return agreement as AgreementWithRelations | null;
  }

  /**
   * Validate action and throw if not allowed
   */
  async validateAction(
    user: UserContext,
    agreementId: string,
    action: AgreementAction,
    signatureType?: SignatureType
  ): Promise<AgreementWithRelations> {
    const agreement = await this.loadAgreementForPermissionCheck(agreementId);

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    let result: PermissionCheckResult;

    switch (action) {
      case AgreementAction.VIEW:
        result = this.canViewAgreement(user, agreement);
        break;
      case AgreementAction.EDIT:
        result = this.canEditAgreement(user, agreement);
        break;
      case AgreementAction.DELETE:
        result = this.canDeleteAgreement(user, agreement);
        break;
      case AgreementAction.SIGN:
        if (!signatureType) {
          throw new ForbiddenException('Signature type is required for sign action');
        }
        result = this.canSignAgreement(user, agreement, signatureType);
        break;
      case AgreementAction.APPROVE:
        result = this.canApproveAgreement(user, agreement);
        break;
      case AgreementAction.CANCEL:
        result = this.canCancelAgreement(user, agreement);
        break;
      default:
        result = this.canPerformAction(user, action);
    }

    if (!result.allowed) {
      throw new ForbiddenException(result.reason || 'Action not allowed');
    }

    return agreement;
  }

  /**
   * Get user's available actions for an agreement
   */
  getAvailableActions(user: UserContext, agreement: AgreementWithRelations): AgreementAction[] {
    const actions: AgreementAction[] = [];

    if (this.canViewAgreement(user, agreement).allowed) {
      actions.push(AgreementAction.VIEW);
    }
    if (this.canEditAgreement(user, agreement).allowed) {
      actions.push(AgreementAction.EDIT);
    }
    if (this.canDeleteAgreement(user, agreement).allowed) {
      actions.push(AgreementAction.DELETE);
    }
    if (this.canApproveAgreement(user, agreement).allowed) {
      actions.push(AgreementAction.APPROVE);
    }
    if (this.canCancelAgreement(user, agreement).allowed) {
      actions.push(AgreementAction.CANCEL);
    }

    // Check each signature type
    const permissions = getPermissionsForRole(user.role);
    for (const sigType of permissions.signatureTypes) {
      if (this.canSignAgreement(user, agreement, sigType).allowed) {
        actions.push(AgreementAction.SIGN);
        break; // Only add once
      }
    }

    // Check send for signature
    if (this.canPerformAction(user, AgreementAction.SEND_FOR_SIGNATURE).allowed) {
      if (agreement.status === AgreementStatusValue.RASCUNHO) {
        actions.push(AgreementAction.SEND_FOR_SIGNATURE);
      }
    }

    return [...new Set(actions)]; // Remove duplicates
  }
}
