import { upsertLicitacao, type LicitacaoInput } from '../db/repositories/licitacoes.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import type { Fonte } from './fontes/comum.js';

export interface NewLicitacao {
  id: string;
  id_pncp: string;
  input: LicitacaoInput;
}

export interface FetchKeywordResult {
  fonte: string;
  keyword: string;
  found: number;
  inserted: number;
  updated: number;
  novas: NewLicitacao[];
  erro?: string;
}

export interface FetchOptions {
  maxPages?: number;
}

/** Busca uma keyword numa fonte e faz upsert de cada resultado (dedup por id_pncp). */
export async function fetchKeyword(
  fonte: Fonte,
  keyword: string,
  opts: FetchOptions = {},
): Promise<FetchKeywordResult> {
  const maxPages = opts.maxPages ?? config.PNCP_MAX_PAGES_PER_KEYWORD;
  const result: FetchKeywordResult = {
    fonte: fonte.nome,
    keyword,
    found: 0,
    inserted: 0,
    updated: 0,
    novas: [],
  };

  // Erro da fonte no meio da paginação não descarta o que já entrou: as novas
  // já gravadas precisam seguir pro classificador (no próximo run viram "updated").
  try {
    for await (const lic of fonte.buscar(keyword, maxPages)) {
      result.found++;
      const input: LicitacaoInput = { ...lic, fonte: fonte.nome, keyword };
      try {
        const res = await upsertLicitacao(input);
        if (res.inserted) {
          result.inserted++;
          result.novas.push({ id: res.id, id_pncp: input.id_pncp, input });
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.error({ fonte: fonte.nome, keyword, err: errMsg(err) }, 'upsert failed');
      }
    }
  } catch (err) {
    result.erro = errMsg(err);
    logger.error({ fonte: fonte.nome, keyword, err: result.erro }, 'fonte falhou');
  }

  return result;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
