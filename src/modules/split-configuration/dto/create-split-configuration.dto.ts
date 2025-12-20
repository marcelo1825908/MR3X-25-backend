import { IsString, IsOptional, IsNumber, IsEnum, IsArray, ValidateNested, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SplitConfigurationScope {
  GLOBAL = 'GLOBAL',
  PER_CONTRACT = 'PER_CONTRACT',
  PER_PROPERTY = 'PER_PROPERTY',
}

export enum SplitRuleType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum ReceiverType {
  PLATFORM = 'PLATFORM',
  AGENCY = 'AGENCY',
  OWNER = 'OWNER',
}

export enum ChargeType {
  RENT = 'RENT',
  OVERUSE = 'OVERUSE',
  OPERATIONAL_FEE = 'OPERATIONAL_FEE',
  DEPOSIT = 'DEPOSIT',
  PENALTY = 'PENALTY',
}

export class CreateSplitRuleDto {
  @ApiProperty({ description: 'Receiver ID for this rule' })
  @IsNumber()
  receiverId: number;

  @ApiProperty({ enum: SplitRuleType, description: 'Rule type (PERCENTAGE or FIXED)' })
  @IsEnum(SplitRuleType)
  ruleType: SplitRuleType;

  @ApiProperty({ description: 'Value (percentage 0-100 or fixed amount)' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ description: 'Minimum amount constraint' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount constraint' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumAmount?: number;

  @ApiPropertyOptional({ enum: ChargeType, description: 'Charge type filter (null = all)' })
  @IsOptional()
  @IsEnum(ChargeType)
  chargeType?: ChargeType;

  @ApiPropertyOptional({ description: 'Priority order' })
  @IsOptional()
  @IsNumber()
  priority?: number;
}

export class CreateSplitReceiverDto {
  @ApiProperty({ enum: ReceiverType, description: 'Receiver type' })
  @IsEnum(ReceiverType)
  receiverType: ReceiverType;

  @ApiProperty({ description: 'Receiver name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'CPF/CNPJ document' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ description: 'User ID (for OWNER type)' })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({ description: 'Agency ID (for AGENCY type)' })
  @IsOptional()
  @IsNumber()
  agencyId?: number;

  @ApiPropertyOptional({ description: 'Asaas wallet ID' })
  @IsOptional()
  @IsNumber()
  walletId?: number;

  @ApiPropertyOptional({ description: 'Lock this receiver (admin only)' })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiPropertyOptional({ description: 'Rules for this receiver', type: [CreateSplitRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSplitRuleDto)
  rules?: CreateSplitRuleDto[];
}

export class CreateSplitConfigurationDto {
  @ApiProperty({ description: 'Configuration name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Configuration description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SplitConfigurationScope, description: 'Configuration scope' })
  @IsOptional()
  @IsEnum(SplitConfigurationScope)
  scope?: SplitConfigurationScope;

  @ApiPropertyOptional({ description: 'Agency ID (for agency configurations)' })
  @IsOptional()
  @IsNumber()
  agencyId?: number;

  @ApiPropertyOptional({ description: 'Owner ID (for independent owner configurations)' })
  @IsOptional()
  @IsNumber()
  ownerId?: number;

  @ApiPropertyOptional({ description: 'Contract ID (for PER_CONTRACT scope)' })
  @IsOptional()
  @IsNumber()
  contractId?: number;

  @ApiPropertyOptional({ description: 'Property ID (for PER_PROPERTY scope)' })
  @IsOptional()
  @IsNumber()
  propertyId?: number;

  @ApiPropertyOptional({ description: 'Effective date for this configuration' })
  @IsOptional()
  @IsString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Change reason (for audit)' })
  @IsOptional()
  @IsString()
  changeReason?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Receivers configuration', type: [CreateSplitReceiverDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSplitReceiverDto)
  receivers?: CreateSplitReceiverDto[];
}
