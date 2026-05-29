import type { FastifyInstance } from 'fastify';
import { listExecucoes, type ExecucaoRow } from '../db/repositories/execucoes.js';
import { getLastRunStartedAt, isRunInProgress, startRun } from '../pipeline/run-lock.js';

function serialize(e: ExecucaoRow) {
  const duracao_ms =
    e.finished_at && e.started_at ? e.finished_at.getTime() - e.started_at.getTime() : null;
  return {
    id: e.id,
    started_at: e.started_at,
    finished_at: e.finished_at,
    duracao_ms,
    status: e.status,
    erro: e.erro,
    total_encontradas: e.total_encontradas,
    total_novas: e.total_novas,
    total_classificadas: e.total_classificadas,
    total_filtradas: e.total_filtradas,
    total_erros_class: e.total_erros_class,
  };
}

export async function execucoesRoutes(app: FastifyInstance) {
  app.get('/api/execucoes', async () => {
    const rows = await listExecucoes(50);
    return {
      data: rows.map(serialize),
      run_in_progress: isRunInProgress(),
      last_started_at: getLastRunStartedAt(),
    };
  });

  app.post('/api/run', async (_req, reply) => {
    const result = startRun({}, 'api');
    if (!result.started) {
      return reply.code(409).send({
        error: 'run_in_progress',
        message: 'Já existe uma execução em andamento.',
      });
    }
    // Não bloqueia a resposta — a execução roda em background.
    result.promise.catch(() => undefined);
    return reply.code(202).send({
      status: 'started',
      started_at: getLastRunStartedAt(),
    });
  });
}
