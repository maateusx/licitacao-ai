import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { sql } from '../db/client.js';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../db/schema.sql');

async function main() {
  const ddl = await readFile(SCHEMA_PATH, 'utf8');
  logger.info({ path: SCHEMA_PATH }, 'applying schema');
  await sql.unsafe(ddl);
  logger.info('schema applied');
  await sql.end();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : err }, 'apply-schema failed');
  process.exit(1);
});
