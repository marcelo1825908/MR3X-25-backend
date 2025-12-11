import { Module } from '@nestjs/common';
import { ExtrajudicialNotificationsController } from './extrajudicial-notifications.controller';
import { ExtrajudicialNotificationsService } from './extrajudicial-notifications.service';
import { ExtrajudicialNotificationVerificationController } from './extrajudicial-notification-verification.controller';
import { ExtrajudicialNotificationHashService } from './services/extrajudicial-notification-hash.service';
import { ExtrajudicialNotificationPdfService } from './services/extrajudicial-notification-pdf.service';
import { ExtrajudicialSchedulerService } from './services/extrajudicial-scheduler.service';

@Module({
  controllers: [
    ExtrajudicialNotificationsController,
    ExtrajudicialNotificationVerificationController,
  ],
  providers: [
    ExtrajudicialNotificationsService,
    ExtrajudicialNotificationHashService,
    ExtrajudicialNotificationPdfService,
    ExtrajudicialSchedulerService,
  ],
  exports: [
    ExtrajudicialNotificationsService,
    ExtrajudicialNotificationHashService,
    ExtrajudicialNotificationPdfService,
    ExtrajudicialSchedulerService,
  ],
})
export class ExtrajudicialNotificationsModule {}
