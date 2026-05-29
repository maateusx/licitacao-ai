import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  getEmpresaPerfil,
  upsertEmpresaPerfil,
  type EmpresaPerfilRow,
} from '../db/repositories/empresa-perfil.js';
import { resetEmpresaPerfilCache } from '../lib/empresa-perfil.js';

const PatchBodySchema = z.object({
  conteudo: z.string().min(1, 'conteudo vazio').max(50_000),
});

function serialize(row: EmpresaPerfilRow | null) {
  if (!row) return { conteudo: '', updated_at: null };
  return { conteudo: row.conteudo, updated_at: row.updated_at };
}

export async function empresaPerfilRoutes(app: FastifyInstance) {
  app.get('/api/empresa-perfil', async () => {
    const row = await getEmpresaPerfil();
    return serialize(row);
  });

  app.patch('/api/empresa-perfil', async (req: FastifyRequest, reply) => {
    const parsed = PatchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: parsed.error.format() });
    }
    const row = await upsertEmpresaPerfil(parsed.data.conteudo.trim());
    resetEmpresaPerfilCache();
    return serialize(row);
  });
}
