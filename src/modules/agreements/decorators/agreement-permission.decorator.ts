import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiForbiddenResponse } from '@nestjs/swagger';
import { AgreementAction, SignatureType } from '../constants/agreement-permissions.constants';

/**
 * Metadata key for agreement permission
 */
export const AGREEMENT_PERMISSION_KEY = 'agreement_permission';

/**
 * Agreement permission metadata interface
 */
export interface AgreementPermissionMetadata {
  action: AgreementAction;
  signatureType?: SignatureType;
  requiresAgreementId?: boolean;
}

/**
 * Decorator to specify required agreement permission for an endpoint
 *
 * @example
 * ```typescript
 * @AgreementPermission(AgreementAction.CREATE)
 * @Post()
 * create(@Body() data: CreateAgreementDto) { ... }
 *
 * @AgreementPermission(AgreementAction.SIGN, SignatureType.TENANT)
 * @Patch(':id/sign')
 * sign(@Param('id') id: string) { ... }
 * ```
 */
export const AgreementPermission = (
  action: AgreementAction,
  signatureType?: SignatureType,
  requiresAgreementId?: boolean
) => {
  // By default, these actions require an agreement ID
  // VIEW is NOT included because it's used for both list and single endpoints
  const actionsRequiringId = [
    AgreementAction.EDIT,
    AgreementAction.DELETE,
    AgreementAction.SIGN,
    AgreementAction.APPROVE,
    AgreementAction.REJECT,
    AgreementAction.CANCEL,
    AgreementAction.SEND_FOR_SIGNATURE,
  ];

  const metadata: AgreementPermissionMetadata = {
    action,
    signatureType,
    // Use explicit parameter if provided, otherwise check if action typically requires ID
    requiresAgreementId: requiresAgreementId !== undefined
      ? requiresAgreementId
      : actionsRequiringId.includes(action),
  };

  return applyDecorators(
    SetMetadata(AGREEMENT_PERMISSION_KEY, metadata),
    ApiForbiddenResponse({
      description: `Requires permission for action: ${action}${signatureType ? ` with signature type: ${signatureType}` : ''}`,
    }),
  );
};

/**
 * Shorthand decorators for common actions
 */
// CanViewAgreement requires an agreement ID (for single agreement endpoints like GET /:id)
export const CanViewAgreement = () => AgreementPermission(AgreementAction.VIEW, undefined, true);
export const CanCreateAgreement = () => AgreementPermission(AgreementAction.CREATE);
export const CanEditAgreement = () => AgreementPermission(AgreementAction.EDIT);
export const CanDeleteAgreement = () => AgreementPermission(AgreementAction.DELETE);
export const CanApproveAgreement = () => AgreementPermission(AgreementAction.APPROVE);
export const CanRejectAgreement = () => AgreementPermission(AgreementAction.REJECT);
export const CanCancelAgreement = () => AgreementPermission(AgreementAction.CANCEL);
export const CanSendForSignature = () => AgreementPermission(AgreementAction.SEND_FOR_SIGNATURE);

/**
 * Signature-specific decorators
 */
export const CanSignAsTenant = () => AgreementPermission(AgreementAction.SIGN, SignatureType.TENANT);
export const CanSignAsOwner = () => AgreementPermission(AgreementAction.SIGN, SignatureType.OWNER);
export const CanSignAsAgency = () => AgreementPermission(AgreementAction.SIGN, SignatureType.AGENCY);
export const CanSignAsBroker = () => AgreementPermission(AgreementAction.SIGN, SignatureType.BROKER);
export const CanSignAsWitness = () => AgreementPermission(AgreementAction.SIGN, SignatureType.WITNESS);
