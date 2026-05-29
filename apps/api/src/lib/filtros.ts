import { getFiltros } from '../db/repositories/filtros.js';
import { config } from '../config.js';

export interface Filtros {
  valor_minimo: number;
  blacklist_uf: string[];
  blacklist_orgaos: string[];
  blacklist_objeto_regex: RegExp[];
}

let cached: Filtros | null = null;

/**
 * Lê os filtros do banco e compila as regex. Cache em memória; invalidar via
 * {@link resetFiltrosCache} após PATCH. Se a tabela estiver vazia (boot antes do
 * seed rodar), faz fallback para `HEURISTIC_VALOR_MINIMO` do env e listas vazias.
 *
 * Regex inválidas são logadas e ignoradas — a validação primária acontece no
 * endpoint PATCH, então isso só protege contra dados ruins legados no banco.
 */
export async function loadFiltros(): Promise<Filtros> {
  if (cached) return cached;
  const row = await getFiltros();
  const compiledRegex: RegExp[] = [];
  if (row) {
    for (const p of row.blacklist_objeto_regex) {
      try {
        compiledRegex.push(new RegExp(p, 'i'));
      } catch {
        // Skip: regex inválida — não deveria ter passado pelo PATCH.
      }
    }
  }
  cached = {
    valor_minimo: row?.valor_minimo ?? config.HEURISTIC_VALOR_MINIMO,
    blacklist_uf: (row?.blacklist_uf ?? []).map((u) => u.toUpperCase()),
    blacklist_orgaos: (row?.blacklist_orgaos ?? []).map((o) => o.toLowerCase()),
    blacklist_objeto_regex: compiledRegex,
  };
  return cached;
}

export function resetFiltrosCache(): void {
  cached = null;
}
