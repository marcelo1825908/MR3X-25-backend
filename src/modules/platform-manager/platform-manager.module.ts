import { Module } from '@nestjs/common';
import { PlatformManagerController } from './platform-manager.controller';
import { PlatformManagerService } from './platform-manager.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  controllers: [PlatformManagerController],
  providers: [PlatformManagerService, PrismaService],
})
export class PlatformManagerModule {}
