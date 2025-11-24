import { z } from 'zod';

export const chatCreateSchema = z.object({
  participantId: z.string(),
});

export const messageCreateSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(1000),
});

export type ChatCreateDTO = z.infer<typeof chatCreateSchema>;
export type MessageCreateDTO = z.infer<typeof messageCreateSchema>;

