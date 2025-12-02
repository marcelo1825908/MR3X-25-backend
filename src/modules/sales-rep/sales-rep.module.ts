import { Module } from '@nestjs/common';
import { SalesRepController } from './sales-rep.controller';
import { SalesMessageService } from './sales-message.service';
import { PrismaModule } from '../../config/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SalesRepController],
  providers: [SalesMessageService],
  exports: [SalesMessageService],
})
export class SalesRepModule {}
