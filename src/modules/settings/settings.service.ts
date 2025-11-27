import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export interface PaymentConfig {
  platformFee: number;
  agencyFee: number;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getPaymentConfig(): Promise<PaymentConfig> {
    // Get platform fee from settings
    const platformFeeSetting = await this.prisma.platformSettings.findUnique({
      where: { key: 'platform_fee' },
    });

    // Get default agency fee from settings
    const agencyFeeSetting = await this.prisma.platformSettings.findUnique({
      where: { key: 'default_agency_fee' },
    });

    return {
      platformFee: platformFeeSetting ? parseFloat(platformFeeSetting.value) : 2.0,
      agencyFee: agencyFeeSetting ? parseFloat(agencyFeeSetting.value) : 8.0,
    };
  }

  async updatePaymentConfig(config: PaymentConfig): Promise<PaymentConfig> {
    // Update or create platform fee
    await this.prisma.platformSettings.upsert({
      where: { key: 'platform_fee' },
      update: { value: config.platformFee.toString() },
      create: {
        key: 'platform_fee',
        value: config.platformFee.toString(),
        description: 'Platform fee percentage (MR3X commission)',
      },
    });

    // Update or create default agency fee
    await this.prisma.platformSettings.upsert({
      where: { key: 'default_agency_fee' },
      update: { value: config.agencyFee.toString() },
      create: {
        key: 'default_agency_fee',
        value: config.agencyFee.toString(),
        description: 'Default agency fee percentage',
      },
    });

    return config;
  }

  async getSetting(key: string): Promise<{ key: string; value: string; description?: string } | null> {
    const setting = await this.prisma.platformSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    return {
      key: setting.key,
      value: setting.value,
      description: setting.description || undefined,
    };
  }

  async updateSetting(key: string, value: string, description?: string): Promise<{ key: string; value: string; description?: string }> {
    const setting = await this.prisma.platformSettings.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });

    return {
      key: setting.key,
      value: setting.value,
      description: setting.description || undefined,
    };
  }

  async getAllSettings(): Promise<Array<{ key: string; value: string; description?: string }>> {
    const settings = await this.prisma.platformSettings.findMany({
      orderBy: { key: 'asc' },
    });

    return settings.map((s) => ({
      key: s.key,
      value: s.value,
      description: s.description || undefined,
    }));
  }
}
