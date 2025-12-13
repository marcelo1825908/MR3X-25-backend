import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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

    // Block frozen users from all API access
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
