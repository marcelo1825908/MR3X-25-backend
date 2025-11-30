import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, IsDateString, IsEnum } from 'class-validator';

export enum InspectionType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
  PERIODIC = 'PERIODIC',
}

export enum InspectionStatus {
  RASCUNHO = 'RASCUNHO',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  AGUARDANDO_ASSINATURA = 'AGUARDANDO_ASSINATURA',
  CONCLUIDA = 'CONCLUIDA',
  APROVADA = 'APROVADA',
  REJEITADA = 'REJEITADA',
}

export enum ItemCondition {
  OK = 'OK',
  DANIFICADO = 'DANIFICADO',
  AUSENTE = 'AUSENTE',
  REPARAR = 'REPARAR',
}

export enum ResponsibleParty {
  INQUILINO = 'INQUILINO',
  PROPRIETARIO = 'PROPRIETARIO',
  AGENCIA = 'AGENCIA',
}

export class InspectionItemDto {
  @ApiProperty()
  @IsString()
  room: string;

  @ApiProperty()
  @IsString()
  item: string;

  @ApiProperty({ enum: ItemCondition })
  @IsEnum(ItemCondition)
  condition: ItemCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  needsRepair?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  repairCost?: number;

  @ApiPropertyOptional({ enum: ResponsibleParty })
  @IsOptional()
  @IsEnum(ResponsibleParty)
  responsible?: ResponsibleParty;
}

export class CreateInspectionDto {
  @ApiProperty({ description: 'Property ID' })
  @IsString()
  propertyId: string;

  @ApiPropertyOptional({ description: 'Contract ID' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: 'Agency ID' })
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiProperty({ enum: InspectionType, description: 'Type of inspection' })
  @IsEnum(InspectionType)
  type: InspectionType;

  @ApiProperty({ description: 'Inspection date' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Scheduled date' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiProperty({ description: 'Inspector user ID' })
  @IsString()
  inspectorId: string;

  @ApiPropertyOptional({ description: 'Rooms data as JSON' })
  @IsOptional()
  @IsString()
  rooms?: string;

  @ApiPropertyOptional({ description: 'Photos as JSON array' })
  @IsOptional()
  @IsString()
  photos?: string;

  @ApiPropertyOptional({ description: 'General notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'GPS coordinates or address' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Inspection items' })
  @IsOptional()
  @IsArray()
  items?: InspectionItemDto[];
}
