import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SERVER_PORT: z.string().transform(Number).default('8081'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  MAIL_HOST: z.string().default('smtp.gmail.com'),
  MAIL_PORT: z.string().transform(Number).default('587'),
  MAIL_USER: z.string(),
  MAIL_PASS: z.string(),
  EVOLUTION_API_BASE_URL: z.string().optional(),
  EVOLUTION_API_INSTANCE: z.string().optional(),
  EVOLUTION_API_APIKEY: z.string().optional(),
  IGPM_SOURCE_URL: z.string().optional(),
  APP_RESET_BASE_URL: z.string().optional(),
  ENABLE_CNPJ_2026: z
    .string()
    .optional()
    .transform((v) => (v ? v === 'true' || v === '1' : false)),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

