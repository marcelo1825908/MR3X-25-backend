import { Injectable } from '@nestjs/common';
import { PaymentReminderSchedulerService } from './services/payment-reminder-scheduler.service';
import { PaymentReminderMessageService } from './services/payment-reminder-message.service';
import { PaymentReminderTemplateService, ReminderStage, MessageChannel } from './services/payment-reminder-template.service';

@Injectable()
export class PaymentRemindersService {
  constructor(
    private readonly schedulerService: PaymentReminderSchedulerService,
    private readonly messageService: PaymentReminderMessageService,
    private readonly templateService: PaymentReminderTemplateService,
  ) {}

  /**
   * Get reminder statistics
   */
  async getStatistics() {
    const result = await this.schedulerService.processAllReminders();
    return result;
  }

  /**
   * Manually trigger reminder
   */
  async triggerReminder(
    contractId: string,
    stage?: ReminderStage,
    channels?: MessageChannel[],
  ) {
    return this.schedulerService.triggerReminderForContract(contractId, stage, channels);
  }

  /**
   * Get available templates
   */
  getTemplates() {
    return {
      stages: Object.values(ReminderStage),
      channels: Object.values(MessageChannel),
    };
  }
}

