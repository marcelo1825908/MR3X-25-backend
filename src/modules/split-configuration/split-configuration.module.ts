import { Module } from '@nestjs/common';
import { SplitConfigurationController } from './split-configuration.controller';
import { SplitConfigurationService } from './split-configuration.service';

@Module({
  controllers: [SplitConfigurationController],
  providers: [SplitConfigurationService],
  exports: [SplitConfigurationService],
})
export class SplitConfigurationModule {}
