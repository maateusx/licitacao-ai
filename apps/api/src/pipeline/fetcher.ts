import type { LicitacaoInput } from '../db/repositories/licitacoes.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { processItem } from './dedup.js';
import { PncpClient } from './pncp-client.js';

export interface NewLicitacao {
  id: string;
  id_pncp: string;
  input: LicitacaoInput;
}

export interface FetchKeywordResult {
  keyword: string;
  pages: number;
  found: number;
  inserted: number;
  updated: number;
  novas: NewLicitacao[];
}

export interface FetchOptions {
  maxPages?: number;
  pageSize?: number;
}

export async function fetchKeyword(
  client: PncpClient,
  keyword: string,
  opts: FetchOptions = {},
): Promise<FetchKeywordResult> {
  const maxPages = opts.maxPages ?? config.PNCP_MAX_PAGES_PER_KEYWORD;
  const pageSize = opts.pageSize ?? 100;

  const result: FetchKeywordResult = {
    keyword,
    pages: 0,
    found: 0,
    inserted: 0,
    updated: 0,
    novas: [],
  };

  for (let page = 1; page <= maxPages; page++) {
    logger.debug({ keyword, page }, 'pncp fetch page');
    const res = await client.search({ q: keyword, pagina: page, tam_pagina: pageSize });
    result.pages = page;

    const items = res.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      result.found++;
      try {
        const out = await processItem(item, keyword);
        if (!out) continue;
        if (out.inserted) {
          result.inserted++;
          result.novas.push({ id: out.id, id_pncp: out.id_pncp, input: out.input });
        } else {
          result.updated++;
        }
      } catch (err) {
        logger.error({ keyword, err: err instanceof Error ? err.message : err }, 'dedup failed');
      }
    }

    const totalPages = res.total_paginas ?? res.totalPaginas;
    if (totalPages && page >= totalPages) break;
    if (items.length < pageSize) break; // last partial page
  }

  return result;
}
