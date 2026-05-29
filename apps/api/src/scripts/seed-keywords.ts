import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { sql } from '../db/client.js';
import { upsertKeyword } from '../db/repositories/keywords.js';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '../../../../config/keywords.seed.json');

const SeedSchema = z.array(
  z.object({
    termo: z.string().min(1),
    peso: z.number().positive().default(1.0),
  }),
);

async function main() {
  const raw = await readFile(SEED_PATH, 'utf8');
  const seeds = SeedSchema.parse(JSON.parse(raw));
  logger.info({ path: SEED_PATH, count: seeds.length }, 'seeding keywords');

  for (const s of seeds) {
    await upsertKeyword(s.termo, s.peso);
  }
  logger.info('seed done');
  await sql.end();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : err }, 'seed failed');
  process.exit(1);
});
