import { Module } from '@nestjs/common';
import { PaymentRemindersController } from './payment-reminders.controller';
import { PaymentRemindersService } from './payment-reminders.service';
import { PaymentReminderSchedulerService } from './services/payment-reminder-scheduler.service';
import { PaymentReminderMessageService } from './services/payment-reminder-message.service';
import { PaymentReminderTemplateService } from './services/payment-reminder-template.service';
import { PaymentReminderVariableService } from './services/payment-reminder-variable.service';

@Module({
  controllers: [PaymentRemindersController],
  providers: [
    PaymentRemindersService,
    PaymentReminderSchedulerService,
    PaymentReminderMessageService,
    PaymentReminderTemplateService,
    PaymentReminderVariableService,
  ],
  exports: [
    PaymentRemindersService,
    PaymentReminderSchedulerService,
    PaymentReminderMessageService,
    PaymentReminderTemplateService,
    PaymentReminderVariableService,
  ],
})
export class PaymentRemindersModule {}

