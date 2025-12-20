import { UserRole } from '@prisma/client';

/**
 * Service responsible for applying LGPD-aware visibility rules
 * and masking to tenant analysis data BEFORE any explicit
 * obfuscation request by the tenant.
 *
 * This centralizes:
 * - What each role can see
 * - How sensitive fields are masked
 */
export class TenantVisibilityService {
  private static maskDocument(document?: string | null): string | null {
    if (!document) return null;

    const clean = document.replace(/\D/g, '');

    // CPF (11 digits): ***.***.***-XX
    if (clean.length === 11) {
      return `***.***.***-${clean.slice(-2)}`;
    }

    // CNPJ or other: ***********XXXX (last 4 digits)
    if (clean.length >= 4) {
      return `***********${clean.slice(-4)}`;
    }

    return '***********';
  }

  private static maskPhone(phone?: string | null): string | null {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 4) return '(***) ****-****';
    return `(***) ****-${clean.slice(-4)}`;
  }

  private static maskEmail(email?: string | null): string | null {
    if (!email) return null;
    const [user, domain] = email.split('@');
    if (!user || !domain) return email;
    return `${user[0]}****@${domain}`;
  }

  /**
   * Apply visibility rules to a formatted analysis response (output of formatAnalysisResponse)
   * according to the caller role and, when applicable, the requesterId (tenant id).
   */
  static applyVisibility(
    formattedAnalysis: any,
    role: UserRole,
    requesterId?: bigint,
  ): any {
    // 1) Platform-level roles: full visibility
    if (role === UserRole.CEO || role === UserRole.ADMIN) {
      return formattedAnalysis;
    }

    // 2) Tenant (data subject): can see all their own data
    // NOTE: this depends on having a tenantId (or similar) linked to the analysis.
    // If your schema has this relation, you can uncomment/adjust this block.
    //
    // if (role === UserRole.INQUILINO && formattedAnalysis.tenantId && requesterId) {
    //   if (BigInt(formattedAnalysis.tenantId) === requesterId) {
    //     return formattedAnalysis;
    //   }
    // }

    // 3) Agency roles: full visibility (they requested the analysis for rental decisions)
    if (
      role === UserRole.AGENCY_ADMIN ||
      role === UserRole.AGENCY_MANAGER ||
      role === UserRole.BROKER
    ) {
      // Agency users who request analysis need full data for rental decisions
      return formattedAnalysis;
    }

    // 4) Owner roles: full visibility (they requested and paid for the analysis)
    if (
      role === UserRole.INDEPENDENT_OWNER ||
      role === UserRole.PROPRIETARIO
    ) {
      // Independent owners who request analysis need full data for rental decisions
      return formattedAnalysis;
    }

    // 4) Other / third parties: extremely summarized view
    return {
      id: formattedAnalysis.id,
      token: formattedAnalysis.token,
      // Abbreviated name
      tenantName: formattedAnalysis.name
        ? `${formattedAnalysis.name.split(' ')[0]}${formattedAnalysis.name.includes(' ') ? ' S.' : ''}`
        : undefined,
      status: formattedAnalysis.status,
      riskLevel: formattedAnalysis.riskLevel,
      recommendation: formattedAnalysis.recommendation,
    };
  }
}


