import { Module } from '@nestjs/common';
import { BillingCycleController } from './billing-cycle.controller';
import { BillingCycleService } from './billing-cycle.service';
import { AsaasModule } from '../asaas/asaas.module';
import { SplitConfigurationModule } from '../split-configuration/split-configuration.module';

@Module({
  imports: [AsaasModule, SplitConfigurationModule],
  controllers: [BillingCycleController],
  providers: [BillingCycleService],
  exports: [BillingCycleService],
})
export class BillingCycleModule {}
