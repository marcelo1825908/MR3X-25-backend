import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiConsumptionService } from './api-consumption.service';

@Injectable()
export class ApiConsumptionCronService {
  private readonly logger = new Logger(ApiConsumptionCronService.name);

  constructor(private readonly apiConsumptionService: ApiConsumptionService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyUpdate() {
    this.logger.log('Running daily API consumption update...');
    
    try {
      await this.apiConsumptionService.refreshData();
      this.logger.log('Daily API consumption update completed successfully');
    } catch (error) {
      this.logger.error(`Error in daily API consumption update: ${error}`);
    }
  }

  // Also run at noon as a backup
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async handleBackupUpdate() {
    this.logger.log('Running backup API consumption update...');
    
    try {
      await this.apiConsumptionService.refreshData();
      this.logger.log('Backup API consumption update completed successfully');
    } catch (error) {
      this.logger.error(`Error in backup API consumption update: ${error}`);
    }
  }
}

