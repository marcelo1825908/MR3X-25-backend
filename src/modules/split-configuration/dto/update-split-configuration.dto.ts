import { PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSplitConfigurationDto, CreateSplitReceiverDto, CreateSplitRuleDto } from './create-split-configuration.dto';

export enum SplitConfigurationStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export class UpdateSplitConfigurationDto extends PartialType(CreateSplitConfigurationDto) {
  @ApiPropertyOptional({ enum: SplitConfigurationStatus, description: 'Configuration status' })
  @IsOptional()
  @IsEnum(SplitConfigurationStatus)
  status?: SplitConfigurationStatus;
}

export class UpdateSplitReceiverDto extends PartialType(CreateSplitReceiverDto) {}

export class UpdateSplitRuleDto extends PartialType(CreateSplitRuleDto) {
  @ApiPropertyOptional({ description: 'Rule active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ActivateConfigurationDto {
  @ApiPropertyOptional({ description: 'Reason for activation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DeactivateConfigurationDto {
  @ApiPropertyOptional({ description: 'Reason for deactivation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ValidateConfigurationDto {
  @ApiPropertyOptional({ description: 'Validation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
