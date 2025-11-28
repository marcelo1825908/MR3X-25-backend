import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../config/prisma.service';
import { RegisterDto, LoginDto, VerifyEmailRequestDto, VerifyEmailConfirmDto, ForgotPasswordDto, ResetPasswordDto, CompleteRegisterDto } from './dto/auth.dto';
import { UserRole } from '@prisma/client';

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000; // 60 seconds

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        document: dto.document,
        phone: dto.phone,
        role: dto.role || UserRole.PROPRIETARIO,
        plan: 'FREE',
        emailVerified: false,
      },
    });

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(verificationCode, 10);

    await this.prisma.emailVerification.create({
      data: {
        requestId: uuidv4(),
        email: dto.email,
        codeHash,
        purpose: 'register',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    // TODO: Send email with verification code
    console.log(`Verification code for ${dto.email}: ${verificationCode}`);

    return {
      message: 'Registration successful. Please verify your email.',
      userId: user.id.toString(),
      email: user.email,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { agency: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const payload = {
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();

    // Store refresh token
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        emailVerified: user.emailVerified,
        agencyId: user.agencyId?.toString(),
        agencyName: user.agency?.name,
      },
    };
  }

  async verifyEmailRequest(dto: VerifyEmailRequestDto) {
    const email = dto.email.toLowerCase();

    // Cooldown: if a recent record exists, block
    const recent = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        purpose: 'register',
        createdAt: { gt: new Date(Date.now() - EMAIL_CODE_COOLDOWN_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      return {
        requestId: recent.requestId,
        cooldownSeconds: Math.ceil((EMAIL_CODE_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000)
      };
    }

    // Generate new verification code
    const code = this.generateNumericCode();
    const requestId = uuidv4();
    const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);

    await this.prisma.emailVerification.create({
      data: {
        requestId,
        email,
        codeHash: this.hash(code),
        purpose: 'register',
        expiresAt,
      },
    });

    // TODO: Send email with verification code
    console.log(`Verification code for ${email}: ${code}`);

    return { requestId, expiresAt, cooldownSeconds: Math.ceil(EMAIL_CODE_COOLDOWN_MS / 1000) };
  }

  async verifyEmailConfirm(dto: VerifyEmailConfirmDto) {
    const record = await this.prisma.emailVerification.findUnique({
      where: { requestId: dto.requestId },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }

    if (record.attempts >= record.maxAttempts) {
      throw new BadRequestException('Too many attempts');
    }

    const isValid = this.hash(dto.code) === record.codeHash;

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: {
        attempts: record.attempts + 1,
        usedAt: isValid ? new Date() : undefined,
      },
    });

    if (!isValid) {
      throw new BadRequestException('Invalid code');
    }

    // Issue short-lived registration token embedding the verified email
    const payload = {
      sub: '0',
      email: record.email,
      type: 'registration',
    };

    const registrationToken = this.jwtService.sign(payload, { expiresIn: '30m' });

    return { registrationToken, email: record.email, expiresInSeconds: 30 * 60 };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Return success even if email not found (security)
      return { message: 'If the email exists, a reset code has been sent' };
    }

    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(resetCode, 10);

    // Delete old reset codes
    await this.prisma.emailVerification.deleteMany({
      where: { email: dto.email, purpose: 'password-reset' },
    });

    await this.prisma.emailVerification.create({
      data: {
        requestId: uuidv4(),
        email: dto.email,
        codeHash,
        purpose: 'password-reset',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // TODO: Send email with reset code
    console.log(`Password reset code for ${dto.email}: ${resetCode}`);

    return { message: 'If the email exists, a reset code has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        email: dto.email,
        purpose: 'password-reset',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const isCodeValid = await bcrypt.compare(dto.code, verification.codeHash);

    if (!isCodeValid) {
      throw new BadRequestException('Invalid reset code');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { email: dto.email },
      data: { password: hashedPassword },
    });

    // Mark verification as used
    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { user: { email: dto.email } },
      data: { isRevoked: true },
    });

    return { message: 'Password reset successfully' };
  }

  async logout(userId: bigint, token?: string) {
    if (token) {
      await this.prisma.refreshToken.updateMany({
        where: { token, userId },
        data: { isRevoked: true },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: bigint) {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    return { message: 'Logged out from all devices' };
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private generateNumericCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async completeRegistration(dto: CompleteRegisterDto) {
    // Verify registration token by reading email from it
    let email: string | undefined;
    try {
      const payload = JSON.parse(
        Buffer.from(dto.registrationToken.split('.')[1], 'base64').toString()
      );
      email = payload.email;
    } catch {
      throw new BadRequestException('Invalid registration token');
    }

    if (!email) {
      throw new BadRequestException('Invalid registration token');
    }

    // Self-registration is only allowed for AGENCY_ADMIN and INDEPENDENT_OWNER
    // Per MR3X Hierarchy Requirements:
    // - AGENCY_ADMIN: Self-registers and creates their own agency
    // - INDEPENDENT_OWNER: Self-registers as "mini real estate agency"
    // - All other roles must be created by authorized users
    const ALLOWED_SELF_REGISTRATION_ROLES: UserRole[] = [UserRole.AGENCY_ADMIN, UserRole.INDEPENDENT_OWNER];
    if (!ALLOWED_SELF_REGISTRATION_ROLES.includes(dto.role)) {
      throw new BadRequestException(
        `Auto-registro não é permitido para a função ${dto.role}. ` +
        `Apenas Diretor de Agência (AGENCY_ADMIN) e Proprietário Independente (INDEPENDENT_OWNER) podem se auto-registrar.`
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // For AGENCY_ADMIN: Create agency first, then link user to it
    let agencyId: bigint | undefined = undefined;

    if (dto.role === UserRole.AGENCY_ADMIN) {
      if (!dto.agencyName || !dto.agencyCnpj) {
        throw new BadRequestException('Agency name and CNPJ are required for agency owners');
      }

      // Check if agency with this CNPJ already exists
      const cleanCnpj = dto.agencyCnpj.replace(/\D/g, '');
      const existingAgency = await this.prisma.agency.findUnique({
        where: { cnpj: cleanCnpj },
      });

      if (existingAgency) {
        throw new ConflictException('Agency with this CNPJ already exists');
      }

      // Determine plan-based limits
      const planLimits: Record<string, { maxProperties: number; maxUsers: number }> = {
        FREE: { maxProperties: 5, maxUsers: 3 },
        ESSENTIAL: { maxProperties: 50, maxUsers: 10 },
        PROFESSIONAL: { maxProperties: 100, maxUsers: 20 },
        ENTERPRISE: { maxProperties: 500, maxUsers: 100 },
      };

      const limits = planLimits[dto.plan] || planLimits['FREE'];

      // Create agency using user's information
      const agency = await this.prisma.agency.create({
        data: {
          name: dto.agencyName,
          cnpj: cleanCnpj,
          email: email,
          phone: dto.phone || null,
          address: dto.address || null,
          city: dto.city || null,
          state: dto.state || null,
          zipCode: dto.cep || null,
          status: 'ACTIVE',
          plan: dto.plan,
          maxProperties: limits.maxProperties,
          maxUsers: limits.maxUsers,
        },
      });

      agencyId = agency.id;
    }

    // Create user account
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: dto.role,
        plan: dto.plan,
        name: dto.name,
        phone: dto.phone,
        document: dto.document,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        address: dto.address,
        cep: dto.cep,
        neighborhood: dto.neighborhood,
        number: dto.number,
        city: dto.city,
        state: dto.state,
        status: 'ACTIVE',
        emailVerified: true,
        agencyId: agencyId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        name: true,
        createdAt: true,
      },
    });

    return {
      id: user.id.toString(),
      email: user.email,
      role: user.role,
      plan: user.plan,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }

    return null;
  }
}
