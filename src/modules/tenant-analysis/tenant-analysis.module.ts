import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantAnalysisController } from './tenant-analysis.controller';
import { TenantAnalysisService } from './tenant-analysis.service';
import { CellereService } from './integrations/cellere.service';
import { InfoSimplesService } from './integrations/infosimples.service';
import { PrismaModule } from '../../config/prisma.module';
import { BillingCycleModule } from '../billing-cycle/billing-cycle.module';

@Module({
  imports: [PrismaModule, ConfigModule, forwardRef(() => BillingCycleModule)],
  controllers: [TenantAnalysisController],
  providers: [TenantAnalysisService, CellereService, InfoSimplesService],
  exports: [TenantAnalysisService, CellereService, InfoSimplesService],
})
export class TenantAnalysisModule {}
