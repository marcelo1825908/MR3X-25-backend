import { Module, forwardRef } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PlansModule } from '../plans/plans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PropertiesModule } from '../properties/properties.module';
import { ContractVerificationController, ExternalSigningController } from './contract-verification.controller';
import { ContractHashService } from './services/contract-hash.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { SignatureLinkService } from './services/signature-link.service';
import { ContractCalculationsService } from './contract-calculations.service';
import { ContractValidationService } from './services/contract-validation.service';
import { ContractVerificationService } from './services/contract-verification.service';
import { ContractImmutabilityService } from './services/contract-immutability.service';
import { ContractRulesEngineService } from './services/contract-rules-engine.service';
import { ContractLifecycleService } from './services/contract-lifecycle.service';
import { ContractLegalIntegrationService } from './services/contract-legal-integration.service';
import { ContractLegalFlowService } from './services/contract-legal-flow.service';

@Module({
  imports: [PlansModule, NotificationsModule, forwardRef(() => PropertiesModule)],
  controllers: [
    ContractsController,
    ContractVerificationController,
    ExternalSigningController,
  ],
  providers: [
    ContractsService,
    ContractHashService,
    ContractPdfService,
    SignatureLinkService,
    ContractCalculationsService,
    ContractValidationService,
    ContractVerificationService,
    ContractImmutabilityService,
    ContractRulesEngineService,
    ContractLifecycleService,
    ContractLegalIntegrationService,
    ContractLegalFlowService,
  ],
  exports: [
    ContractsService,
    ContractHashService,
    ContractPdfService,
    SignatureLinkService,
    ContractCalculationsService,
    ContractValidationService,
    ContractVerificationService,
    ContractImmutabilityService,
    ContractRulesEngineService,
    ContractLifecycleService,
    ContractLegalIntegrationService,
    ContractLegalFlowService,
  ],
})
export class ContractsModule {}
