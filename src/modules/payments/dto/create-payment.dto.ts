import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsEnum, IsOptional } from 'class-validator';

export enum PaymentType {
  ALUGUEL = 'ALUGUEL',
  CONDOMINIO = 'CONDOMINIO',
  IPTU = 'IPTU',
  OUTROS = 'OUTROS',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export class CreatePaymentDto {
  @ApiProperty({ description: 'Payment amount', example: 1500.00 })
  @IsNumber()
  @IsPositive()
  valorPago: number;

  @ApiProperty({ description: 'Payment date', example: '2024-01-15' })
  @IsString()
  dataPagamento: string;

  @ApiPropertyOptional({ description: 'Contract ID', example: '1' })
  @IsString()
  @IsOptional()
  contratoId?: string;

  @ApiProperty({ description: 'Property ID', example: '1' })
  @IsString()
  propertyId: string;

  @ApiProperty({ description: 'Payment type', enum: PaymentType, example: PaymentType.ALUGUEL })
  @IsEnum(PaymentType)
  tipo: PaymentType;

  @ApiPropertyOptional({ description: 'Receipt file (base64 encoded)' })
  @IsString()
  @IsOptional()
  comprovante?: string;

  @ApiPropertyOptional({ description: 'Description of the charge' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Due date for the charge', example: '2024-01-15' })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Payment status', enum: PaymentStatus, example: PaymentStatus.PENDING })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Payment method', example: 'PIX' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;
}
