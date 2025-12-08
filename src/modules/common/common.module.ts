import { Module } from '@nestjs/common';
import { TokenGeneratorService } from './services/token-generator.service';
import { PlanEnforcementService } from './services/plan-enforcement.service';
import { MicrotransactionsService } from './services/microtransactions.service';

@Module({
  providers: [TokenGeneratorService, PlanEnforcementService, MicrotransactionsService],
  exports: [TokenGeneratorService, PlanEnforcementService, MicrotransactionsService],
})
export class CommonModule {}
