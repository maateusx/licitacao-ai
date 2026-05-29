import { upsertLicitacao, type LicitacaoInput } from '../db/repositories/licitacoes.js';
import type { PncpItem } from './pncp-client.js';

export interface ProcessItemResult {
  id: string;          // db uuid
  id_pncp: string;
  inserted: boolean;
  input: LicitacaoInput;
}

/**
 * Maps a raw PNCP item to our schema and upserts. We don't know the exact
 * field shape across PNCP versions, so we accept the most common aliases
 * and fall back to null. The full raw object is stored verbatim so
 * mistakes here can be reprocessed later.
 *
 * Returns the upserted row id + the normalized input — callers downstream
 * (heuristic filter, classifier) need that without a second DB roundtrip.
 */
export async function processItem(
  item: PncpItem,
  keyword: string,
): Promise<ProcessItemResult | null> {
  const id_pncp = pickStr(item, ['numero_controle_pncp', 'numeroControlePNCP', 'id_pncp', 'id']);
  if (!id_pncp) return null;

  const input: LicitacaoInput = {
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
    keyword,
    raw: item,
  };

  const res = await upsertLicitacao(input);
  return { id: res.id, id_pncp, inserted: res.inserted, input };
}

function pickStr(obj: PncpItem, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function pickNum(obj: PncpItem, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickDate(obj: PncpItem, keys: string[]): Date | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
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
