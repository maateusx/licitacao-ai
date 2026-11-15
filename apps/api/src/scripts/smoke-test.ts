import { sql } from '../db/client.js';
import { countAnalises } from '../db/repositories/analises.js';
import { countLicitacoes } from '../db/repositories/licitacoes.js';
import { logger } from '../lib/logger.js';
import { runCollection } from '../pipeline/orchestrator.js';

/**
 * Smoke test: run pipeline for one keyword end-to-end and report counts.
 *
 * Usos:
 *   pnpm smoke                       # keyword "chatbot", 2 páginas, com classificador
 *   pnpm smoke chatbot 1             # keyword + maxPages
 *   pnpm smoke chatbot 1 --no-class  # pula a chamada ao Gemini (não gasta token)
 *   pnpm smoke chatbot 1 --fonte=querido_diario  # só essa(s) fonte(s), separadas por vírgula
 */
async function main() {
  const args = process.argv.slice(2);
  const skipClassification = args.includes('--no-class');
  const fontes = args.find((a) => a.startsWith('--fonte='))?.slice('--fonte='.length).split(',');
  const positionals = args.filter((a) => !a.startsWith('--'));
  const keyword = positionals[0] ?? 'chatbot';
  const maxPagesPerKeyword = positionals[1] ? Number(positionals[1]) : 2;

  logger.info({ keyword, maxPagesPerKeyword, skipClassification }, 'smoke test starting');

  const [licitacoesBefore, analisesBefore] = await Promise.all([
    countLicitacoes(),
    countAnalises(),
  ]);

  const summary = await runCollection({
    keywords: [keyword],
    maxPagesPerKeyword,
    skipClassification,
    fontes,
  });

  const [licitacoesAfter, analisesAfter] = await Promise.all([
    countLicitacoes(),
    countAnalises(),
  ]);

  logger.info(
    {
      execucao_id: summary.execucao_id,
      encontradas: summary.total_encontradas,
      novas: summary.total_novas,
      filtradas: summary.total_filtradas,
      classificadas: summary.total_classificadas,
      erros_classificacao: summary.total_erros_class,
      motivos_filtro: summary.motivos_filtro,
      licitacoes_no_banco: { antes: licitacoesBefore, depois: licitacoesAfter },
      analises_no_banco: { antes: analisesBefore, depois: analisesAfter },
      por_keyword: summary.por_keyword.map((k) => ({
        fonte: k.fonte,
        keyword: k.keyword,
        found: k.found,
        inserted: k.inserted,
        updated: k.updated,
        erro: k.erro,
      })),
    },
    'smoke test done',
  );

  await sql.end();
}

main().catch(async (err) => {
  logger.error({ err: err instanceof Error ? err.message : err }, 'smoke test failed');
  await sql.end({ timeout: 5 }).catch(() => undefined);
  process.exit(1);
});
