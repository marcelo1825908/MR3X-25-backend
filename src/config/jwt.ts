import jwt from 'jsonwebtoken';
import { env } from './env';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  plan?: string;
  companyId?: string;
  ownerId?: string;
  agencyId?: string;
  brokerId?: string;
}

export const jwtConfig = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN || '7d', // Extended to 7 days - no refresh token needed
};

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, jwtConfig.secret) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

