import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../config/prisma.service';
import { PlanEnforcementService } from '../plans/plan-enforcement.service';
import { RegisterDto, LoginDto, VerifyEmailRequestDto, VerifyEmailConfirmDto, ForgotPasswordDto, ResetPasswordDto, CompleteRegisterDto } from './dto/auth.dto';
import { UserRole } from '@prisma/client';

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private planEnforcement: PlanEnforcementService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

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

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(verificationCode, 10);

    await this.prisma.emailVerification.create({
      data: {
        requestId: uuidv4(),
        email: dto.email,
        codeHash,
        purpose: 'register',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    console.log(`Verification code for ${dto.email}: ${verificationCode}`);

    return {
      message: 'Registration successful. Please verify your email.',
      userId: user.id.toString(),
      email: user.email,
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
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

    if (user.isFrozen) {
      throw new UnauthorizedException(
        'FROZEN_USER:' + (user.frozenReason || 'Sua conta está congelada devido ao limite do plano. Entre em contato com o administrador da agência.')
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    if (user.agencyId) {
      try {
        await this.planEnforcement.enforceCurrentPlanLimits(user.agencyId.toString());
      } catch (error) {
        console.error('Error enforcing plan limits on login:', error);
      }
    }

    const payload = {
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Log login event to audit with integrity hash
    try {
      const loginTime = new Date().toISOString();
      const hashData = `LOGIN|${user.id.toString()}|USER|${user.id.toString()}|${ip || ''}|${loginTime}`;
      const integrityHash = crypto.createHash('sha256').update(hashData).digest('hex');
      
      await this.prisma.auditLog.create({
        data: {
          event: 'LOGIN',
          userId: user.id,
          entity: 'USER',
          entityId: user.id,
          ip: ip || null,
          userAgent: userAgent || null,
          integrityHash,
          dataAfter: JSON.stringify({
            loginTime,
            role: user.role,
            agencyId: user.agencyId?.toString(),
          }),
        },
      });
    } catch (error) {
      console.error('Error logging login event:', error);
      // Don't fail login if audit logging fails
    }

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
        creci: user.creci,
      },
    };
  }

  async verifyEmailRequest(dto: VerifyEmailRequestDto) {
    const email = dto.email.toLowerCase();

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

    console.log(`Verification code for ${email}: ${code}`);

    return {
      requestId,
      expiresAt,
      cooldownSeconds: Math.ceil(EMAIL_CODE_COOLDOWN_MS / 1000),
      ...(process.env.NODE_ENV !== 'production' && { debugCode: code }),
    };
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
      return { message: 'If the email exists, a reset code has been sent' };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(resetCode, 10);

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

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { password: hashedPassword },
    });

    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    await this.prisma.refreshToken.updateMany({
      where: { user: { email: dto.email } },
      data: { isRevoked: true },
    });

    return { message: 'Password reset successfully' };
  }

  async logout(userId: bigint, token?: string, ip?: string, userAgent?: string) {
    if (token) {
      await this.prisma.refreshToken.updateMany({
        where: { token, userId },
        data: { isRevoked: true },
      });
    }

    // Log logout event to audit with integrity hash
    try {
      const logoutTime = new Date().toISOString();
      const userIdBigInt = BigInt(userId);
      const hashData = `LOGOUT|${userId}|USER|${userId}|${ip || ''}|${logoutTime}`;
      const integrityHash = crypto.createHash('sha256').update(hashData).digest('hex');
      
      await this.prisma.auditLog.create({
        data: {
          event: 'LOGOUT',
          userId: userIdBigInt,
          entity: 'USER',
          entityId: userIdBigInt,
          ip: ip || null,
          userAgent: userAgent || null,
          integrityHash,
          dataAfter: JSON.stringify({
            logoutTime,
          }),
        },
      });
    } catch (error) {
      console.error('Error logging logout event:', error);
      // Don't fail logout if audit logging fails
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

    let agencyId: bigint | undefined = undefined;

    if (dto.role === UserRole.AGENCY_ADMIN) {
      if (!dto.agencyName || !dto.agencyCnpj) {
        throw new BadRequestException('Agency name and CNPJ are required for agency owners');
      }

      const cleanCnpj = dto.agencyCnpj.replace(/\D/g, '');
      const existingAgency = await this.prisma.agency.findUnique({
        where: { cnpj: cleanCnpj },
      });

      if (existingAgency) {
        throw new ConflictException('Agency with this CNPJ already exists');
      }

      const planLimits: Record<string, { maxProperties: number; maxUsers: number }> = {
        FREE: { maxProperties: 5, maxUsers: 3 },
        ESSENTIAL: { maxProperties: 50, maxUsers: 10 },
        PROFESSIONAL: { maxProperties: 100, maxUsers: 20 },
        ENTERPRISE: { maxProperties: 500, maxUsers: 100 },
      };

      const limits = planLimits[dto.plan] || planLimits['FREE'];

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
          // Store full CRECI string in single column
          creci: dto.agencyCreci || null,
          representativeName: dto.representativeName || null,
          representativeDocument: dto.representativeDocument || null,
        },
      });

      agencyId = agency.id;
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: dto.role,
        plan: dto.plan,
        name: dto.name,
        phone: dto.phone,
        document: dto.document,
        creci: dto.creci,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        address: dto.address,
        cep: dto.cep,
        neighborhood: dto.neighborhood,
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
