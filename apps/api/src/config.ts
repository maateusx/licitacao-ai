import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });

const Env = z.object({
  DATABASE_URL: z.string().url(),
  PNCP_RATE_LIMIT_MS: z.coerce.number().int().nonnegative().default(1000),
  PNCP_MAX_PAGES_PER_KEYWORD: z.coerce.number().int().positive().default(20),
  PNCP_USER_AGENT: z.string().default('licitacoes-ai/0.1.0'),
  LOG_LEVEL: z.string().default('info'),
  HEURISTIC_VALOR_MINIMO: z.coerce.number().nonnegative().default(10000),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GEMINI_RATE_LIMIT_MS: z.coerce.number().int().nonnegative().default(250),
  CLASSIFIER_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),
  SCHEDULER_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() !== 'false'),
  SCHEDULER_CRON: z.string().default('0 6,18 * * *'),
  SCHEDULER_TIMEZONE: z.string().default('America/Sao_Paulo'),
});

export const config = Env.parse(process.env);
