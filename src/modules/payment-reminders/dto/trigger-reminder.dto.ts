import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsArray } from 'class-validator';
import { ReminderStage, MessageChannel } from '../services/payment-reminder-template.service';

export class TriggerReminderDto {
  @ApiPropertyOptional({ enum: ReminderStage, description: 'Reminder stage' })
  @IsOptional()
  @IsEnum(ReminderStage)
  stage?: ReminderStage;

  @ApiPropertyOptional({ 
    description: 'Channels to send (comma-separated: EMAIL, SMS, WHATSAPP)',
    example: 'EMAIL,WHATSAPP'
  })
  @IsOptional()
  channels?: string;
}

