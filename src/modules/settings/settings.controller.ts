import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService, PaymentConfig } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('payment-config')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get payment configuration (platform and agency fees)' })
  async getPaymentConfig(): Promise<PaymentConfig> {
    return this.settingsService.getPaymentConfig();
  }

  @Put('payment-config')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update payment configuration' })
  async updatePaymentConfig(@Body() config: PaymentConfig): Promise<PaymentConfig> {
    return this.settingsService.updatePaymentConfig(config);
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all settings' })
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @Get(':key')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get setting by key' })
  async getSetting(@Param('key') key: string) {
    return this.settingsService.getSetting(key);
  }

  @Put(':key')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update setting by key' })
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: string; description?: string },
  ) {
    return this.settingsService.updateSetting(key, body.value, body.description);
  }
}
