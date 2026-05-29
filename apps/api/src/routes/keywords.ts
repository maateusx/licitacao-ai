import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createKeyword,
  deleteKeyword,
  listAllKeywords,
  updateKeyword,
  type Keyword,
} from '../db/repositories/keywords.js';

const CreateBodySchema = z.object({
  termo: z.string().trim().min(1).max(120),
  peso: z.number().positive().max(10).optional(),
  ativo: z.boolean().optional(),
});

const PatchBodySchema = z
  .object({
    termo: z.string().trim().min(1).max(120).optional(),
    peso: z.number().positive().max(10).optional(),
    ativo: z.boolean().optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: 'no fields to update' });

const IdParamsSchema = z.object({ id: z.string().uuid() });

function serialize(k: Keyword) {
  return {
    id: k.id,
    termo: k.termo,
    ativo: k.ativo,
    peso: Number(k.peso),
    created_at: k.created_at,
  };
}

export async function keywordsRoutes(app: FastifyInstance) {
  app.get('/api/keywords', async () => {
    const keywords = await listAllKeywords();
    return { data: keywords.map(serialize) };
  });

  app.post('/api/keywords', async (req: FastifyRequest, reply) => {
    const parsed = CreateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: parsed.error.format() });
    }
    try {
      const k = await createKeyword(parsed.data);
      return reply.code(201).send(serialize(k));
    } catch (err) {
      // Postgres unique violation = código 23505.
      if (isUniqueViolation(err)) {
        return reply.code(409).send({ error: 'keyword_duplicada' });
      }
      throw err;
    }
  });

  app.patch('/api/keywords/:id', async (req: FastifyRequest, reply) => {
    const params = IdParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });

    const body = PatchBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', details: body.error.format() });
    }

    try {
      const k = await updateKeyword(params.data.id, body.data);
      if (!k) return reply.code(404).send({ error: 'not_found' });
      return serialize(k);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return reply.code(409).send({ error: 'keyword_duplicada' });
      }
      throw err;
    }
  });

  app.delete('/api/keywords/:id', async (req: FastifyRequest, reply) => {
    const params = IdParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const removed = await deleteKeyword(params.data.id);
    if (!removed) return reply.code(404).send({ error: 'not_found' });
    return reply.code(204).send();
  });
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err != null && (err as { code?: string }).code === '23505';
}
