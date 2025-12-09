import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

export enum TokenEntityType {
  CONTRACT = 'CTR', // MR3X-CTR-YEAR-XXXX-XXXX
  PROPERTY = 'IMO', // MR3X-IMO-YEAR-XXXX-XXXX (Imóvel)
  TENANT = 'INQ', // MR3X-INQ-YEAR-XXXX-XXXX (Inquilino)
  OWNER = 'PRO', // MR3X-PRO-YEAR-XXXX-XXXX (Proprietário)
  DOCUMENT = 'DOC', // MR3X-DOC-YEAR-XXXX-XXXX
  INVOICE = 'INV', // MR3X-INV-YEAR-XXXX-XXXX
  AGENCY = 'AGE', // MR3X-AGE-YEAR-XXXX-XXXX (Agência)
}

/**
 * Service for generating unique MR3X tokens in government-required format
 * Format: MR3X-{TYPE}-{YEAR}-{XXXX}-{XXXX}
 * Example: MR3X-IMO-2025-A7F2-B9D4
 */
@Injectable()
export class TokenGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique token for any entity type
   * Ensures uniqueness by checking the database
   */
  async generateToken(entityType: TokenEntityType): Promise<string> {
    const maxAttempts = 10;
    let attempt = 0;

    while (attempt < maxAttempts) {
      const token = this.createToken(entityType);

      // Check if token is unique in the system
      const exists = await this.tokenExists(token, entityType);

      if (!exists) {
        return token;
      }

      attempt++;
    }

    throw new Error(
      `Failed to generate unique token for ${entityType} after ${maxAttempts} attempts`,
    );
  }

  /**
   * Create a token string in MR3X format
   */
  private createToken(entityType: TokenEntityType): string {
    const year = new Date().getFullYear();
    const segment1 = this.generateRandomSegment();
    const segment2 = this.generateRandomSegment();

    return `MR3X-${entityType}-${year}-${segment1}-${segment2}`;
  }

  /**
   * Generate a random 4-character alphanumeric segment
   * Uses uppercase letters and numbers for clarity
   */
  private generateRandomSegment(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let segment = '';

    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return segment;
  }

  /**
   * Check if a token already exists in the database
   */
  private async tokenExists(
    token: string,
    entityType: TokenEntityType,
  ): Promise<boolean> {
    try {
      switch (entityType) {
        case TokenEntityType.CONTRACT:
          const contract = await this.prisma.contract.findFirst({
            where: { contractToken: token },
          });
          return !!contract;

        case TokenEntityType.PROPERTY:
          const property = await this.prisma.property.findFirst({
            where: { token },
          });
          return !!property;

        case TokenEntityType.TENANT:
        case TokenEntityType.OWNER:
          const user = await this.prisma.user.findFirst({
            where: { token },
          });
          return !!user;

        case TokenEntityType.DOCUMENT:
          const document = await this.prisma.document.findFirst({
            where: { token },
          });
          return !!document;

        case TokenEntityType.INVOICE:
          const invoice = await this.prisma.invoice.findFirst({
            where: { token },
          });
          return !!invoice;

        case TokenEntityType.AGENCY:
          const agency = await this.prisma.agency.findFirst({
            where: { token },
          });
          return !!agency;

        default:
          return false;
      }
    } catch (error) {
      // If table doesn't have token field yet, return false
      return false;
    }
  }

  /**
   * Parse a token to extract its components
   */
  parseToken(token: string): {
    prefix: string;
    entityType: string;
    year: number;
    segment1: string;
    segment2: string;
  } | null {
    const parts = token.split('-');

    if (parts.length !== 5 || parts[0] !== 'MR3X') {
      return null;
    }

    return {
      prefix: parts[0],
      entityType: parts[1],
      year: parseInt(parts[2], 10),
      segment1: parts[3],
      segment2: parts[4],
    };
  }

  /**
   * Validate a token format
   */
  isValidTokenFormat(token: string): boolean {
    const pattern = /^MR3X-[A-Z]{3}-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(token);
  }

  /**
   * Get entity type from token
   */
  getEntityTypeFromToken(token: string): TokenEntityType | null {
    const parsed = this.parseToken(token);
    if (!parsed) {
      return null;
    }

    const typeMap: { [key: string]: TokenEntityType } = {
      CTR: TokenEntityType.CONTRACT,
      IMO: TokenEntityType.PROPERTY,
      INQ: TokenEntityType.TENANT,
      LOC: TokenEntityType.TENANT, // Legacy support
      PRO: TokenEntityType.OWNER,
      DOC: TokenEntityType.DOCUMENT,
      INV: TokenEntityType.INVOICE,
      AGE: TokenEntityType.AGENCY,
    };

    return typeMap[parsed.entityType] || null;
  }
}
