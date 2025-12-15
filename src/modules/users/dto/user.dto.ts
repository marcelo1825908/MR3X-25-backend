import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'password123', minLength: 6, description: 'If not provided, a random password will be generated' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'FREE' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({ example: '12345678900' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ example: 'Rua Example, 123' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '01001-000' })
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Manager/Supervisor user ID' })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userType?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Brasileira' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ example: 'Solteiro(a)' })
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiPropertyOptional({ example: 'Empresário' })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional({ example: '00.000.000-0' })
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional({ example: 'Banco do Brasil' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '1234-5' })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional({ example: '12345-6' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'email@example.com' })
  @IsOptional()
  @IsString()
  pixKey?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class CreateTenantDto {
  @ApiProperty({ example: 'tenant@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'INQUILINO' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'FREE' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({ example: '12345678900' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agencyId?: string;

  @ApiPropertyOptional({ example: 'Rua Example, 123' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Apto 101' })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiPropertyOptional({ example: '01001-000' })
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Brasileira' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ example: 'Solteiro(a)' })
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiPropertyOptional({ example: 'Engenheiro' })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional({ example: '00.000.000-0' })
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional({ example: 'Empresa XYZ' })
  @IsOptional()
  @IsString()
  employerName?: string;

  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '11999998888' })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userType?: string;

  @ApiPropertyOptional({ description: 'Broker ID to link tenant to a broker' })
  @IsOptional()
  @IsString()
  brokerId?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'tenant@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '12345678900' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'newpassword123', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Rua Example, 123' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '01001-000' })
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Brasileira' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ example: 'Solteiro(a)' })
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiPropertyOptional({ example: 'Engenheiro' })
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional({ example: '00.000.000-0' })
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional({ description: 'Broker ID to link tenant to a broker' })
  @IsOptional()
  @IsString()
  brokerId?: string;
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

export class UpdateProfileDto {
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

  @ApiPropertyOptional({ example: 'Rua Example, 123' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '01310-100' })
  @IsOptional()
  @IsString()
  cep?: string;

  @ApiPropertyOptional({ example: 'Bela Vista' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;

  // Agency fields (only for AGENCY_ADMIN)
  @ApiPropertyOptional({ example: 'My Agency Name' })
  @IsOptional()
  @IsString()
  agencyName?: string;

  @ApiPropertyOptional({ example: '123456/SP', description: 'User CRECI number with state, e.g., 123456/SP' })
  @IsOptional()
  @IsString()
  creci?: string;

  @ApiPropertyOptional({ example: '00.000.000/0000-00' })
  @IsOptional()
  @IsString()
  agencyCnpj?: string;

  @ApiPropertyOptional({ example: 'John Representative' })
  @IsOptional()
  @IsString()
  representativeName?: string;

  @ApiPropertyOptional({ example: '000.000.000-00' })
  @IsOptional()
  @IsString()
  representativeDocument?: string;
}
