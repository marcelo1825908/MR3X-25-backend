import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExtrajudicialNotificationTypeDto, NotificationPriority } from './create-extrajudicial-notification.dto';

export enum ExtrajudicialNotificationStatusDto {
  RASCUNHO = 'RASCUNHO',
  AGUARDANDO_ENVIO = 'AGUARDANDO_ENVIO',
  ENVIADA = 'ENVIADA',
  VISUALIZADA = 'VISUALIZADA',
  RESPONDIDA = 'RESPONDIDA',
  ACEITA = 'ACEITA',
  REJEITADA = 'REJEITADA',
  PRAZO_EXPIRADO = 'PRAZO_EXPIRADO',
  ENCAMINHADA_JUDICIAL = 'ENCAMINHADA_JUDICIAL',
  CANCELADA = 'CANCELADA',
}

export class UpdateExtrajudicialNotificationDto {
  @ApiPropertyOptional({ enum: ExtrajudicialNotificationTypeDto })
  @IsOptional()
  @IsEnum(ExtrajudicialNotificationTypeDto)
  type?: ExtrajudicialNotificationTypeDto;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ enum: ExtrajudicialNotificationStatusDto })
  @IsOptional()
  @IsEnum(ExtrajudicialNotificationStatusDto)
  status?: ExtrajudicialNotificationStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalBasis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  demandedAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  principalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  fineAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  interestAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  correctionAmount?: number;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  deadlineDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  gracePeriodDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consequencesText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SignExtrajudicialNotificationDto {
  @ApiPropertyOptional({ description: 'Creditor signature (base64)' })
  @IsOptional()
  @IsString()
  creditorSignature?: string;

  @ApiPropertyOptional({ description: 'Debtor signature (base64)' })
  @IsOptional()
  @IsString()
  debtorSignature?: string;

  @ApiPropertyOptional({ description: 'Witness 1 signature (base64)' })
  @IsOptional()
  @IsString()
  witness1Signature?: string;

  @ApiPropertyOptional({ description: 'Witness 1 name' })
  @IsOptional()
  @IsString()
  witness1Name?: string;

  @ApiPropertyOptional({ description: 'Witness 1 document' })
  @IsOptional()
  @IsString()
  witness1Document?: string;

  @ApiPropertyOptional({ description: 'Witness 2 signature (base64)' })
  @IsOptional()
  @IsString()
  witness2Signature?: string;

  @ApiPropertyOptional({ description: 'Witness 2 name' })
  @IsOptional()
  @IsString()
  witness2Name?: string;

  @ApiPropertyOptional({ description: 'Witness 2 document' })
  @IsOptional()
  @IsString()
  witness2Document?: string;

  @ApiPropertyOptional({ description: 'Geolocation latitude' })
  @IsOptional()
  @IsNumber()
  geoLat?: number;

  @ApiPropertyOptional({ description: 'Geolocation longitude' })
  @IsOptional()
  @IsNumber()
  geoLng?: number;
}

export class RespondExtrajudicialNotificationDto {
  @ApiPropertyOptional({ description: 'Response text from debtor' })
  @IsOptional()
  @IsString()
  responseText?: string;

  @ApiPropertyOptional({ description: 'Whether debtor accepts the notification' })
  @IsOptional()
  @IsBoolean()
  accepted?: boolean;
}

export class ResolveExtrajudicialNotificationDto {
  @ApiPropertyOptional({ description: 'Resolution method' })
  @IsOptional()
  @IsString()
  resolutionMethod?: string;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class ForwardToJudicialDto {
  @ApiPropertyOptional({ description: 'Judicial process number' })
  @IsOptional()
  @IsString()
  judicialProcessNumber?: string;

  @ApiPropertyOptional({ description: 'Court name' })
  @IsOptional()
  @IsString()
  judicialCourt?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  judicialNotes?: string;
}

export class SendNotificationDto {
  @ApiPropertyOptional({ description: 'Method of sending: EMAIL, WHATSAPP, REGISTERED_MAIL, IN_PERSON' })
  @IsOptional()
  @IsString()
  sentVia?: string;
}
