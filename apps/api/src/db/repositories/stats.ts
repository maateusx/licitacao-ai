import { sql } from '../client.js';

export interface Stats {
  total_ativas: number;
  score_medio: number | null;
  fechando_em_7_dias: number;
  novas_semana: number;
  por_categoria: Record<'core' | 'adjacente' | 'fora', number>;
}

/**
 * "Ativa" = ainda em aberto (encerramento no futuro). Score médio considera
 * só a última análise de cada licitação. Mantém tudo em uma query agregada
 * para evitar idas e voltas ao banco.
 */
export async function getStats(): Promise<Stats> {
  const rows = await sql<
    {
      total_ativas: string;
      score_medio: string | null;
      fechando_em_7_dias: string;
      novas_semana: string;
      core: string;
      adjacente: string;
      fora: string;
    }[]
  >`
    WITH latest AS (
      SELECT DISTINCT ON (a.licitacao_id)
             a.licitacao_id, a.score, a.categoria
      FROM analises a
      ORDER BY a.licitacao_id, a.created_at DESC
    )
    SELECT
      count(*) FILTER (WHERE l.data_encerramento >= now())::text                                    AS total_ativas,
      avg(latest.score) FILTER (WHERE latest.score IS NOT NULL)::text                                AS score_medio,
      count(*) FILTER (WHERE l.data_encerramento BETWEEN now() AND now() + interval '7 days')::text  AS fechando_em_7_dias,
      count(*) FILTER (WHERE l.created_at >= now() - interval '7 days')::text                        AS novas_semana,
      count(*) FILTER (WHERE latest.categoria = 'core')::text                                        AS core,
      count(*) FILTER (WHERE latest.categoria = 'adjacente')::text                                   AS adjacente,
      count(*) FILTER (WHERE latest.categoria = 'fora')::text                                        AS fora
    FROM licitacoes l
    LEFT JOIN latest ON latest.licitacao_id = l.id
  `;

  const r = rows[0]!;
  return {
    total_ativas: Number(r.total_ativas),
    score_medio: r.score_medio == null ? null : Number(Number(r.score_medio).toFixed(1)),
    fechando_em_7_dias: Number(r.fechando_em_7_dias),
    novas_semana: Number(r.novas_semana),
    por_categoria: {
      core: Number(r.core),
      adjacente: Number(r.adjacente),
      fora: Number(r.fora),
    },
  };
}
