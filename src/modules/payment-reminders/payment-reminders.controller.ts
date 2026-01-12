import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentRemindersService } from './payment-reminders.service';
import { PaymentReminderTemplateService, ReminderStage, MessageChannel } from './services/payment-reminder-template.service';

@ApiTags('Payment Reminders')
@Controller('payment-reminders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentRemindersController {
  constructor(
    private readonly paymentRemindersService: PaymentRemindersService,
    private readonly templateService: PaymentReminderTemplateService,
  ) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Get payment reminder statistics' })
  async getStatistics() {
    return this.paymentRemindersService.getStatistics();
  }

  @Post('trigger/:contractId')
  @ApiOperation({ summary: 'Manually trigger payment reminder for a contract' })
  @ApiParam({ name: 'contractId', description: 'Contract ID' })
  @ApiQuery({ name: 'stage', required: false, enum: ReminderStage, description: 'Reminder stage' })
  @ApiQuery({ name: 'channels', required: false, description: 'Comma-separated channels (EMAIL, SMS, WHATSAPP)' })
  async triggerReminder(
    @Param('contractId') contractId: string,
    @Query('stage') stage?: ReminderStage,
    @Query('channels') channels?: string,
  ) {
    const channelArray = channels
      ? (channels.split(',').map((c) => c.trim().toUpperCase()) as MessageChannel[])
      : undefined;

    return this.paymentRemindersService.triggerReminder(contractId, stage, channelArray);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get available reminder templates' })
  async getTemplates() {
    return this.paymentRemindersService.getTemplates();
  }
}

