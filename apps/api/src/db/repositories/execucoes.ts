import { sql } from '../client.js';

export interface ExecucaoRow {
  id: string;
  started_at: Date;
  finished_at: Date | null;
  total_encontradas: number;
  total_novas: number;
  total_classificadas: number;
  total_filtradas: number;
  total_erros_class: number;
  status: string;
  erro: string | null;
}

export async function listExecucoes(limit = 50): Promise<ExecucaoRow[]> {
  const rows = await sql<ExecucaoRow[]>`
    SELECT id, started_at, finished_at,
           total_encontradas, total_novas, total_classificadas,
           total_filtradas, total_erros_class, status, erro
    FROM execucoes
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return [...rows];
}
