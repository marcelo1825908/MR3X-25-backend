import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors/AppError';
import { UpdateSettingDTO, UpdatePaymentConfigDTO } from './settings.dto';

export interface PaymentConfig {
  platformFee: number;
  agencyFee: number;
}

export class SettingsService {
  async getSetting(key: string): Promise<string | null> {
    try {
      // Check if platformSettings exists in Prisma client
      if (!prisma.platformSettings) {
        console.warn('PlatformSettings model not found in Prisma client. Please run: npx prisma generate');
        return null;
      }
      
      const setting = await prisma.platformSettings.findUnique({
        where: { key },
      });
      return setting?.value || null;
    } catch (error: any) {
      console.error('Error in getSetting:', error);
      // If table doesn't exist yet or model not in client, return null (will use defaults)
      if (
        error.message?.includes('does not exist') || 
        error.code === 'P2021' ||
        error.message?.includes('platformSettings') ||
        error.message?.includes('is not a function')
      ) {
        console.warn('PlatformSettings not available, using defaults');
        return null;
      }
      throw error;
    }
  }

  async setSetting(key: string, value: string, description?: string): Promise<void> {
    try {
      // Check if platformSettings exists in Prisma client
      if (!prisma.platformSettings) {
        throw new Error('PlatformSettings model not found. Please restart the server after running: npx prisma generate');
      }
      
      await prisma.platformSettings.upsert({
        where: { key },
        update: {
          value,
          description,
          updatedAt: new Date(),
        },
        create: {
          key,
          value,
          description,
        },
      });
    } catch (error: any) {
      console.error('Error in setSetting:', error);
      // If table doesn't exist yet, log warning but don't fail
      if (
        error.message?.includes('does not exist') || 
        error.code === 'P2021' ||
        error.message?.includes('platformSettings') ||
        error.message?.includes('is not a function')
      ) {
        console.warn('PlatformSettings not available. Please run: npx prisma generate and restart server');
        throw new Error('Settings table not found. Please contact administrator.');
      }
      throw error;
    }
  }

  async getPaymentConfig(): Promise<PaymentConfig> {
    const platformFeeStr = await this.getSetting('payment.platformFee');
    const agencyFeeStr = await this.getSetting('payment.agencyFee');

    return {
      platformFee: platformFeeStr ? parseFloat(platformFeeStr) : 2.0, // Default 2%
      agencyFee: agencyFeeStr ? parseFloat(agencyFeeStr) : 8.0, // Default 8%
    };
  }

  async updatePaymentConfig(data: UpdatePaymentConfigDTO): Promise<PaymentConfig> {
    await this.setSetting('payment.platformFee', data.platformFee.toString(), 'MR3X Platform fee percentage');
    await this.setSetting('payment.agencyFee', data.agencyFee.toString(), 'Agency commission fee percentage');

    return this.getPaymentConfig();
  }

  async getAllSettings(): Promise<Record<string, string>> {
    try {
      // Check if platformSettings exists in Prisma client
      if (!prisma.platformSettings) {
        console.warn('PlatformSettings model not found in Prisma client');
        return {};
      }
      
      const settings = await prisma.platformSettings.findMany();
      const result: Record<string, string> = {};
      settings.forEach(setting => {
        result[setting.key] = setting.value;
      });
      return result;
    } catch (error: any) {
      console.error('Error in getAllSettings:', error);
      // If table doesn't exist yet, return empty object
      if (
        error.message?.includes('does not exist') || 
        error.code === 'P2021' ||
        error.message?.includes('platformSettings') ||
        error.message?.includes('is not a function')
      ) {
        return {};
      }
      throw error;
    }
  }
}

