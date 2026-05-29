import { request } from 'undici';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const BASE_URL = 'https://pncp.gov.br/api/search/';

// API shape varies; keep tolerant. We only care that items is an array.
const PncpSearchResponseSchema = z
  .object({
    items: z.array(z.record(z.string(), z.unknown())).default([]),
    total: z.number().optional(),
    total_paginas: z.number().optional(),
    totalPaginas: z.number().optional(),
  })
  .passthrough();

export type PncpSearchResponse = z.infer<typeof PncpSearchResponseSchema>;
export type PncpItem = Record<string, unknown>;

export interface SearchParams {
  q: string;
  pagina: number;
  tam_pagina?: number;
}

export class PncpClient {
  private nextAllowedAt = 0;
  private readonly rateLimitMs: number;
  private readonly userAgent: string;

  constructor(opts?: { rateLimitMs?: number; userAgent?: string }) {
    this.rateLimitMs = opts?.rateLimitMs ?? config.PNCP_RATE_LIMIT_MS;
    this.userAgent = opts?.userAgent ?? config.PNCP_USER_AGENT;
  }

  async search(params: SearchParams): Promise<PncpSearchResponse> {
    const url = this.buildUrl(params);
    const json = await this.requestWithRetry(url);
    return PncpSearchResponseSchema.parse(json);
  }

  private buildUrl(params: SearchParams): string {
    const qs = new URLSearchParams({
      q: params.q,
      tipos_documento: 'edital',
      ordenacao: '-data',
      pagina: String(params.pagina),
      tam_pagina: String(params.tam_pagina ?? 100),
      status: 'recebendo_proposta',
      tipos: '1|4',
    });
    return `${BASE_URL}?${qs.toString()}`;
  }

  private async waitForSlot(): Promise<void> {
    const now = Date.now();
    const wait = this.nextAllowedAt - now;
    if (wait > 0) await sleep(wait);
    this.nextAllowedAt = Date.now() + this.rateLimitMs;
  }

  private async requestWithRetry(url: string): Promise<unknown> {
    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.waitForSlot();
      try {
        const res = await request(url, {
          method: 'GET',
          headers: {
            'User-Agent': this.userAgent,
            accept: 'application/json',
          },
          headersTimeout: 15_000,
          bodyTimeout: 30_000,
        });

        if (res.statusCode >= 500) {
          const body = await res.body.text();
          throw new RetryableError(`PNCP ${res.statusCode}: ${body.slice(0, 200)}`);
        }
        if (res.statusCode >= 400) {
          const body = await res.body.text();
          throw new Error(`PNCP ${res.statusCode}: ${body.slice(0, 200)}`);
        }
        return await res.body.json();
      } catch (err) {
        lastErr = err;
        const retryable = err instanceof RetryableError || isNetworkError(err);
        if (!retryable || attempt === maxAttempts) break;
        const backoff = 2 ** (attempt - 1) * 1000;
        logger.warn({ url, attempt, backoff, err: errMsg(err) }, 'pncp retry');
        await sleep(backoff);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

class RetryableError extends Error {}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    code === 'UND_ERR_SOCKET' ||
    err.name === 'TimeoutError' ||
    err.name === 'HeadersTimeoutError' ||
    err.name === 'BodyTimeoutError'
  );
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
