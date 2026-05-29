import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { licitacoesRoutes } from './routes/licitacoes.js';
import { statsRoutes } from './routes/stats.js';
import { keywordsRoutes } from './routes/keywords.js';
import { execucoesRoutes } from './routes/execucoes.js';
import { empresaPerfilRoutes } from './routes/empresa-perfil.js';
import { filtrosRoutes } from './routes/filtros.js';
import { startScheduler } from './scheduler.js';
import { seedConfigIfEmpty } from './db/seed-config.js';

async function main() {
  const app = Fastify({ loggerInstance: logger });

  await app.register(cors, { origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(licitacoesRoutes);
  await app.register(statsRoutes);
  await app.register(keywordsRoutes);
  await app.register(execucoesRoutes);
  await app.register(empresaPerfilRoutes);
  await app.register(filtrosRoutes);

  // Popula empresa_perfil/filtros a partir dos arquivos em config/ se estiverem
  // vazios. Idempotente após o primeiro boot.
  try {
    await seedConfigIfEmpty();
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, 'seed config falhou');
  }

  try {
    await app.listen({ port: config.API_PORT, host: config.API_HOST });
    logger.info({ port: config.API_PORT, host: config.API_HOST }, 'api listening');
  } catch (err) {
    logger.error({ err }, 'failed to start api');
    process.exit(1);
  }

  // Sobe o cron só depois que a API estiver de pé pra evitar dispara em deploy abortado.
  startScheduler({
    enabled: config.SCHEDULER_ENABLED,
    cronExpression: config.SCHEDULER_CRON,
    timezone: config.SCHEDULER_TIMEZONE,
  });
}

main();
