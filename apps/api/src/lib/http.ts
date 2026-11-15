import { request } from 'undici';
import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * GET com rate-limit (1 instância = 1 fila) e retry com backoff em 5xx/erro de rede.
 * Cada fonte cria a sua instância para não dividir o rate-limit com as outras.
 */
export class HttpClient {
  private nextAllowedAt = 0;

  constructor(
    private readonly label: string,
    private readonly rateLimitMs: number = config.PNCP_RATE_LIMIT_MS,
    private readonly userAgent: string = config.PNCP_USER_AGENT,
    private readonly timeoutMs: number = 15_000,
  ) {}

  async getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
    return JSON.parse(await this.getText(url, { accept: 'application/json', ...headers }));
  }

  async getText(url: string, headers: Record<string, string> = {}): Promise<string> {
    return (await this.send(url, { headers })).body;
  }

  async postJson(url: string, body: string, headers: Record<string, string> = {}): Promise<unknown> {
    const res = await this.send(url, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json; charset=utf-8', accept: 'application/json', ...headers },
    });
    return JSON.parse(res.body);
  }

  /** Request cru (devolve headers também, ex.: set-cookie). Erro em status >= 400. */
  async send(
    url: string,
    opts: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string } = {},
  ): Promise<{ body: string; headers: Record<string, string | string[] | undefined> }> {
    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.waitForSlot();
      try {
        const res = await request(url, {
          method: opts.method ?? 'GET',
          headers: { 'User-Agent': this.userAgent, ...opts.headers },
          body: opts.body,
          headersTimeout: this.timeoutMs,
          bodyTimeout: this.timeoutMs * 2,
        });
        const body = await res.body.text();
        if (res.statusCode >= 500) {
          throw new RetryableError(`${this.label} ${res.statusCode}: ${body.slice(0, 200)}`);
        }
        if (res.statusCode >= 400) {
          throw new Error(`${this.label} ${res.statusCode}: ${body.slice(0, 200)}`);
        }
        return { body, headers: res.headers };
      } catch (err) {
        lastErr = err;
        const retryable = err instanceof RetryableError || isNetworkError(err);
        if (!retryable || attempt === maxAttempts) break;
        const backoff = 2 ** (attempt - 1) * 1000;
        logger.warn({ url, attempt, backoff, err: errMsg(err) }, `${this.label} retry`);
        await sleep(backoff);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private async waitForSlot(): Promise<void> {
    const wait = this.nextAllowedAt - Date.now();
    if (wait > 0) await sleep(wait);
    this.nextAllowedAt = Date.now() + this.rateLimitMs;
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
