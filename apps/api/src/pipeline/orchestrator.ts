import { insertAnalise } from '../db/repositories/analises.js';
import { listActiveKeywords } from '../db/repositories/keywords.js';
import { sql } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { fetchKeyword, type FetchKeywordResult, type NewLicitacao } from './fetcher.js';
import { GeminiClassifier } from './gemini-classifier.js';
import { applyHeuristicFilter, type FilterReason } from './heuristic-filter.js';
import { PROMPT_VERSION } from './prompts/classifier.v1.js';
import { fontesAtivas } from './fontes/index.js';
import { loadFiltros } from '../lib/filtros.js';
import { loadEmpresaPerfil } from '../lib/empresa-perfil.js';

export interface RunSummary {
  execucao_id: string;
  total_encontradas: number;
  total_novas: number;
  total_filtradas: number;
  total_classificadas: number;
  total_erros_class: number;
  por_keyword: FetchKeywordResult[];
  motivos_filtro: Partial<Record<FilterReason, number>>;
}

export interface RunOptions {
  keywords?: string[]; // override; defaults to all active keywords
  fontes?: string[]; // override; defaults to env FONTES
  maxPagesPerKeyword?: number;
  skipClassification?: boolean; // útil para smoke test sem custo
}

export async function runCollection(opts: RunOptions = {}): Promise<RunSummary> {
  const keywords = opts.keywords
    ? opts.keywords.map((termo) => ({ termo }))
    : await listActiveKeywords();

  if (keywords.length === 0) {
    logger.warn('no keywords to fetch — seed first');
  }

  const execucao = await sql<{ id: string }[]>`
    INSERT INTO execucoes (status) VALUES ('running') RETURNING id
  `;
  const execucao_id = execucao[0]!.id;
  logger.info({ execucao_id, keywords: keywords.length }, 'collection started');

  const fontes = fontesAtivas(opts.fontes);
  const por_keyword: FetchKeywordResult[] = [];
  let total_encontradas = 0;
  let total_novas = 0;
  let total_filtradas = 0;
  let total_classificadas = 0;
  let total_erros_class = 0;
  const motivos_filtro: Partial<Record<FilterReason, number>> = {};

  // Acumula novas únicas por id (mesmo edital pode aparecer em várias keywords).
  const novasUnicas = new Map<string, NewLicitacao>();

  try {
    // ponytail: fontes em série; rodar em paralelo (cada uma tem seu rate-limit) se o run ficar lento.
    for (const fonte of fontes) {
      for (const kw of keywords) {
        const r = await fetchKeyword(fonte, kw.termo, {
          maxPages: opts.maxPagesPerKeyword,
        });
        por_keyword.push(r);
        total_encontradas += r.found;
        total_novas += r.inserted;
        for (const n of r.novas) {
          if (!novasUnicas.has(n.id)) novasUnicas.set(n.id, n);
        }
        logger.info(
          { fonte: r.fonte, keyword: r.keyword, found: r.found, inserted: r.inserted, updated: r.updated, erro: r.erro },
          'keyword done',
        );
      }
    }
    // Falha de fonte não derruba o run; fica registrada em execucoes.erro.
    const errosFonte = por_keyword
      .filter((r) => r.erro)
      .map((r) => `${r.fonte}/${r.keyword}: ${r.erro}`);

    if (opts.skipClassification) {
      logger.info({ novas: novasUnicas.size }, 'skipClassification=true — pulando filtro/classifier');
    } else if (novasUnicas.size > 0) {
      const classifier = new GeminiClassifier();
      const filtros = await loadFiltros();
      // Pré-aquece o cache do perfil pra evitar IO em cada classificação.
      await loadEmpresaPerfil();
      logger.info({ novas: novasUnicas.size }, 'iniciando filtro + classificação');

      for (const nova of novasUnicas.values()) {
        const filterRes = applyHeuristicFilter({
          valor_estimado: nova.input.valor_estimado,
          uf: nova.input.uf,
          orgao: nova.input.orgao,
          objeto: nova.input.objeto,
        }, filtros);

        if (!filterRes.passou) {
          total_filtradas++;
          motivos_filtro[filterRes.motivo] = (motivos_filtro[filterRes.motivo] ?? 0) + 1;
          logger.debug(
            { id_pncp: nova.id_pncp, motivo: filterRes.motivo, detalhe: filterRes.detalhe },
            'licitacao filtrada (não vai ao gemini)',
          );
          continue;
        }

        try {
          const result = await classifier.classify({
            titulo: nova.input.titulo,
            orgao: nova.input.orgao,
            uf: nova.input.uf,
            objeto: nova.input.objeto,
            valor_estimado: nova.input.valor_estimado,
            modalidade: nova.input.modalidade,
          });

          if (result.ok) {
            await insertAnalise({
              licitacao_id: nova.id,
              score: result.output.score,
              categoria: result.output.categoria,
              justificativa: result.output.justificativa,
              pontos_fortes: result.output.pontos_fortes,
              red_flags: result.output.red_flags,
              modelo: result.modelo,
              prompt_version: result.prompt_version,
              erro: null,
            });
            total_classificadas++;
            logger.info(
              {
                id_pncp: nova.id_pncp,
                score: result.output.score,
                categoria: result.output.categoria,
                attempts: result.attempts,
              },
              'classificada',
            );
          } else {
            await insertAnalise({
              licitacao_id: nova.id,
              score: null,
              categoria: 'fora',
              justificativa: null,
              pontos_fortes: null,
              red_flags: null,
              modelo: result.modelo,
              prompt_version: result.prompt_version,
              erro: result.erro,
            });
            total_erros_class++;
            logger.error(
              { id_pncp: nova.id_pncp, erro: result.erro, attempts: result.attempts },
              'classificação falhou — gravada como fora/null',
            );
          }
        } catch (err) {
          // Erro inesperado fora dos retries do classifier — não derruba a execução.
          const msg = err instanceof Error ? err.message : String(err);
          total_erros_class++;
          logger.error({ id_pncp: nova.id_pncp, err: msg }, 'erro inesperado ao classificar');
          try {
            await insertAnalise({
              licitacao_id: nova.id,
              score: null,
              categoria: 'fora',
              justificativa: null,
              pontos_fortes: null,
              red_flags: null,
              modelo: 'desconhecido',
              prompt_version: PROMPT_VERSION,
              erro: msg,
            });
          } catch (dbErr) {
            logger.error(
              { id_pncp: nova.id_pncp, err: dbErr instanceof Error ? dbErr.message : dbErr },
              'falhou ao gravar análise de erro',
            );
          }
        }
      }
    }

    await sql`
      UPDATE execucoes
      SET finished_at = now(),
          status = 'done',
          erro = ${errosFonte.length ? errosFonte.join('\n').slice(0, 4000) : null},
          total_encontradas = ${total_encontradas},
          total_novas = ${total_novas},
          total_classificadas = ${total_classificadas},
          total_filtradas = ${total_filtradas},
          total_erros_class = ${total_erros_class}
      WHERE id = ${execucao_id}
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sql`
      UPDATE execucoes
      SET finished_at = now(),
          status = 'error',
          erro = ${msg},
          total_encontradas = ${total_encontradas},
          total_novas = ${total_novas},
          total_classificadas = ${total_classificadas},
          total_filtradas = ${total_filtradas},
          total_erros_class = ${total_erros_class}
      WHERE id = ${execucao_id}
    `;
    throw err;
  }

  return {
    execucao_id,
    total_encontradas,
    total_novas,
    total_filtradas,
    total_classificadas,
    total_erros_class,
    por_keyword,
    motivos_filtro,
  };
}
