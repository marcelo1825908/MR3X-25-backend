import { z } from 'zod';

export const contractCreateSchema = z.object({
  propertyId: z.string(),
  tenantId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  monthlyRent: z.number().positive('Monthly rent must be positive'),
  deposit: z.number().nonnegative().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  description: z.string().optional(),
  status: z.enum(['ATIVO', 'ENCERRADO', 'PENDENTE']).default('PENDENTE'),
  city: z.string().optional(),
  index: z.string().optional(),
  creci: z.string().optional(), // CRECI number (e.g., 123456/SP-F or 123456/SP-J)
  templateId: z.string().optional(), // Template identifier
  templateType: z.enum(['CTR', 'ACD', 'VST']).optional(), // Contract, Accord, Inspection
});

export const contractUpdateSchema = z.object({
  propertyId: z.string().optional(),
  tenantId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  monthlyRent: z.number().positive().optional(),
  deposit: z.number().nonnegative().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  description: z.string().optional(),
  status: z.enum(['ATIVO', 'ENCERRADO', 'PENDENTE']).optional(),
});

export const contractDefaultSchema = z.object({
  propertyId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  city: z.string().optional(),
  index: z.string().optional(),
});

export type ContractCreateDTO = z.infer<typeof contractCreateSchema>;
export type ContractUpdateDTO = z.infer<typeof contractUpdateSchema>;
export type ContractDefaultDTO = z.infer<typeof contractDefaultSchema>;

