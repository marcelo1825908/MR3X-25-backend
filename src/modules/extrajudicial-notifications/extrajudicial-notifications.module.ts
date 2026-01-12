import { Module } from '@nestjs/common';
import { ExtrajudicialNotificationsController } from './extrajudicial-notifications.controller';
import { ExtrajudicialNotificationsService } from './extrajudicial-notifications.service';
import { ExtrajudicialNotificationVerificationController } from './extrajudicial-notification-verification.controller';
import { ExtrajudicialNotificationHashService } from './services/extrajudicial-notification-hash.service';
import { ExtrajudicialNotificationPdfService } from './services/extrajudicial-notification-pdf.service';
import { ExtrajudicialSchedulerService } from './services/extrajudicial-scheduler.service';
import { LegalValidationService } from './services/legal-validation.service';
import { AsaasModule } from '../asaas/asaas.module';
import { AsaasPaymentService } from '../asaas/asaas-payment.service';

@Module({
  imports: [AsaasModule],
  controllers: [
    ExtrajudicialNotificationsController,
    ExtrajudicialNotificationVerificationController,
  ],
  providers: [
    ExtrajudicialNotificationsService,
    ExtrajudicialNotificationHashService,
    ExtrajudicialNotificationPdfService,
    ExtrajudicialSchedulerService,
    LegalValidationService,
  ],
  exports: [
    ExtrajudicialNotificationsService,
    ExtrajudicialNotificationHashService,
    ExtrajudicialNotificationPdfService,
    ExtrajudicialSchedulerService,
    LegalValidationService,
  ],
})
export class ExtrajudicialNotificationsModule {}
