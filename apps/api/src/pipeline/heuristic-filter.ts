import type { Filtros } from '../lib/filtros.js';

export interface FilterInput {
  valor_estimado: number | null;
  uf: string | null;
  orgao: string | null;
  objeto: string | null;
}

export type FilterReason =
  | 'valor_abaixo_do_minimo'
  | 'uf_em_blacklist'
  | 'orgao_em_blacklist'
  | 'objeto_em_blacklist_regex';

export interface FilterPass {
  passou: true;
}

export interface FilterReject {
  passou: false;
  motivo: FilterReason;
  detalhe?: string;
}

export type FilterResult = FilterPass | FilterReject;

/**
 * Aplica em sequência com curto-circuito (primeiro motivo de reprovação ganha):
 *   1. valor_estimado >= valor_minimo
 *   2. uf NOT IN blacklist_uf
 *   3. orgao NOT IN blacklist_orgaos  (match case-insensitive por substring)
 *   4. objeto não casa com nenhuma regex de blacklist
 *
 * Campos null/ausentes nunca reprovam — preferimos mandar pro LLM e deixar ele
 * decidir do que descartar silenciosamente por dado faltante.
 */
export function applyHeuristicFilter(input: FilterInput, filtros: Filtros): FilterResult {
  if (input.valor_estimado != null && input.valor_estimado < filtros.valor_minimo) {
    return {
      passou: false,
      motivo: 'valor_abaixo_do_minimo',
      detalhe: `valor_estimado=${input.valor_estimado} < ${filtros.valor_minimo}`,
    };
  }

  if (input.uf && filtros.blacklist_uf.includes(input.uf.toUpperCase())) {
    return { passou: false, motivo: 'uf_em_blacklist', detalhe: input.uf };
  }

  if (input.orgao && filtros.blacklist_orgaos.length > 0) {
    const orgaoLc = input.orgao.toLowerCase();
    const hit = filtros.blacklist_orgaos.find((o) => orgaoLc.includes(o));
    if (hit) return { passou: false, motivo: 'orgao_em_blacklist', detalhe: hit };
  }

  if (input.objeto && filtros.blacklist_objeto_regex.length > 0) {
    for (const re of filtros.blacklist_objeto_regex) {
      if (re.test(input.objeto)) {
        return { passou: false, motivo: 'objeto_em_blacklist_regex', detalhe: re.source };
      }
    }
  }

  return { passou: true };
}
