import { z } from 'zod';

export const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['CEO','ADMIN','AGENCY_MANAGER','BROKER','PROPRIETARIO','INDEPENDENT_OWNER','INQUILINO','BUILDING_MANAGER','LEGAL_AUDITOR','REPRESENTATIVE','API_CLIENT']),
  plan: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  cep: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  userType: z.string().optional(),
  agencyId: z.string().optional(),
  managerId: z.string().optional(), // supervisor user id (stored in brokerId for now)
});

export const tenantCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string(),
  phone: z.string().optional(),
  document: z.string().optional(),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  cep: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  userType: z.string().optional(),
  agencyId: z.string().optional(),
});

export const userUpdateSchema = z.object({
  // Email update is not allowed via admin edit per spec (locked)
  name: z.string().optional(),
  phone: z.string().optional(),
  // CPF/CNPJ locked
  birthDate: z.string().optional(),
  address: z.string().optional(),
  cep: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  role: z.enum(['CEO','ADMIN','AGENCY_MANAGER','BROKER','PROPRIETARIO','INQUILINO','BUILDING_MANAGER','LEGAL_AUDITOR','REPRESENTATIVE','API_CLIENT']).optional(),
  status: z.enum(['ACTIVE','INVITED','SUSPENDED']).optional(),
  notificationPreferences: z.object({ email: z.boolean().optional(), whatsapp: z.boolean().optional(), push: z.boolean().optional() }).optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(['ACTIVE','SUSPENDED']),
  reason: z.string().min(3),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export type UserCreateDTO = z.infer<typeof userCreateSchema>;
export type TenantCreateDTO = z.infer<typeof tenantCreateSchema>;
export type UserUpdateDTO = z.infer<typeof userUpdateSchema>;
export type ChangeStatusDTO = z.infer<typeof changeStatusSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;

