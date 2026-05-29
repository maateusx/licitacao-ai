import { sql } from '../client.js';

export interface AnaliseInput {
  licitacao_id: string;
  score: number | null;
  categoria: 'core' | 'adjacente' | 'fora';
  justificativa: string | null;
  pontos_fortes: string[] | null;
  red_flags: string[] | null;
  modelo: string;
  prompt_version: string;
  erro: string | null;
}

export interface AnaliseRow {
  id: string;
  licitacao_id: string;
  score: number | null;
  categoria: string;
  created_at: Date;
}

/**
 * Sempre INSERT — reanálise gera nova linha sem apagar a anterior (1:N).
 */
export async function insertAnalise(input: AnaliseInput): Promise<AnaliseRow> {
  const rows = await sql<AnaliseRow[]>`
    INSERT INTO analises (
      licitacao_id, score, categoria, justificativa,
      pontos_fortes, red_flags, modelo, prompt_version, erro
    ) VALUES (
      ${input.licitacao_id},
      ${input.score},
      ${input.categoria},
      ${input.justificativa},
      ${input.pontos_fortes ? sql.json(input.pontos_fortes) : null},
      ${input.red_flags ? sql.json(input.red_flags) : null},
      ${input.modelo},
      ${input.prompt_version},
      ${input.erro}
    )
    RETURNING id, licitacao_id, score, categoria, created_at
  `;
  const row = rows[0];
  if (!row) throw new Error('insertAnalise returned no rows');
  return row;
}

export async function countAnalises(): Promise<number> {
  const rows = await sql<{ count: string }[]>`SELECT count(*)::text FROM analises`;
  return Number(rows[0]?.count ?? 0);
}
