import bcrypt from 'bcrypt';
import { prisma } from '../../config/database';
import { generateToken, JwtPayload } from '../../config/jwt';
import { AppError, UnauthorizedError } from '../../shared/errors/AppError';
import { env } from '../../config/env';
import { LoginDTO, RegisterDTO, ForgotPasswordDTO, ResetPasswordDTO, RequestEmailCodeDTO, ConfirmEmailCodeDTO, CompleteRegisterDTO } from './auth.dto';
import crypto from 'crypto';
import { sendEmail } from '../../config/mail';

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_CODE_COOLDOWN_MS = 60 * 1000; // 60 seconds
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const PASSWORD_RESET_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes between e-mails

export class AuthService {
  private hash(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private generateNumericCode(): string {
    return (Math.floor(100000 + Math.random() * 900000)).toString();
  }

  async requestEmailCode(data: RequestEmailCodeDTO) {
    const email = data.email.toLowerCase();

    // Cooldown: if a recent record exists, block
    const recent = await prisma.emailVerification.findFirst({
      where: {
        email,
        purpose: 'register',
        createdAt: { gt: new Date(Date.now() - EMAIL_CODE_COOLDOWN_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      return { cooldownSeconds: Math.ceil((EMAIL_CODE_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000) };
    }

    const code = this.generateNumericCode();
    const requestId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);

    await prisma.emailVerification.create({
      data: {
        requestId,
        email,
        codeHash: this.hash(code),
        purpose: 'register',
        expiresAt,
      },
    });

    await sendEmail({
      to: email,
      subject: 'MR3X - Código de verificação',
      html: `<p>Seu código de verificação é <strong>${code}</strong>.</p><p>Ele expira em 10 minutos.</p>`,
      text: `Seu código de verificação é ${code}. Ele expira em 10 minutos.`,
    });

    return { requestId, expiresAt, cooldownSeconds: Math.ceil(EMAIL_CODE_COOLDOWN_MS / 1000) };
  }

  async confirmEmailCode(data: ConfirmEmailCodeDTO) {
    const record = await prisma.emailVerification.findUnique({ where: { requestId: data.requestId } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('Invalid or expired code', 400);
    }
    if (record.attempts >= record.maxAttempts) {
      throw new AppError('Too many attempts', 429);
    }

    const isValid = this.hash(data.code) === record.codeHash;
    await prisma.emailVerification.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        usedAt: isValid ? new Date() : undefined,
      },
    });

    if (!isValid) {
      throw new AppError('Invalid code', 400);
    }

    // issue short-lived registration token embedding the verified email
    const registrationToken = generateToken({
      userId: '0',
      email: record.email,
      role: 'API_CLIENT' as any, // unused here
    });

    return { registrationToken, email: record.email, expiresInSeconds: 30 * 60 };
  }

  async completeRegistration(data: CompleteRegisterDTO) {
    // verify registration token by reading email from it
    let email: string | undefined;
    try {
      const payload = JSON.parse(Buffer.from(data.registrationToken.split('.')[1], 'base64').toString());
      email = payload.email;
    } catch {
      throw new AppError('Invalid registration token', 400);
    }
    if (!email) throw new AppError('Invalid registration token', 400);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new AppError('User already exists', 400);

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // For AGENCY_ADMIN: Create agency first, then link user to it
    let agencyId: bigint | undefined = undefined;
    
    if (data.role === 'AGENCY_ADMIN') {
      if (!data.agencyName || !data.agencyCnpj) {
        throw new AppError('Agency name and CNPJ are required for agency owners', 400);
      }

      // Check if agency with this CNPJ already exists
      const cleanCnpj = data.agencyCnpj.replace(/\D/g, '');
      const existingAgency = await prisma.agency.findUnique({
        where: { cnpj: cleanCnpj },
      });

      if (existingAgency) {
        throw new AppError('Agency with this CNPJ already exists', 400);
      }

      // Determine plan-based limits
      const planLimits: Record<string, { maxProperties: number; maxUsers: number }> = {
        'FREE': { maxProperties: 5, maxUsers: 3 },
        'ESSENTIAL': { maxProperties: 50, maxUsers: 10 },
        'PROFESSIONAL': { maxProperties: 100, maxUsers: 20 },
        'ENTERPRISE': { maxProperties: 500, maxUsers: 100 },
      };

      const limits = planLimits[data.plan] || planLimits['FREE'];

      // Create agency using user's information
      const agency = await prisma.agency.create({
        data: {
          name: data.agencyName,
          cnpj: cleanCnpj,
          email: email, // Agency email = owner's email
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zipCode: data.cep || null,
          status: 'ACTIVE',
          plan: data.plan,
          maxProperties: limits.maxProperties,
          maxUsers: limits.maxUsers,
        },
      });

      agencyId = agency.id;
    }

    // Create user account
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: data.role,
        plan: data.plan,
        name: data.name,
        phone: data.phone,
        document: data.document,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        address: data.address,
        cep: data.cep,
        neighborhood: data.neighborhood,
        number: data.number,
        city: data.city,
        state: data.state,
        status: 'ACTIVE',
        emailVerified: true,
        agencyId: agencyId, // Link to agency if AGENCY_ADMIN
      },
      select: { id: true, email: true, role: true, plan: true, name: true, createdAt: true },
    });
    return user;
  }
  async login(data: LoginDTO) {
    const rawEmail = (data.email || '').trim();
    const emailLower = rawEmail.toLowerCase();
    // Be resilient to case differences stored historically
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: rawEmail },
          { email: emailLower },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('Conta suspensa. Entre em contato com o suporte.', 403);
    }

    const isPasswordValid = await bcrypt.compare((data.password || '').trim(), user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const payload: JwtPayload = {
      userId: user.id.toString(),
      email: user.email,
      role: user.role as any,
      plan: user.plan,
      companyId: user.companyId?.toString(),
      ownerId: user.ownerId?.toString(),
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
    };

    // Generate access token only (no refresh token needed)
    const accessToken = generateToken(payload);

    return { 
      accessToken,
      user: {
        id: user.id.toString(),
        email: user.email,
        role: user.role,
        plan: user.plan,
          name: user.name,
          agencyId: user.agencyId?.toString(),
          brokerId: user.brokerId?.toString(),
      }
    };
  }

  async register(data: RegisterDTO) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('User already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: data.role,
        plan: data.plan,
        name: data.name,
        phone: data.phone,
        document: data.document,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        address: data.address,
        cep: data.cep,
        neighborhood: data.neighborhood,
        number: data.number,
        city: data.city,
        state: data.state,
        companyId: data.companyId ? BigInt(data.companyId) : null,
        ownerId: data.ownerId ? BigInt(data.ownerId) : null,
        status: 'ACTIVE',
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

    return user;
  }

  async forgotPassword(data: ForgotPasswordDTO) {
    const email = data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a reset link will be sent' };
    }

    // Enforce cooldown to avoid spamming
    const recentRequest = await prisma.emailVerification.findFirst({
      where: {
        email,
        purpose: 'password_reset',
        createdAt: { gt: new Date(Date.now() - PASSWORD_RESET_COOLDOWN_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentRequest) {
      const secondsRemaining = Math.ceil(
        (PASSWORD_RESET_COOLDOWN_MS - (Date.now() - recentRequest.createdAt.getTime())) / 1000,
      );
      return { cooldownSeconds: secondsRemaining };
    }

    await prisma.emailVerification.deleteMany({
      where: {
        email,
        purpose: 'password_reset',
      },
    });

    const requestId = crypto.randomUUID();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hash(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await prisma.emailVerification.create({
      data: {
        requestId,
        email,
        codeHash: tokenHash,
        purpose: 'password_reset',
        expiresAt,
        attempts: 0,
        maxAttempts: 5,
      },
    });

    const frontendUrl = (env.APP_RESET_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const compositeToken = `${requestId}.${rawToken}`;
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(compositeToken)}`;

    await sendEmail({
      to: email,
      subject: 'MR3X - Redefinição de Senha',
      html: `
        <p>Olá ${user.name || ''},</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta MR3X.</p>
        <p>Para escolher uma nova senha, clique no botão abaixo:</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:10px 18px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
            Redefinir senha
          </a>
        </p>
        <p>Este link é válido por 1 hora. Se você não solicitou esta alteração, ignore este e-mail.</p>
        <p>Equipe MR3X</p>
      `,
      text: `Recebemos uma solicitação para redefinir sua senha MR3X. Utilize o link abaixo (válido por 1 hora):\n${resetLink}\nSe não foi você, ignore este e-mail.`,
    });

    return { message: 'If the email exists, a reset link will be sent' };
  }

  async resetPassword(data: ResetPasswordDTO) {
    const tokenParts = data.token.split('.');
    if (tokenParts.length !== 2) {
      throw new AppError('Invalid token', 400);
    }

    const [requestId, rawToken] = tokenParts;

    const record = await prisma.emailVerification.findUnique({ where: { requestId } });

    if (!record || record.purpose !== 'password_reset') {
      throw new AppError('Invalid token', 400);
    }

    if (record.usedAt) {
      throw new AppError('Token already used', 400);
    }

    if (record.expiresAt < new Date()) {
      throw new AppError('Token expired', 400);
    }

    if (this.hash(rawToken) !== record.codeHash) {
      throw new AppError('Invalid token', 400);
    }

    const user = await prisma.user.findUnique({ where: { email: record.email } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.emailVerification.update({
        where: { id: record.id },
        data: {
          usedAt: new Date(),
          attempts: { increment: 1 },
        },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async logout(_refreshToken?: string) {
    // No refresh token needed - tokens expire naturally
    return { message: 'Logged out successfully' };
  }

  async logoutAll(_userId: string) {
    // No refresh tokens to revoke - tokens expire naturally
    return { message: 'Logged out from all devices successfully' };
  }
}

