import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AGREEMENT_PERMISSION_KEY,
  AgreementPermissionMetadata,
} from '../decorators/agreement-permission.decorator';
import {
  AgreementPermissionService,
  UserContext,
} from '../services/agreement-permission.service';
import { AgreementAction } from '../constants/agreement-permissions.constants';

/**
 * Guard that checks agreement-specific permissions
 *
 * This guard works in conjunction with the @AgreementPermission decorator
 * to enforce fine-grained access control on agreement operations.
 *
 * It:
 * 1. Reads the required action from the decorator metadata
 * 2. Extracts user context from the JWT token
 * 3. For operations on specific agreements, loads the agreement and checks permissions
 * 4. For general operations (create, list), checks role-based permissions
 */
@Injectable()
export class AgreementPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: AgreementPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the permission metadata from the decorator
    const permissionMeta = this.reflector.getAllAndOverride<AgreementPermissionMetadata>(
      AGREEMENT_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission decorator, allow access (rely on JwtAuthGuard only)
    if (!permissionMeta) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Build user context from JWT payload
    const userContext: UserContext = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
      creci: user.creci,
      document: user.document,
    };

    // Debug logging - remove after troubleshooting
    console.log('[AgreementPermissionGuard] User context:', {
      sub: userContext.sub,
      email: userContext.email,
      role: userContext.role,
      agencyId: userContext.agencyId,
      action: permissionMeta.action,
    });

    const { action, signatureType, requiresAgreementId } = permissionMeta;

    // For actions that require a specific agreement
    if (requiresAgreementId) {
      const agreementId = request.params.id;

      if (!agreementId) {
        throw new ForbiddenException('Agreement ID is required for this action');
      }

      try {
        // This will throw ForbiddenException or NotFoundException if not allowed
        const agreement = await this.permissionService.validateAction(
          userContext,
          agreementId,
          action,
          signatureType,
        );

        // Attach the loaded agreement to the request for use in the controller
        request.agreement = agreement;
        request.userContext = userContext;

        return true;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        if (error instanceof ForbiddenException) {
          throw error;
        }
        throw new ForbiddenException('Permission check failed');
      }
    }

    // For general actions (like CREATE or LIST)
    const result = this.permissionService.canPerformAction(userContext, action);

    if (!result.allowed) {
      throw new ForbiddenException(result.reason || 'Action not allowed');
    }

    // Attach user context for use in the controller
    request.userContext = userContext;

    return true;
  }
}

/**
 * Decorator to extract loaded agreement from request
 * Use this in controllers when @AgreementPermission was used with requiresAgreementId
 */
import { createParamDecorator } from '@nestjs/common';

export const LoadedAgreement = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const agreement = request.agreement;

    return data ? agreement?.[data] : agreement;
  },
);

/**
 * Decorator to extract user context from request
 */
export const AgreementUserContext = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const userContext = request.userContext;

    return data ? userContext?.[data] : userContext;
  },
);
