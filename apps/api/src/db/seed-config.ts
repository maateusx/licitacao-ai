import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { getEmpresaPerfil, upsertEmpresaPerfil } from './repositories/empresa-perfil.js';
import { getFiltros, upsertFiltros } from './repositories/filtros.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERFIL_PATH = resolve(__dirname, '../../../../config/empresa-perfil.md');
const FILTROS_PATH = resolve(__dirname, '../../../../config/filtros.json');

const FiltrosFileSchema = z.object({
  blacklist_uf: z.array(z.string()).default([]),
  blacklist_orgaos: z.array(z.string()).default([]),
  blacklist_objeto_regex: z.array(z.string()).default([]),
});

/**
 * Popula empresa_perfil/filtros a partir dos arquivos em config/ se as tabelas
 * estiverem vazias. Idempotente: depois do primeiro boot, os arquivos viram só
 * referência histórica e a edição passa pela UI/PATCH.
 */
export async function seedConfigIfEmpty(): Promise<void> {
  await seedPerfil();
  await seedFiltros();
}

async function seedPerfil(): Promise<void> {
  if (await getEmpresaPerfil()) return;
  try {
    const conteudo = (await readFile(PERFIL_PATH, 'utf8')).trim();
    if (!conteudo) {
      logger.warn({ path: PERFIL_PATH }, 'empresa-perfil seed file vazio — pulando');
      return;
    }
    await upsertEmpresaPerfil(conteudo);
    logger.info({ path: PERFIL_PATH }, 'empresa_perfil seeded do arquivo');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn({ path: PERFIL_PATH }, 'empresa-perfil.md não encontrado — pulando seed');
      return;
    }
    throw err;
  }
}

async function seedFiltros(): Promise<void> {
  if (await getFiltros()) return;
  let parsed: z.infer<typeof FiltrosFileSchema>;
  try {
    const raw = await readFile(FILTROS_PATH, 'utf8');
    parsed = FiltrosFileSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      parsed = FiltrosFileSchema.parse({});
    } else {
      throw err;
    }
  }
  await upsertFiltros({
    valor_minimo: config.HEURISTIC_VALOR_MINIMO,
    blacklist_uf: parsed.blacklist_uf,
    blacklist_orgaos: parsed.blacklist_orgaos,
    blacklist_objeto_regex: parsed.blacklist_objeto_regex,
  });
  logger.info({ path: FILTROS_PATH }, 'filtros seeded do arquivo');
}
