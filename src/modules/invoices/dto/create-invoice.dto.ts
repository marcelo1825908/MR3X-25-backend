import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';

export enum InvoiceType {
  RENT = 'RENT',
  CONDOMINIUM = 'CONDOMINIUM',
  EXTRA = 'EXTRA',
  FINE = 'FINE',
  PENALTY = 'PENALTY',
  OTHER = 'OTHER',
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CREDIT_CARD = 'CREDIT_CARD',
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Contract ID' })
  @IsString()
  contractId: string;

  @ApiPropertyOptional({ description: 'Property ID' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Agency ID' })
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Owner ID' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Reference month (YYYY-MM format)' })
  @IsOptional()
  @IsString()
  referenceMonth?: string;

  @ApiPropertyOptional({ description: 'Invoice description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: InvoiceType, description: 'Invoice type' })
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @ApiProperty({ description: 'Due date' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ description: 'Original value' })
  @IsNumber()
  originalValue: number;

  @ApiPropertyOptional({ description: 'Fine amount' })
  @IsOptional()
  @IsNumber()
  fine?: number;

  @ApiPropertyOptional({ description: 'Interest amount' })
  @IsOptional()
  @IsNumber()
  interest?: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional({ description: 'Owner amount from split' })
  @IsOptional()
  @IsNumber()
  ownerAmount?: number;

  @ApiPropertyOptional({ description: 'Agency amount from split' })
  @IsOptional()
  @IsNumber()
  agencyAmount?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
