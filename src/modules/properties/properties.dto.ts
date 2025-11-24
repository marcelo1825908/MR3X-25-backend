import { z } from 'zod';

export const propertyCreateSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  monthlyRent: z.number().positive('Monthly rent must be positive').optional(),
  status: z.enum(['DISPONIVEL', 'ALUGADO', 'MANUTENCAO']),
  tenantId: z.string().nullable().optional(), // Allow null to unassign tenant
  ownerId: z.string().nullable().optional(), // Allow null to unassign owner
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  cep: z.string().optional(),
  name: z.string().optional(),
  nextDueDate: z.string().optional(),
  dueDay: z.number().min(1).max(31).optional(),
  stateNumber: z.string().optional(),
  agencyFee: z.number().min(0).max(100).optional(), // Property-specific agency fee percentage (0-100)
});

export const propertyUpdateSchema = z.object({
  address: z.string().optional(),
  monthlyRent: z.number().positive().optional(),
  status: z.enum(['DISPONIVEL', 'ALUGADO', 'MANUTENCAO']).optional(),
  tenantId: z.string().nullable().optional(), // Allow null to unassign tenant
  ownerId: z.string().nullable().optional(), // Allow null to unassign owner
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  cep: z.string().optional(),
  name: z.string().optional(),
  nextDueDate: z.string().optional(),
  dueDay: z.number().min(1).max(31).optional(),
  stateNumber: z.string().optional(),
  agencyFee: z.number().min(0).max(100).optional(), // Property-specific agency fee percentage (0-100)
});

export type PropertyCreateDTO = z.infer<typeof propertyCreateSchema>;
export type PropertyUpdateDTO = z.infer<typeof propertyUpdateSchema>;

