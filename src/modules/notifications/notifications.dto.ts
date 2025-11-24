import { z } from 'zod';

export const notificationCreateSchema = z.object({
  type: z.enum(['ON_TIME', 'OVERDUE']),
  days: z.number().int().min(0),
  recurring: z.boolean().optional(),
  tenantId: z.string().optional(),
  propertyId: z.string().optional(),
});

export const notificationUpdateSchema = z.object({
  type: z.enum(['ON_TIME', 'OVERDUE']).optional(),
  days: z.number().int().min(0).optional(),
  recurring: z.string().optional(),
  description: z.string().optional(),
});

export type NotificationCreateDTO = z.infer<typeof notificationCreateSchema>;
export type NotificationUpdateDTO = z.infer<typeof notificationUpdateSchema>;

