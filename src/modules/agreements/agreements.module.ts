import { Module } from '@nestjs/common';
import { AgreementsController } from './agreements.controller';
import { AgreementsService } from './agreements.service';
import { AgreementPermissionService } from './services/agreement-permission.service';
import { AgreementCalculationService } from './services/agreement-calculation.service';
import { AgreementPdfService } from './services/agreement-pdf.service';
import { AgreementPermissionGuard } from './guards/agreement-permission.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingCycleModule } from '../billing-cycle/billing-cycle.module';

@Module({
  imports: [NotificationsModule, BillingCycleModule],
  controllers: [AgreementsController],
  providers: [
    AgreementsService,
    AgreementPermissionService,
    AgreementCalculationService,
    AgreementPdfService,
    AgreementPermissionGuard,
  ],
  exports: [
    AgreementsService,
    AgreementPermissionService,
    AgreementCalculationService,
    AgreementPdfService,
  ],
})
export class AgreementsModule {}
