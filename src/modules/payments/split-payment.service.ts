import { SettingsService } from '../settings/settings.service';
import { prisma } from '../../config/database';

export interface SplitPaymentConfig {
  platformFee?: number;     // MR3X fee percentage (optional, will fetch from settings if not provided)
  agencyFee?: number;       // Agency fee percentage (optional, will fetch from settings if not provided)
  totalAmount: number;      // Total payment amount
  ownerAccountId?: string;  // Owner's account ID for direct transfer
  agencyAccountId?: string; // Agency's account ID for transfer
}

export interface SplitPaymentResult {
  totalAmount: number;
  platformAmount: number;
  agencyAmount: number;
  ownerAmount: number;
  platformFee: number;
  agencyFee: number;
  breakdown: {
    original: number;
    platformDeduction: number;
    agencyDeduction: number;
    ownerFinal: number;
  };
}

export class SplitPaymentService {
  /**
   * Calculate split payment for a transaction
   */
  static async calculateSplit(config: SplitPaymentConfig): Promise<SplitPaymentResult> {
    const { totalAmount, platformFee: providedPlatformFee, agencyFee: providedAgencyFee } = config;

    // Fetch fee rates from settings if not provided
    const settingsService = new SettingsService();
    const paymentConfig = await settingsService.getPaymentConfig();
    const platformFee = providedPlatformFee ?? paymentConfig.platformFee;
    const agencyFee = providedAgencyFee ?? paymentConfig.agencyFee;

    // Calculate platform fee (MR3X)
    const platformAmount = (totalAmount * platformFee) / 100;
    
    // Calculate agency fee
    const agencyAmount = (totalAmount * agencyFee) / 100;
    
    // Calculate owner amount (remainder)
    const ownerAmount = totalAmount - platformAmount - agencyAmount;

    return {
      totalAmount,
      platformAmount: Number(platformAmount.toFixed(2)),
      agencyAmount: Number(agencyAmount.toFixed(2)),
      ownerAmount: Number(ownerAmount.toFixed(2)),
      platformFee,
      agencyFee,
      breakdown: {
        original: totalAmount,
        platformDeduction: Number(platformAmount.toFixed(2)),
        agencyDeduction: Number(agencyAmount.toFixed(2)),
        ownerFinal: Number(ownerAmount.toFixed(2)),
      },
    };
  }

  /**
   * Calculate split with fixed fees (alternative method)
   */
  static async calculateSplitWithFixedFees(
    totalAmount: number,
    platformFee?: number,
    agencyFee?: number
  ): Promise<SplitPaymentResult> {
    return this.calculateSplit({
      totalAmount,
      platformFee,
      agencyFee,
    });
  }

  /**
   * Calculate split for independent owner (no agency)
   */
  static async calculateSplitForIndependentOwner(
    totalAmount: number,
    platformFee?: number
  ): Promise<SplitPaymentResult> {
    const settingsService = new SettingsService();
    const paymentConfig = await settingsService.getPaymentConfig();
    const finalPlatformFee = platformFee ?? paymentConfig.platformFee;

    // For independent owners, agency fee is 0
    return this.calculateSplit({
      totalAmount,
      platformFee: finalPlatformFee,
      agencyFee: 0,
    });
  }

  /**
   * Calculate split payment by property ID
   * Checks property-specific fee first, then falls back to agency fee
   */
  static async calculateSplitByPropertyId(propertyId: string, totalAmount: number, platformFee?: number): Promise<SplitPaymentResult> {
    // Fetch the property to get its specific fee and agency
    const property = await prisma.property.findUnique({
      where: { id: BigInt(propertyId) },
      select: {
        agencyFee: true, // Property-specific fee (nullable)
        agencyId: true,
        agency: {
          select: {
            agencyFee: true, // Agency default fee
          },
        },
      },
    });

    if (!property) {
      throw new Error(`Property not found: ${propertyId}`);
    }

    const settingsService = new SettingsService();
    const paymentConfig = await settingsService.getPaymentConfig();
    const finalPlatformFee = platformFee ?? paymentConfig.platformFee;

    // Priority: property-specific fee > agency fee > default fee
    let finalAgencyFee: number;
    if (property.agencyFee !== null && property.agencyFee !== undefined) {
      // Use property-specific fee set by manager
      finalAgencyFee = property.agencyFee;
    } else if (property.agency && property.agency.agencyFee !== null && property.agency.agencyFee !== undefined) {
      // Fall back to agency fee set by admin
      finalAgencyFee = property.agency.agencyFee;
    } else {
      // Fall back to default fee from settings
      finalAgencyFee = paymentConfig.agencyFee;
    }

    return this.calculateSplit({
      totalAmount,
      platformFee: finalPlatformFee,
      agencyFee: finalAgencyFee,
    });
  }

  /**
   * Calculate split payment by agency ID
   * Fetches the specific agency fee from the Agency model
   */
  static async calculateSplitByAgencyId(agencyId: string, totalAmount: number, platformFee?: number): Promise<SplitPaymentResult> {
    // Fetch the agency to get its specific fee
    const agency = await prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { agencyFee: true },
    });

    if (!agency) {
      throw new Error(`Agency not found: ${agencyId}`);
    }

    const settingsService = new SettingsService();
    const paymentConfig = await settingsService.getPaymentConfig();
    const finalPlatformFee = platformFee ?? paymentConfig.platformFee;

    return this.calculateSplit({
      totalAmount,
      platformFee: finalPlatformFee,
      agencyFee: agency.agencyFee,
    });
  }

  /**
   * Calculate late fees and interest
   */
  static calculateLateFees(
    originalAmount: number,
    daysLate: number,
    lateFee: number = 2,      // 2% per day
    maxLateFee: number = 10   // Max 10%
  ): number {
    const lateFeePercent = Math.min(daysLate * lateFee, maxLateFee);
    return (originalAmount * lateFeePercent) / 100;
  }

  /**
   * Calculate interest on late payment
   */
  static calculateInterest(
    amount: number,
    daysLate: number,
    monthlyRate: number = 1  // 1% per month
  ): number {
    const dailyRate = monthlyRate / 30;
    const interest = amount * (dailyRate * daysLate);
    return Number(interest.toFixed(2));
  }
}

