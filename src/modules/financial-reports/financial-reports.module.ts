import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { FinancialReportsService } from './financial-reports.service';
import { FinancialReportsController } from './financial-reports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialReportsController],
  providers: [FinancialReportsService],
  exports: [FinancialReportsService],
})
export class FinancialReportsModule {}

