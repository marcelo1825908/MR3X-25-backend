import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateAsaasWalletDto {
  @ApiProperty({ description: 'Asaas account ID' })
  @IsString()
  asaasAccountId: string;

  @ApiProperty({ description: 'Asaas wallet ID' })
  @IsString()
  asaasWalletId: string;

  @ApiProperty({ description: 'Owner name' })
  @IsString()
  ownerName: string;

  @ApiProperty({ description: 'Owner document (CPF/CNPJ)' })
  @IsString()
  ownerDocument: string;

  @ApiPropertyOptional({ description: 'Owner email' })
  @IsOptional()
  @IsString()
  ownerEmail?: string;

  @ApiPropertyOptional({ description: 'Owner phone' })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiPropertyOptional({ description: 'Agency ID' })
  @IsOptional()
  @IsNumber()
  agencyId?: number;

  @ApiPropertyOptional({ description: 'User ID' })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({ description: 'Bank code' })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional({ description: 'Bank name' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ description: 'Bank branch' })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({ description: 'Bank account number' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ description: 'Bank account type (CHECKING/SAVINGS)' })
  @IsOptional()
  @IsString()
  bankAccountType?: string;

  @ApiPropertyOptional({ description: 'PIX key' })
  @IsOptional()
  @IsString()
  pixKey?: string;
}

export class UpdateAsaasWalletDto extends PartialType(CreateAsaasWalletDto) {}

export class LinkAsaasAccountDto {
  @ApiProperty({ description: 'API key for the Asaas account to link' })
  @IsString()
  apiKey: string;

  @ApiPropertyOptional({ description: 'Agency ID' })
  @IsOptional()
  @IsNumber()
  agencyId?: number;

  @ApiPropertyOptional({ description: 'User ID' })
  @IsOptional()
  @IsNumber()
  userId?: number;
}

export class VerifyWalletDto {
  @ApiPropertyOptional({ description: 'Verification notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AsaasConnectionStatusDto {
  @ApiProperty({ description: 'Whether Asaas is connected' })
  isConnected: boolean;

  @ApiPropertyOptional({ description: 'Asaas account ID' })
  accountId?: string;

  @ApiPropertyOptional({ description: 'Account name' })
  accountName?: string;

  @ApiPropertyOptional({ description: 'Account email' })
  accountEmail?: string;

  @ApiPropertyOptional({ description: 'Account status' })
  accountStatus?: string;

  @ApiPropertyOptional({ description: 'Last webhook received at' })
  lastWebhookAt?: Date;

  @ApiPropertyOptional({ description: 'Connection error' })
  error?: string;
}
