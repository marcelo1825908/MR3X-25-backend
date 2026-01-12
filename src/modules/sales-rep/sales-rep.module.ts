import { Module } from '@nestjs/common';
import { SalesRepController } from './sales-rep.controller';
import { SalesMessageService } from './sales-message.service';
import { SalesRepService } from './sales-rep.service';
import { CommissionService } from './commission.service';
import { PrismaModule } from '../../config/prisma.module';
import { AsaasModule } from '../asaas/asaas.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, AsaasModule, CommonModule],
  controllers: [SalesRepController],
  providers: [SalesMessageService, SalesRepService, CommissionService],
  exports: [SalesMessageService, SalesRepService, CommissionService],
})
export class SalesRepModule {}
