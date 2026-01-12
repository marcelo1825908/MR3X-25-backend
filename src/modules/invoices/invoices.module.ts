import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { ContractsModule } from '../contracts/contracts.module';
import { TokenGeneratorService } from '../common/services/token-generator.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  imports: [ContractsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, TokenGeneratorService, PrismaService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
