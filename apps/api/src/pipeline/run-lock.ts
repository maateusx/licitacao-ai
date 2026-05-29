import { logger } from '../lib/logger.js';
import { runCollection, type RunOptions, type RunSummary } from './orchestrator.js';

/**
 * Garante uma execução por vez no processo (cron + botão "rodar agora" + chamada
 * manual compartilham este lock). Não persiste estado: se outra instância da API
 * subir em paralelo, ambas podem rodar — no MVP roda só uma instância local.
 */
let inFlight: Promise<RunSummary> | null = null;
let lastStartedAt: Date | null = null;

export function isRunInProgress(): boolean {
  return inFlight != null;
}

export function getLastRunStartedAt(): Date | null {
  return lastStartedAt;
}

export interface StartRunResult {
  started: boolean;
  promise: Promise<RunSummary>;
}

export function startRun(opts: RunOptions = {}, origin: string = 'manual'): StartRunResult {
  if (inFlight) {
    return { started: false, promise: inFlight };
  }
  lastStartedAt = new Date();
  logger.info({ origin, opts }, 'pipeline run starting');
  const p = runCollection(opts)
    .then((summary) => {
      logger.info({ origin, summary }, 'pipeline run done');
      return summary;
    })
    .catch((err) => {
      logger.error({ origin, err: err instanceof Error ? err.message : err }, 'pipeline run failed');
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });
  inFlight = p;
  return { started: true, promise: p };
}
