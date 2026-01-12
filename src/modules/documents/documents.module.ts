import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../config/prisma.service';
import { TokenGeneratorService } from '../common/services/token-generator.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, PrismaService, TokenGeneratorService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
