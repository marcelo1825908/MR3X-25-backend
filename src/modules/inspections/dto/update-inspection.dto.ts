import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsDateString, IsEnum } from 'class-validator';
import { InspectionType, InspectionStatus, InspectionItemDto } from './create-inspection.dto';

export class UpdateInspectionDto {
  @ApiPropertyOptional({ description: 'Contract ID' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ enum: InspectionType, description: 'Type of inspection' })
  @IsOptional()
  @IsEnum(InspectionType)
  type?: InspectionType;

  @ApiPropertyOptional({ description: 'Inspection date' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Scheduled date' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Inspector user ID' })
  @IsOptional()
  @IsString()
  inspectorId?: string;

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

  @ApiPropertyOptional({ enum: InspectionStatus, description: 'Inspection status' })
  @IsOptional()
  @IsEnum(InspectionStatus)
  status?: InspectionStatus;

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

export class SignInspectionDto {
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

  @ApiPropertyOptional({ description: 'Inspector signature (base64)' })
  @IsOptional()
  @IsString()
  inspectorSignature?: string;
}

export class ApproveRejectInspectionDto {
  @ApiPropertyOptional({ description: 'Rejection reason (required when rejecting)' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
