import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { InvoiceStatus, PaymentMethod } from './create-invoice.dto';

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ description: 'Invoice description' })
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ enum: InvoiceStatus, description: 'Invoice status' })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResendInvoiceDto {
  @ApiPropertyOptional({ description: 'Email to send the invoice to' })
  @IsOptional()
  @IsString()
  email?: string;
}

export class MarkAsPaidDto {
  @ApiPropertyOptional({ description: 'Payment method used' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Paid value' })
  @IsOptional()
  @IsNumber()
  paidValue?: number;

  @ApiPropertyOptional({ description: 'Payment date' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ description: 'Notes about the payment' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelInvoiceDto {
  @ApiPropertyOptional({ description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  reason?: string;
}
