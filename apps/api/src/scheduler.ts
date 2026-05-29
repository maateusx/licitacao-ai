import { schedule, validate, type ScheduledTask } from 'node-cron';
import { logger } from './lib/logger.js';
import { startRun } from './pipeline/run-lock.js';

/**
 * Cron in-process via node-cron. O default `0 6,18 * * *` dispara 6h e 18h
 * (horário do sistema) — 2x/dia conforme spec. Pode ser sobrescrito via
 * SCHEDULER_CRON; desabilitado totalmente quando SCHEDULER_ENABLED=false.
 */
const DEFAULT_CRON = '0 6,18 * * *';

export interface SchedulerOptions {
  enabled: boolean;
  cronExpression: string;
  timezone?: string;
}

export function startScheduler(opts: SchedulerOptions): ScheduledTask | null {
  if (!opts.enabled) {
    logger.info('scheduler disabled (SCHEDULER_ENABLED=false)');
    return null;
  }
  if (!validate(opts.cronExpression)) {
    logger.error({ cron: opts.cronExpression }, 'scheduler: cron inválido — não vai rodar');
    return null;
  }

  const task = schedule(
    opts.cronExpression,
    () => {
      const r = startRun({}, 'cron');
      if (!r.started) {
        logger.warn('scheduler: tick ignorado — execução anterior ainda em andamento');
        return;
      }
      r.promise.catch(() => undefined);
    },
    {
      name: 'pipeline-collect',
      timezone: opts.timezone,
      noOverlap: true,
    },
  );

  const next = task.getNextRun();
  logger.info(
    { cron: opts.cronExpression, timezone: opts.timezone ?? 'system', next_run: next },
    'scheduler started',
  );
  return task;
}

export const SCHEDULER_DEFAULT_CRON = DEFAULT_CRON;
