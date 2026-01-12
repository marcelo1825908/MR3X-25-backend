import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, IsArray, Min, Max } from 'class-validator';

export enum AgreementType {
  PAYMENT_SETTLEMENT = 'PAYMENT_SETTLEMENT',
  DAMAGE_COMPENSATION = 'DAMAGE_COMPENSATION',
  FINE_AGREEMENT = 'FINE_AGREEMENT',
  MOVE_OUT = 'MOVE_OUT',
  CONTRACT_ADJUSTMENT = 'CONTRACT_ADJUSTMENT',
  OTHER = 'OTHER',
}

export enum AgreementStatus {
  RASCUNHO = 'RASCUNHO',
  AGUARDANDO_ASSINATURA = 'AGUARDANDO_ASSINATURA',
  ASSINADO = 'ASSINADO',
  CONCLUIDO = 'CONCLUIDO',
  REJEITADO = 'REJEITADO',
  CANCELADO = 'CANCELADO',
}

export class CreateAgreementDto {
  @ApiPropertyOptional({ description: 'Contract ID (optional)' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiProperty({ description: 'Property ID' })
  @IsString()
  propertyId: string;

  @ApiPropertyOptional({ description: 'Agency ID' })
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiProperty({ enum: AgreementType, description: 'Type of agreement' })
  @IsEnum(AgreementType)
  type: AgreementType;

  @ApiProperty({ description: 'Agreement title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Agreement description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Full agreement content/terms' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Template ID used' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Owner ID' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Original amount' })
  @IsOptional()
  @IsNumber()
  originalAmount?: number;

  @ApiPropertyOptional({ description: 'Negotiated amount' })
  @IsOptional()
  @IsNumber()
  negotiatedAmount?: number;

  @ApiPropertyOptional({ description: 'Fine amount' })
  @IsOptional()
  @IsNumber()
  fineAmount?: number;

  @ApiPropertyOptional({ description: 'Interest percent (monthly percentage, e.g., 1 for 1% per month)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestPercent?: number;

  @ApiPropertyOptional({ description: 'Interest amount (calculated automatically if interestPercent is provided)' })
  @IsOptional()
  @IsNumber()
  interestAmount?: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Number of installments' })
  @IsOptional()
  @IsNumber()
  installments?: number;

  @ApiPropertyOptional({ description: 'Value per installment' })
  @IsOptional()
  @IsNumber()
  installmentValue?: number;

  @ApiPropertyOptional({ description: 'Effective date' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'New due date (for payment agreements)' })
  @IsOptional()
  @IsDateString()
  newDueDate?: string;

  @ApiPropertyOptional({ description: 'Move out date (for move-out agreements)' })
  @IsOptional()
  @IsDateString()
  moveOutDate?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Attachment URLs (JSON array)' })
  @IsOptional()
  @IsString()
  attachments?: string;
}
