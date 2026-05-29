import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getFiltros, upsertFiltros, type FiltrosRow } from '../db/repositories/filtros.js';
import { resetFiltrosCache } from '../lib/filtros.js';
import { config } from '../config.js';

const PatchBodySchema = z.object({
  valor_minimo: z.number().nonnegative().max(1_000_000_000),
  blacklist_uf: z.array(z.string().trim().min(2).max(2)).max(50),
  blacklist_orgaos: z.array(z.string().trim().min(1).max(200)).max(500),
  blacklist_objeto_regex: z.array(z.string().min(1).max(500)).max(200),
});

function serialize(row: FiltrosRow | null) {
  if (!row) {
    return {
      valor_minimo: config.HEURISTIC_VALOR_MINIMO,
      blacklist_uf: [],
      blacklist_orgaos: [],
      blacklist_objeto_regex: [],
      updated_at: null,
    };
  }
  return {
    valor_minimo: row.valor_minimo,
    blacklist_uf: row.blacklist_uf,
    blacklist_orgaos: row.blacklist_orgaos,
    blacklist_objeto_regex: row.blacklist_objeto_regex,
    updated_at: row.updated_at,
  };
}

export async function filtrosRoutes(app: FastifyInstance) {
  app.get('/api/filtros', async () => {
    const row = await getFiltros();
    return serialize(row);
  });

  app.patch('/api/filtros', async (req: FastifyRequest, reply) => {
    const parsed = PatchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: parsed.error.format() });
    }

    // Validação crítica: regex inválida derruba o pipeline. Compila antes de gravar.
    const regex_invalidas: { padrao: string; erro: string }[] = [];
    for (const p of parsed.data.blacklist_objeto_regex) {
      try {
        new RegExp(p, 'i');
      } catch (err) {
        regex_invalidas.push({
          padrao: p,
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (regex_invalidas.length > 0) {
      return reply.code(400).send({ error: 'regex_invalida', regex_invalidas });
    }

    const row = await upsertFiltros({
      valor_minimo: parsed.data.valor_minimo,
      blacklist_uf: parsed.data.blacklist_uf.map((u) => u.toUpperCase()),
      blacklist_orgaos: parsed.data.blacklist_orgaos,
      blacklist_objeto_regex: parsed.data.blacklist_objeto_regex,
    });
    resetFiltrosCache();
    return serialize(row);
  });
}
