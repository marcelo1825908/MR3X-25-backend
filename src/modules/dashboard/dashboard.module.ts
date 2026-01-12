import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ApiConsumptionService } from './api-consumption.service';
import { ApiConsumptionCronService } from './api-consumption-cron.service';
import { PrismaService } from '../../config/prisma.service';
import { TenantAnalysisModule } from '../tenant-analysis/tenant-analysis.module';

@Module({
  imports: [TenantAnalysisModule],
  controllers: [DashboardController],
  providers: [DashboardService, ApiConsumptionService, ApiConsumptionCronService, PrismaService],
  exports: [ApiConsumptionService],
})
export class DashboardModule {}
