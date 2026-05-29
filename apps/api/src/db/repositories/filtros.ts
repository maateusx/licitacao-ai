import { sql } from '../client.js';

export interface FiltrosRow {
  valor_minimo: number;
  blacklist_uf: string[];
  blacklist_orgaos: string[];
  blacklist_objeto_regex: string[];
  updated_at: Date;
}

export interface FiltrosInput {
  valor_minimo: number;
  blacklist_uf: string[];
  blacklist_orgaos: string[];
  blacklist_objeto_regex: string[];
}

export async function getFiltros(): Promise<FiltrosRow | null> {
  const rows = await sql<
    {
      valor_minimo: string;
      blacklist_uf: string[];
      blacklist_orgaos: string[];
      blacklist_objeto_regex: string[];
      updated_at: Date;
    }[]
  >`
    SELECT valor_minimo, blacklist_uf, blacklist_orgaos, blacklist_objeto_regex, updated_at
    FROM filtros WHERE id = 1 LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  // numeric vem como string pelo postgres.js — converte aqui.
  return { ...r, valor_minimo: Number(r.valor_minimo) };
}

export async function upsertFiltros(input: FiltrosInput): Promise<FiltrosRow> {
  const rows = await sql<
    {
      valor_minimo: string;
      blacklist_uf: string[];
      blacklist_orgaos: string[];
      blacklist_objeto_regex: string[];
      updated_at: Date;
    }[]
  >`
    INSERT INTO filtros (id, valor_minimo, blacklist_uf, blacklist_orgaos, blacklist_objeto_regex, updated_at)
    VALUES (1, ${input.valor_minimo}, ${input.blacklist_uf}, ${input.blacklist_orgaos}, ${input.blacklist_objeto_regex}, now())
    ON CONFLICT (id) DO UPDATE SET
      valor_minimo = EXCLUDED.valor_minimo,
      blacklist_uf = EXCLUDED.blacklist_uf,
      blacklist_orgaos = EXCLUDED.blacklist_orgaos,
      blacklist_objeto_regex = EXCLUDED.blacklist_objeto_regex,
      updated_at = now()
    RETURNING valor_minimo, blacklist_uf, blacklist_orgaos, blacklist_objeto_regex, updated_at
  `;
  const r = rows[0]!;
  return { ...r, valor_minimo: Number(r.valor_minimo) };
}
