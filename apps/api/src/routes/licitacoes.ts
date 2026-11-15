import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { insertAnalise } from '../db/repositories/analises.js';
import {
  getLicitacaoById,
  listLicitacoes,
  updateLicitacaoFlags,
  type ArquivadaFilter,
  type Categoria,
  type LicitacaoListRow,
  type OrderBy,
  type SortDirection,
} from '../db/repositories/licitacoes.js';
import { GeminiClassifier } from '../pipeline/gemini-classifier.js';
import { PROMPT_VERSION } from '../pipeline/prompts/classifier.v1.js';
import { logger } from '../lib/logger.js';

// Multi-valor: aceita "MG,SP" ou "MG" (string única).
const csv = (schema: z.ZodEnum<[string, ...string[]]> | z.ZodString) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined))
    .pipe(z.array(schema).optional());

const CategoriaEnum = z.enum(['core', 'adjacente', 'fora']);
const OrderEnum = z.enum([
  'data_encerramento',
  'data_abertura',
  'score',
  'valor_estimado',
  'titulo',
  'orgao',
  'uf',
]);
const DirectionEnum = z.enum(['asc', 'desc']);

const ArquivadaEnum = z.enum(['ativas', 'incluir', 'so']);
// "1"/"true"/"0"/"false" — vem da querystring, então usa booleanish.
const Booleanish = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.boolean()])
  .transform((v) => v === true || v === 'true' || v === '1');

const ListQuerySchema = z.object({
  uf: csv(z.string().length(2).toUpperCase()),
  score_min: z.coerce.number().int().min(0).max(100).optional(),
  categoria: csv(CategoriaEnum),
  data_inicio: z.coerce.date().optional(),
  data_fim: z.coerce.date().optional(),
  keyword: csv(z.string()),
  busca: z.string().min(1).optional(),
  valor_min: z.coerce.number().nonnegative().optional(),
  valor_max: z.coerce.number().positive().optional(),
  status: z.string().optional(),
  arquivada: ArquivadaEnum.default('ativas'),
  so_favoritas: Booleanish.optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().max(200).default(50),
  order: OrderEnum.default('data_encerramento'),
  direction: DirectionEnum.optional(),
});

const IdParamsSchema = z.object({ id: z.string().uuid() });

const PatchBodySchema = z
  .object({
    arquivada: z.boolean().optional(),
    favorita: z.boolean().optional(),
  })
  .refine((v) => v.arquivada !== undefined || v.favorita !== undefined, {
    message: 'pelo menos um de arquivada ou favorita deve ser informado',
  });

function serializeLicitacao(row: LicitacaoListRow) {
  const analise =
    row.analise_categoria != null
      ? {
          score: row.analise_score,
          categoria: row.analise_categoria,
          justificativa: row.analise_justificativa,
          pontos_fortes: row.analise_pontos_fortes ?? [],
          red_flags: row.analise_red_flags ?? [],
          modelo: row.analise_modelo,
          created_at: row.analise_created_at,
        }
      : null;

  return {
    id: row.id,
    fonte: row.fonte,
    id_pncp: row.id_pncp,
    titulo: row.titulo,
    objeto: row.objeto,
    orgao: row.orgao,
    uf: row.uf,
    municipio: row.municipio,
    modalidade: row.modalidade,
    valor_estimado: row.valor_estimado == null ? null : Number(row.valor_estimado),
    status: row.status,
    data_publicacao: row.data_publicacao,
    data_abertura: row.data_abertura,
    data_encerramento: row.data_encerramento,
    url_pncp: row.url_pncp,
    keywords_match: row.keywords_match ?? [],
    arquivada: row.arquivada,
    favorita: row.favorita,
    created_at: row.created_at,
    updated_at: row.updated_at,
    analise,
  };
}

export async function licitacoesRoutes(app: FastifyInstance) {
  app.get('/api/licitacoes', async (req: FastifyRequest, reply) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', details: parsed.error.format() });
    }
    const q = parsed.data;

    const result = await listLicitacoes({
      uf: q.uf,
      score_min: q.score_min,
      categoria: q.categoria as Categoria[] | undefined,
      data_inicio: q.data_inicio,
      data_fim: q.data_fim,
      keyword: q.keyword,
      busca: q.busca,
      valor_min: q.valor_min,
      valor_max: q.valor_max,
      status: q.status,
      arquivada: q.arquivada as ArquivadaFilter,
      so_favoritas: q.so_favoritas,
      page: q.page,
      page_size: q.page_size,
      order: q.order as OrderBy,
      direction: q.direction as SortDirection | undefined,
    });

    return {
      data: result.data.map(serializeLicitacao),
      pagination: { page: q.page, page_size: q.page_size, total: result.total },
    };
  });

  app.get('/api/licitacoes/:id', async (req: FastifyRequest, reply) => {
    const parsed = IdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_id' });
    }
    const row = await getLicitacaoById(parsed.data.id);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return serializeLicitacao(row);
  });

  app.patch('/api/licitacoes/:id', async (req: FastifyRequest, reply) => {
    const idParsed = IdParamsSchema.safeParse(req.params);
    if (!idParsed.success) return reply.code(400).send({ error: 'invalid_id' });
    const bodyParsed = PatchBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: bodyParsed.error.format() });
    }
    const updated = await updateLicitacaoFlags(idParsed.data.id, bodyParsed.data);
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    return updated;
  });

  app.post('/api/licitacoes/:id/reanalisar', async (req: FastifyRequest, reply) => {
    const parsed = IdParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_id' });

    const row = await getLicitacaoById(parsed.data.id);
    if (!row) return reply.code(404).send({ error: 'not_found' });

    let classifier: GeminiClassifier;
    try {
      classifier = new GeminiClassifier();
    } catch (err) {
      // GEMINI_API_KEY ausente — não rebenta o servidor, devolve 503.
      return reply.code(503).send({
        error: 'gemini_unavailable',
        message: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const result = await classifier.classify({
        titulo: row.titulo,
        orgao: row.orgao,
        uf: row.uf,
        objeto: row.objeto,
        valor_estimado: row.valor_estimado == null ? null : Number(row.valor_estimado),
        modalidade: row.modalidade,
      });

      // Sempre cria nova linha em `analises` — mantém histórico de reanálises.
      if (result.ok) {
        const analise = await insertAnalise({
          licitacao_id: row.id,
          score: result.output.score,
          categoria: result.output.categoria,
          justificativa: result.output.justificativa,
          pontos_fortes: result.output.pontos_fortes,
          red_flags: result.output.red_flags,
          modelo: result.modelo,
          prompt_version: result.prompt_version,
          erro: null,
        });
        return {
          ok: true,
          analise: {
            id: analise.id,
            score: result.output.score,
            categoria: result.output.categoria,
            justificativa: result.output.justificativa,
            pontos_fortes: result.output.pontos_fortes,
            red_flags: result.output.red_flags,
            modelo: result.modelo,
            created_at: analise.created_at,
          },
        };
      }

      const analise = await insertAnalise({
        licitacao_id: row.id,
        score: null,
        categoria: 'fora',
        justificativa: null,
        pontos_fortes: null,
        red_flags: null,
        modelo: result.modelo,
        prompt_version: result.prompt_version,
        erro: result.erro,
      });
      logger.warn({ id: row.id, erro: result.erro }, 'reanalisar: gemini falhou após retries');
      return reply.code(502).send({
        ok: false,
        erro: result.erro,
        analise: {
          id: analise.id,
          score: null,
          categoria: 'fora',
          created_at: analise.created_at,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ id: row.id, err: msg }, 'reanalisar: erro inesperado');
      await insertAnalise({
        licitacao_id: row.id,
        score: null,
        categoria: 'fora',
        justificativa: null,
        pontos_fortes: null,
        red_flags: null,
        modelo: 'desconhecido',
        prompt_version: PROMPT_VERSION,
        erro: msg,
      }).catch(() => undefined);
      return reply.code(500).send({ ok: false, erro: msg });
    }
  });
}
