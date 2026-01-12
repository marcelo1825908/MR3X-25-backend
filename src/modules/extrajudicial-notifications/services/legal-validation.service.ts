import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Service for legal validations in extrajudicial notifications
 */
@Injectable()
export class LegalValidationService {
  /**
   * Validate CNJ process number format
   * Official CNJ format: NNNNNNN-DD.AAAA.J.TR.OOOO
   * Example: 0000123-45.2024.8.26.0100
   */
  validateCNJProcessNumber(processNumber: string): boolean {
    if (!processNumber || processNumber.trim() === '') {
      return false;
    }

    // CNJ Regex: \d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}
    const cnjRegex = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
    return cnjRegex.test(processNumber.trim());
  }

  /**
   * Format and validate CNJ process number
   */
  formatCNJProcessNumber(processNumber: string): string {
    if (!processNumber) {
      return '';
    }

    // Remove all non-numeric characters except dots and dashes
    const cleaned = processNumber.replace(/[^\d.-]/g, '');

    // Try to match CNJ format
    if (this.validateCNJProcessNumber(cleaned)) {
      return cleaned;
    }

    // If not in correct format, return as-is but warn
    return processNumber.trim();
  }

  /**
   * Enhance legal basis with mandatory Civil Code references
   */
  enhanceLegalBasis(existingBasis: string, notificationType: string): string {
    const mandatoryBasis = `
Artigos 1.336, inciso IV, e 1.337 do Código Civil Brasileiro (Lei 10.406/2002)
`;

    // If existing basis doesn't mention Civil Code, add it
    if (!existingBasis.includes('Código Civil') && !existingBasis.includes('1.336') && !existingBasis.includes('1.337')) {
      return `${mandatoryBasis.trim()}\n${existingBasis}`.trim();
    }

    return existingBasis;
  }

  /**
   * Validate and format verification URL
   * Must be HTTPS and not localhost
   */
  validateVerificationUrl(url: string): string {
    if (!url) {
      throw new BadRequestException('Verification URL is required');
    }

    // Check if localhost
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      throw new BadRequestException('Verification URL cannot be localhost. Use a public HTTPS domain.');
    }

    // Check if HTTPS
    if (!url.startsWith('https://')) {
      throw new BadRequestException('Verification URL must use HTTPS protocol');
    }

    return url;
  }

  /**
   * Get safe verification URL from environment
   */
  getSafeVerificationUrl(token: string): string {
    const frontendUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL;

    if (!frontendUrl) {
      throw new BadRequestException('FRONTEND_URL or PUBLIC_URL environment variable must be set with HTTPS domain');
    }

    // Remove trailing slash
    const baseUrl = frontendUrl.replace(/\/$/, '');

    // Check if localhost
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      // In development, allow but warn
      console.warn('⚠️ WARNING: Using localhost for verification URL. This should be changed to a public HTTPS domain in production.');
    }

    // Ensure HTTPS in production
    if (process.env.NODE_ENV === 'production' && !baseUrl.startsWith('https://')) {
      throw new BadRequestException('FRONTEND_URL must use HTTPS in production');
    }

    return `${baseUrl}/verify/notification/${token}`;
  }

  /**
   * Validate attorney information if lawyer fees are present
   */
  validateAttorneyInfo(lawyerFees: number | null, attorneyName?: string, attorneyOAB?: string): {
    valid: boolean;
    error?: string;
  } {
    if (lawyerFees && lawyerFees > 0) {
      if (!attorneyName || attorneyName.trim() === '') {
        return {
          valid: false,
          error: 'Attorney name is required when lawyer fees are specified',
        };
      }

      if (!attorneyOAB || attorneyOAB.trim() === '') {
        return {
          valid: false,
          error: 'Attorney OAB number is required when lawyer fees are specified',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Format deadline text to avoid conflicts
   */
  formatDeadlineText(deadlineDays: number, gracePeriodDays?: number | null): string {
    if (gracePeriodDays && gracePeriodDays > 0) {
      return `
Prazo legal: ${deadlineDays} (${this.numberToWords(deadlineDays)}) dias corridos, contados a partir do recebimento desta notificação.
Prazo administrativo de tolerância: ${gracePeriodDays} (${this.numberToWords(gracePeriodDays)}) dias adicionais, a critério do credor.
      `.trim();
    }

    return `
Prazo para cumprimento: ${deadlineDays} (${this.numberToWords(deadlineDays)}) dias corridos, contados a partir do recebimento desta notificação.
    `.trim();
  }

  private numberToWords(num: number): string {
    const words: Record<number, string> = {
      1: 'um',
      2: 'dois',
      3: 'três',
      4: 'quatro',
      5: 'cinco',
      6: 'seis',
      7: 'sete',
      8: 'oito',
      9: 'nove',
      10: 'dez',
      11: 'onze',
      12: 'doze',
      13: 'treze',
      14: 'catorze',
      15: 'quinze',
      20: 'vinte',
      30: 'trinta',
    };

    if (words[num]) {
      return words[num];
    }

    if (num < 20) {
      return `${words[10]} e ${words[num - 10]}`;
    }

    if (num < 100) {
      const tens = Math.floor(num / 10) * 10;
      const ones = num % 10;
      if (ones === 0) {
        return words[tens];
      }
      return `${words[tens]} e ${words[ones]}`;
    }

    return num.toString();
  }
}

