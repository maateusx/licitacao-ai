import { z } from 'zod';
import { HttpClient } from '../../lib/http.js';
import { pickStr, type Fonte, type LicitacaoNormalizada } from './comum.js';

// api.queridodiario.ok.org.br redireciona (302) pra cá; undici não segue redirect.
const BASE_URL = 'https://api.queridodiario.org.br/gazettes';
const PAGE_SIZE = 50;
// Aviso de licitação em diário tem prazo curto (8 dias úteis no pregão): olhar só a última semana.
const JANELA_DIAS = 7;

const GazettesResponseSchema = z
  .object({
    total_gazettes: z.number().optional(),
    gazettes: z.array(z.record(z.string(), z.unknown())).default([]),
  })
  .passthrough();

// API lenta (busca full-text): 15s padrão estoura com frequência.
const http = new HttpClient('QueridoDiario', undefined, undefined, 60_000);

/**
 * Diários oficiais municipais (Open Knowledge Brasil). A unidade é o diário
 * inteiro do dia, não o edital: gravamos 1 registro por diário com os trechos
 * que casaram como `objeto`, e o classificador decide se há oportunidade ali.
 * ponytail: sem valor/prazo estruturados; extrair do texto com o Gemini se fizer falta.
 */
export const queridoDiario: Fonte = {
  nome: 'querido_diario',
  async *buscar(keyword, maxPages) {
    const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000).toISOString().slice(0, 10);
    for (let pagina = 0; pagina < maxPages; pagina++) {
      const qs = new URLSearchParams({
        // simple_query_string do Elasticsearch: termo exato E algum sinal de licitação.
        querystring: `"${keyword}" + (licitação | pregão | edital)`,
        published_since: desde,
        excerpt_size: '500',
        number_of_excerpts: '3',
        sort_by: 'descending_date',
        size: String(PAGE_SIZE),
        offset: String(pagina * PAGE_SIZE),
      });
      const res = GazettesResponseSchema.parse(await http.getJson(`${BASE_URL}?${qs}`));
      for (const g of res.gazettes) {
        const lic = mapGazette(g);
        if (lic) yield lic;
      }
      const total = res.total_gazettes ?? 0;
      if (res.gazettes.length < PAGE_SIZE || (pagina + 1) * PAGE_SIZE >= total) break;
    }
  },
};

export function mapGazette(g: Record<string, unknown>): LicitacaoNormalizada | null {
  const territorio = pickStr(g, ['territory_id']);
  const data = pickStr(g, ['date']);
  if (!territorio || !data) return null;

  const edicao = pickStr(g, ['edition']) ?? 'u';
  const extra = g.is_extra_edition === true ? '-extra' : '';
  const municipio = pickStr(g, ['territory_name']);
  const uf = pickStr(g, ['state_code']);
  const trechos = (Array.isArray(g.excerpts) ? g.excerpts : Array.isArray(g.highlight_texts) ? g.highlight_texts : [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

  return {
    id_pncp: `querido_diario:${territorio}-${data}-${edicao}${extra}`,
    titulo: `Diário Oficial de ${municipio ?? territorio}${uf ? `/${uf}` : ''} — ${data}`,
    objeto: trechos.join('\n…\n') || null,
    orgao: municipio ? `Prefeitura Municipal de ${municipio}` : null,
    uf,
    municipio,
    modalidade: null,
    valor_estimado: null,
    status: null,
    data_publicacao: new Date(`${data}T12:00:00-03:00`),
    data_abertura: null,
    data_encerramento: null,
    url_pncp: pickStr(g, ['url', 'txt_url']),
    raw: g,
  };
}
