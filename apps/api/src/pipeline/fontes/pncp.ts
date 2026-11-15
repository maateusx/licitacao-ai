import { z } from 'zod';
import { HttpClient } from '../../lib/http.js';
import { pickDate, pickNum, pickStr, type Fonte, type LicitacaoNormalizada } from './comum.js';

const BASE_URL = 'https://pncp.gov.br/api/search/';
const PAGE_SIZE = 100;

// API shape varies; keep tolerant. We only care that items is an array.
const PncpSearchResponseSchema = z
  .object({
    items: z.array(z.record(z.string(), z.unknown())).default([]),
    total_paginas: z.number().optional(),
    totalPaginas: z.number().optional(),
  })
  .passthrough();

type PncpItem = Record<string, unknown>;

const http = new HttpClient('PNCP');

export const pncp: Fonte = {
  nome: 'pncp',
  async *buscar(keyword, maxPages) {
    for (let pagina = 1; pagina <= maxPages; pagina++) {
      const qs = new URLSearchParams({
        q: keyword,
        tipos_documento: 'edital',
        ordenacao: '-data',
        pagina: String(pagina),
        tam_pagina: String(PAGE_SIZE),
        status: 'recebendo_proposta',
        tipos: '1|4',
      });
      const res = PncpSearchResponseSchema.parse(await http.getJson(`${BASE_URL}?${qs}`));
      for (const item of res.items) {
        const lic = mapPncpItem(item);
        if (lic) yield lic;
      }
      const totalPaginas = res.total_paginas ?? res.totalPaginas;
      if (res.items.length < PAGE_SIZE || (totalPaginas && pagina >= totalPaginas)) break;
    }
  },
};

/**
 * We don't know the exact field shape across PNCP versions, so we accept the
 * most common aliases and fall back to null. The full raw object is stored
 * verbatim so mistakes here can be reprocessed later.
 */
export function mapPncpItem(item: PncpItem): LicitacaoNormalizada | null {
  const id_pncp = pickStr(item, ['numero_controle_pncp', 'numeroControlePNCP', 'id_pncp', 'id']);
  if (!id_pncp) return null;

  return {
    id_pncp,
    titulo: pickStr(item, ['title', 'titulo', 'objeto_compra']),
    objeto: pickStr(item, ['description', 'descricao', 'objeto', 'objeto_compra']),
    orgao: pickStr(item, ['orgao_nome', 'orgaoNome', 'nome_orgao', 'orgao']),
    uf: pickStr(item, ['uf', 'sigla_uf', 'unidadeOrgao_ufSigla']),
    municipio: pickStr(item, ['municipio_nome', 'municipioNome', 'nome_municipio', 'municipio']),
    modalidade: pickStr(item, [
      'modalidade_licitacao_nome',
      'modalidadeNome',
      'nome_modalidade',
      'modalidade',
    ]),
    valor_estimado: pickNum(item, [
      'valor_global',
      'valorGlobal',
      'valor_total_estimado',
      'valorTotalEstimado',
      'valor_estimado',
    ]),
    status: pickStr(item, ['situacao', 'status', 'situacao_compra_nome']),
    data_publicacao: pickDate(item, [
      'data_publicacao_pncp',
      'dataPublicacaoPncp',
      'data_publicacao',
      'dataPublicacao',
    ]),
    data_abertura: pickDate(item, [
      'data_abertura_proposta',
      'dataAberturaProposta',
      'data_inicio_vigencia',
      'dataInicioVigencia',
    ]),
    data_encerramento: pickDate(item, [
      'data_encerramento_proposta',
      'dataEncerramentoProposta',
      'data_fim_vigencia',
      'dataFimVigencia',
    ]),
    url_pncp: buildPncpUrl(item, id_pncp),
    raw: item,
  };
}

function buildPncpUrl(item: PncpItem, id_pncp: string): string {
  const explicit = pickStr(item, ['item_url', 'itemUrl', 'url']);
  if (explicit) {
    // PNCP devolve algo tipo `/compras/{cnpj}/{ano}/{seq}` (às vezes `/app/compras/...`).
    // A view de edital correta fica em `/app/editais/...` — normalizamos.
    const abs = explicit.startsWith('http') ? explicit : `https://pncp.gov.br${explicit}`;
    return abs.replace(/\/(?:app\/)?compras\//, '/app/editais/');
  }
  return `https://pncp.gov.br/app/editais/${encodeURIComponent(id_pncp)}`;
}
