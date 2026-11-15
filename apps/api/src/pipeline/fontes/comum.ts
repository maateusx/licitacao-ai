import type { LicitacaoInput } from '../../db/repositories/licitacoes.js';

/** O que uma fonte devolve: a licitação já no nosso formato; fetcher completa fonte/keyword. */
export type LicitacaoNormalizada = Omit<LicitacaoInput, 'fonte' | 'keyword'>;

export interface Fonte {
  /** Gravado em licitacoes.fonte. Fontes != pncp prefixam o id com `${nome}:`. */
  nome: string;
  buscar(keyword: string, maxPages: number): AsyncIterable<LicitacaoNormalizada>;
}

type Obj = Record<string, unknown>;

export function pickStr(obj: Obj, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}

export function pickNum(obj: Obj, keys: string[]): number | null {
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

export function pickDate(obj: Obj, keys: string[]): Date | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Pra fontes sem busca no servidor (listam tudo): keyword casa como palavra
 * inteira, sem acento/caixa — "IA" não casa com "materiais".
 */
export function casaKeyword(texto: string, keyword: string): boolean {
  const k = norm(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${k}\\b`).test(norm(texto));
}
