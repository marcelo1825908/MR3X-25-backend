import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { AgreementType, AgreementStatus } from './create-agreement.dto';

export class UpdateAgreementDto {
  @ApiPropertyOptional({ description: 'Contract ID' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ enum: AgreementType, description: 'Type of agreement' })
  @IsOptional()
  @IsEnum(AgreementType)
  type?: AgreementType;

  @ApiPropertyOptional({ description: 'Agreement title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Agreement description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Full agreement content/terms' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Owner ID' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  // Financial terms
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

  // Dates
  @ApiPropertyOptional({ description: 'Effective date' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'New due date' })
  @IsOptional()
  @IsDateString()
  newDueDate?: string;

  @ApiPropertyOptional({ description: 'Move out date' })
  @IsOptional()
  @IsDateString()
  moveOutDate?: string;

  @ApiPropertyOptional({ enum: AgreementStatus, description: 'Agreement status' })
  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Attachment URLs (JSON array)' })
  @IsOptional()
  @IsString()
  attachments?: string;

  // Asaas integration
  @ApiPropertyOptional({ description: 'Asaas payment ID' })
  @IsOptional()
  @IsString()
  asaasPaymentId?: string;

  @ApiPropertyOptional({ description: 'Asaas payment link' })
  @IsOptional()
  @IsString()
  asaasPaymentLink?: string;

  @ApiPropertyOptional({ description: 'Payment status' })
  @IsOptional()
  @IsString()
  paymentStatus?: string;
}

export class SignAgreementDto {
  @ApiPropertyOptional({ description: 'Tenant signature (base64)' })
  @IsOptional()
  @IsString()
  tenantSignature?: string;

  @ApiPropertyOptional({ description: 'Owner signature (base64)' })
  @IsOptional()
  @IsString()
  ownerSignature?: string;

  @ApiPropertyOptional({ description: 'Agency signature (base64)' })
  @IsOptional()
  @IsString()
  agencySignature?: string;
}

export class ApproveRejectAgreementDto {
  @ApiPropertyOptional({ description: 'Rejection reason (required when rejecting)' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
