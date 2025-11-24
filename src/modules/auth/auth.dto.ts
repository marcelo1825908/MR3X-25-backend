import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['CEO', 'ADMIN', 'AGENCY_MANAGER', 'BROKER', 'PROPRIETARIO', 'INDEPENDENT_OWNER', 'INQUILINO', 'BUILDING_MANAGER', 'LEGAL_AUDITOR', 'REPRESENTATIVE', 'API_CLIENT']),
  plan: z.string().min(1, 'Plan is required'),
  name: z.string().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  cep: z.string().optional(),
  neighborhood: z.string().optional(),
  number: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const requestEmailCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const confirmEmailCodeSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

export const completeRegisterSchema = z.object({
  registrationToken: z.string().min(1, 'registrationToken is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER', 'PROPRIETARIO', 'INDEPENDENT_OWNER', 'INQUILINO', 'BUILDING_MANAGER', 'LEGAL_AUDITOR', 'REPRESENTATIVE', 'API_CLIENT']),
  plan: z.string().min(1, 'Plan is required'),
  name: z.string().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  cep: z.string().optional(),
  neighborhood: z.string().optional(),
  number: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  // Agency fields - required only for AGENCY_ADMIN
  agencyName: z.string().optional(),
  agencyCnpj: z.string().optional(),
}).refine((data) => {
  // If role is AGENCY_ADMIN, agencyName and agencyCnpj are required
  if (data.role === 'AGENCY_ADMIN') {
    return data.agencyName && data.agencyCnpj;
  }
  return true;
}, {
  message: 'Agency name and CNPJ are required for agency owners',
  path: ['agencyName'], // This will show error on agencyName field
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterDTO = z.infer<typeof registerSchema>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;
export type RequestEmailCodeDTO = z.infer<typeof requestEmailCodeSchema>;
export type ConfirmEmailCodeDTO = z.infer<typeof confirmEmailCodeSchema>;
export type CompleteRegisterDTO = z.infer<typeof completeRegisterSchema>;

