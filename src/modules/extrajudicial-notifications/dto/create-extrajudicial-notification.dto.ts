import { IsNotEmpty, IsOptional, IsString, IsNumber, IsEnum, IsDateString, Min, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExtrajudicialNotificationTypeDto {
  COBRANCA_ALUGUEL = 'COBRANCA_ALUGUEL',
  COBRANCA_CONDOMINIO = 'COBRANCA_CONDOMINIO',
  COBRANCA_IPTU = 'COBRANCA_IPTU',
  COBRANCA_MULTAS = 'COBRANCA_MULTAS',
  COBRANCA_DANOS = 'COBRANCA_DANOS',
  RESCISAO_CONTRATO = 'RESCISAO_CONTRATO',
  DESOCUPACAO = 'DESOCUPACAO',
  DIVERGENCIA_VISTORIA = 'DIVERGENCIA_VISTORIA',
  OUTROS = 'OUTROS',
}

export enum NotificationPriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export class CreateExtrajudicialNotificationDto {
  @ApiPropertyOptional({ description: 'Contract ID associated with this notification' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiProperty({ description: 'Property ID' })
  @IsNotEmpty()
  @IsString()
  propertyId: string;

  @ApiPropertyOptional({ description: 'Agreement ID if related to a failed agreement' })
  @IsOptional()
  @IsString()
  agreementId?: string;

  @ApiPropertyOptional({ description: 'Inspection ID if related to inspection divergence' })
  @IsOptional()
  @IsString()
  inspectionId?: string;

  @ApiPropertyOptional({ description: 'Agency ID' })
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiProperty({ enum: ExtrajudicialNotificationTypeDto })
  @IsNotEmpty()
  @IsEnum(ExtrajudicialNotificationTypeDto)
  type: ExtrajudicialNotificationTypeDto;

  @ApiPropertyOptional({ enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiProperty({ description: 'Creditor user ID' })
  @IsNotEmpty()
  @IsString()
  creditorId: string;

  @ApiProperty({ description: 'Creditor name' })
  @IsNotEmpty()
  @IsString()
  creditorName: string;

  @ApiProperty({ description: 'Creditor document (CPF/CNPJ)' })
  @IsNotEmpty()
  @IsString()
  creditorDocument: string;

  @ApiPropertyOptional({ description: 'Creditor address' })
  @IsOptional()
  @IsString()
  creditorAddress?: string;

  @ApiPropertyOptional({ description: 'Creditor email' })
  @IsOptional()
  @IsEmail()
  creditorEmail?: string;

  @ApiPropertyOptional({ description: 'Creditor phone' })
  @IsOptional()
  @IsString()
  creditorPhone?: string;

  @ApiProperty({ description: 'Debtor user ID' })
  @IsNotEmpty()
  @IsString()
  debtorId: string;

  @ApiProperty({ description: 'Debtor name' })
  @IsNotEmpty()
  @IsString()
  debtorName: string;

  @ApiProperty({ description: 'Debtor document (CPF/CNPJ)' })
  @IsNotEmpty()
  @IsString()
  debtorDocument: string;

  @ApiPropertyOptional({ description: 'Debtor address' })
  @IsOptional()
  @IsString()
  debtorAddress?: string;

  @ApiPropertyOptional({ description: 'Debtor email' })
  @IsOptional()
  @IsEmail()
  debtorEmail?: string;

  @ApiPropertyOptional({ description: 'Debtor phone' })
  @IsOptional()
  @IsString()
  debtorPhone?: string;

  @ApiProperty({ description: 'Notification title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Subject/object of the notification' })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Detailed description' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ description: 'Legal basis (articles, laws)' })
  @IsNotEmpty()
  @IsString()
  legalBasis: string;

  @ApiProperty({ description: 'Action being demanded from debtor' })
  @IsNotEmpty()
  @IsString()
  demandedAction: string;

  @ApiPropertyOptional({ description: 'Original principal amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  principalAmount?: number;

  @ApiPropertyOptional({ description: 'Fine amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fineAmount?: number;

  @ApiPropertyOptional({ description: 'Interest amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  interestAmount?: number;

  @ApiPropertyOptional({ description: 'Monetary correction amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  correctionAmount?: number;

  @ApiPropertyOptional({ description: 'Lawyer fees' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lawyerFees?: number;

  @ApiPropertyOptional({ description: 'Attorney name (required if lawyerFees > 0)' })
  @IsOptional()
  @IsString()
  attorneyName?: string;

  @ApiPropertyOptional({ description: 'Attorney OAB number (required if lawyerFees > 0)' })
  @IsOptional()
  @IsString()
  attorneyOAB?: string;

  @ApiProperty({ description: 'Total amount due' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiProperty({ description: 'Days to comply with the notification' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  deadlineDays: number;

  @ApiPropertyOptional({ description: 'Additional grace period days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gracePeriodDays?: number;

  @ApiPropertyOptional({ description: 'Consequences of non-compliance' })
  @IsOptional()
  @IsString()
  consequencesText?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
