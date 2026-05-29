import { request } from 'undici';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import {
  buildClassifierPrompt,
  buildCorrectionPrompt,
  PROMPT_VERSION,
  type PromptInput,
} from './prompts/classifier.v1.js';

export const ClassifierOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  categoria: z.enum(['core', 'adjacente', 'fora']),
  justificativa: z.string().min(1),
  pontos_fortes: z.array(z.string()).max(10).default([]),
  red_flags: z.array(z.string()).max(10).default([]),
});

export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>;

export interface ClassificationSuccess {
  ok: true;
  modelo: string;
  prompt_version: string;
  output: ClassifierOutput;
  attempts: number;
}

export interface ClassificationFailure {
  ok: false;
  modelo: string;
  prompt_version: string;
  erro: string;
  attempts: number;
  last_raw: string | null;
}

export type ClassificationResult = ClassificationSuccess | ClassificationFailure;

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const GeminiResponseSchema = z
  .object({
    candidates: z
      .array(
        z.object({
          content: z
            .object({
              parts: z.array(z.object({ text: z.string().optional() }).passthrough()).default([]),
            })
            .passthrough()
            .optional(),
        }).passthrough(),
      )
      .default([]),
    promptFeedback: z.unknown().optional(),
  })
  .passthrough();

export interface GeminiClassifierOptions {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  rateLimitMs?: number;
}

export class GeminiClassifier {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly rateLimitMs: number;
  private nextAllowedAt = 0;

  constructor(opts: GeminiClassifierOptions = {}) {
    const apiKey = opts.apiKey ?? config.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY ausente — configure no .env antes de rodar o classificador');
    }
    this.apiKey = apiKey;
    this.model = opts.model ?? config.GEMINI_MODEL;
    this.maxRetries = opts.maxRetries ?? config.CLASSIFIER_MAX_RETRIES;
    this.rateLimitMs = opts.rateLimitMs ?? config.GEMINI_RATE_LIMIT_MS;
  }

  async classify(input: PromptInput): Promise<ClassificationResult> {
    const basePrompt = await buildClassifierPrompt(input);
    let prompt = basePrompt;
    let lastRaw: string | null = null;
    let lastError: string = 'unknown';

    const totalAttempts = this.maxRetries + 1;
    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      let raw: string;
      try {
        raw = await this.callGemini(prompt);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn({ attempt, err: lastError }, 'gemini call failed');
        if (attempt === totalAttempts) {
          return this.failure(lastError, lastRaw, attempt);
        }
        prompt = buildCorrectionPrompt(basePrompt, '', lastError);
        continue;
      }

      lastRaw = raw;
      const parsed = tryParseJson(raw);
      if (!parsed.ok) {
        lastError = parsed.error;
        logger.warn({ attempt, err: lastError }, 'gemini output not JSON');
        if (attempt === totalAttempts) return this.failure(lastError, lastRaw, attempt);
        prompt = buildCorrectionPrompt(basePrompt, raw, lastError);
        continue;
      }

      const validated = ClassifierOutputSchema.safeParse(parsed.value);
      if (!validated.success) {
        lastError = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        logger.warn({ attempt, err: lastError }, 'gemini output schema invalid');
        if (attempt === totalAttempts) return this.failure(lastError, lastRaw, attempt);
        prompt = buildCorrectionPrompt(basePrompt, raw, lastError);
        continue;
      }

      return {
        ok: true,
        modelo: this.model,
        prompt_version: PROMPT_VERSION,
        output: validated.data,
        attempts: attempt,
      };
    }

    return this.failure(lastError, lastRaw, totalAttempts);
  }

  private failure(erro: string, last_raw: string | null, attempts: number): ClassificationFailure {
    return {
      ok: false,
      modelo: this.model,
      prompt_version: PROMPT_VERSION,
      erro,
      attempts,
      last_raw,
    };
  }

  private async waitForSlot(): Promise<void> {
    const now = Date.now();
    const wait = this.nextAllowedAt - now;
    if (wait > 0) await sleep(wait);
    this.nextAllowedAt = Date.now() + this.rateLimitMs;
  }

  private async callGemini(prompt: string): Promise<string> {
    await this.waitForSlot();
    const url = `${GEMINI_BASE}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    };

    const res = await request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      headersTimeout: 30_000,
      bodyTimeout: 60_000,
    });

    const text = await res.body.text();
    if (res.statusCode >= 400) {
      throw new Error(`gemini ${res.statusCode}: ${text.slice(0, 400)}`);
    }

    const json = JSON.parse(text);
    const parsed = GeminiResponseSchema.parse(json);
    const candidate = parsed.candidates[0];
    const part = candidate?.content?.parts?.find((p) => typeof p.text === 'string' && p.text.length > 0);
    if (!part?.text) {
      throw new Error(`gemini retornou sem texto: ${JSON.stringify(parsed.promptFeedback ?? {})}`);
    }
    return part.text;
  }
}

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const cleaned = stripCodeFences(raw).trim();
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
