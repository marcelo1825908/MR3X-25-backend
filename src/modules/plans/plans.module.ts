import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlanEnforcementService } from './plan-enforcement.service';
import { MicrotransactionBillingService } from './microtransaction-billing.service';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [AsaasModule],
  controllers: [PlansController],
  providers: [PlansService, PlanEnforcementService, MicrotransactionBillingService],
  exports: [PlansService, PlanEnforcementService, MicrotransactionBillingService],
})
export class PlansModule {}
