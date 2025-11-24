import { z } from 'zod';

export const paymentCreateSchema = z.object({
  valorPago: z.number().positive('Amount must be positive'),
  dataPagamento: z.string(),
  contratoId: z.string(),
  propertyId: z.string(),
  tipo: z.enum(['ALUGUEL', 'CONDOMINIO', 'IPTU', 'OUTROS']),
  comprovante: z.string().optional(), // Base64 encoded file
});

export const paymentUpdateSchema = z.object({
  valorPago: z.number().positive().optional(),
  dataPagamento: z.string().optional(),
  contratoId: z.string().optional(),
  propertyId: z.string().optional(),
  tipo: z.enum(['ALUGUEL', 'CONDOMINIO', 'IPTU', 'OUTROS']).optional(),
});

export type PaymentCreateDTO = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateDTO = z.infer<typeof paymentUpdateSchema>;

