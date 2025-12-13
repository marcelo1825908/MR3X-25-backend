import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '12345678900' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class VerifyEmailRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class VerifyEmailConfirmDto {
  @ApiProperty({ example: 'uuid-request-id' })
  @IsString()
  requestId: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  code: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'newpassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class RequestEmailCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ConfirmEmailCodeDto {
  @ApiProperty({ example: 'uuid-request-id' })
  @IsString()
  requestId: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  code: string;
}

export class CompleteRegisterDto {
  @ApiProperty({ example: 'jwt-registration-token' })
  @IsString()
  registrationToken: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'FREE' })
  @IsString()
  plan: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '12345678900' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ example: '123456/SP-F' })
  @IsOptional()
  @IsString()
  creci?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Rua das Flores, 123' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '01234567' })
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: '123' })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'My Agency' })
  @IsOptional()
  @IsString()
  agencyName?: string;

  @ApiPropertyOptional({ example: '12345678000199' })
  @IsOptional()
  @IsString()
  agencyCnpj?: string;

  @ApiPropertyOptional({ example: '123456-J' })
  @IsOptional()
  @IsString()
  agencyCreci?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  agencyCreciState?: string;

  @ApiPropertyOptional({ example: 'João da Silva' })
  @IsOptional()
  @IsString()
  representativeName?: string;

  @ApiPropertyOptional({ example: '12345678900' })
  @IsOptional()
  @IsString()
  representativeDocument?: string;
}
