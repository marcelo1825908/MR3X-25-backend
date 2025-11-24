import { z } from 'zod';

export const updateSettingSchema = z.object({
  value: z.string().min(1, 'Value is required'),
  description: z.string().optional(),
});

export const updatePaymentConfigSchema = z.object({
  platformFee: z.number().min(0).max(100, 'Platform fee must be between 0 and 100'),
  agencyFee: z.number().min(0).max(100, 'Agency fee must be between 0 and 100'),
});

export type UpdateSettingDTO = z.infer<typeof updateSettingSchema>;
export type UpdatePaymentConfigDTO = z.infer<typeof updatePaymentConfigSchema>;

