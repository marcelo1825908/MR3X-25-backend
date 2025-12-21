import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';
import { Request } from 'express';

// Custom extractor that checks cookies first, then Authorization header
const cookieExtractor = (req: Request): string | null => {
  // First try to get from HTTP-only cookie
  if (req && req.cookies && req.cookies['accessToken']) {
    return req.cookies['accessToken'];
  }
  // Fallback to Authorization header for API clients
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        agencyId: true,
        companyId: true,
        isFrozen: true,
        frozenReason: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (user.isFrozen) {
      throw new UnauthorizedException(
        user.frozenReason || 'Sua conta está temporariamente desativada devido ao limite do plano. Entre em contato com o administrador da agência.'
      );
    }

    return {
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      companyId: user.companyId?.toString(),
    };
  }
}
