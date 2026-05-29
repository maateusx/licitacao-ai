import { sql } from '../client.js';

export interface LicitacaoInput {
  id_pncp: string;
  titulo: string | null;
  objeto: string | null;
  orgao: string | null;
  uf: string | null;
  municipio: string | null;
  modalidade: string | null;
  valor_estimado: number | null;
  status: string | null;
  data_publicacao: Date | null;
  data_abertura: Date | null;
  data_encerramento: Date | null;
  url_pncp: string | null;
  keyword: string;
  raw: unknown;
}

export interface UpsertResult {
  id: string;
  inserted: boolean;
}

/**
 * Insert or update a licitação by id_pncp. On conflict, merges the matched
 * keyword into keywords_match (deduped), refreshes status and raw, bumps
 * updated_at. Returns whether the row was newly inserted.
 */
export async function upsertLicitacao(input: LicitacaoInput): Promise<UpsertResult> {
  const rows = await sql<{ id: string; inserted: boolean }[]>`
    INSERT INTO licitacoes (
      id_pncp, titulo, objeto, orgao, uf, municipio, modalidade,
      valor_estimado, status, data_publicacao, data_abertura,
      data_encerramento, url_pncp, raw, keywords_match
    ) VALUES (
      ${input.id_pncp}, ${input.titulo}, ${input.objeto}, ${input.orgao},
      ${input.uf}, ${input.municipio}, ${input.modalidade},
      ${input.valor_estimado}, ${input.status},
      ${input.data_publicacao}, ${input.data_abertura}, ${input.data_encerramento},
      ${input.url_pncp}, ${sql.json(input.raw as never)},
      ARRAY[${input.keyword}]::text[]
    )
    ON CONFLICT (id_pncp) DO UPDATE SET
      updated_at = now(),
      status = EXCLUDED.status,
      raw = EXCLUDED.raw,
      keywords_match = (
        SELECT array_agg(DISTINCT x)
        FROM unnest(coalesce(licitacoes.keywords_match, ARRAY[]::text[]) || EXCLUDED.keywords_match) AS x
      )
    RETURNING id, (xmax = 0) AS inserted
  `;
  const row = rows[0];
  if (!row) throw new Error('upsertLicitacao returned no rows');
  return row;
}

export async function countLicitacoes(): Promise<number> {
  const rows = await sql<{ count: string }[]>`SELECT count(*)::text FROM licitacoes`;
  return Number(rows[0]?.count ?? 0);
}

// --- Listing / detail (Etapa 3) -------------------------------------------------

export type Categoria = 'core' | 'adjacente' | 'fora';
export type OrderBy =
  | 'data_encerramento'
  | 'data_abertura'
  | 'score'
  | 'valor_estimado'
  | 'titulo'
  | 'orgao'
  | 'uf';
export type SortDirection = 'asc' | 'desc';
// 'ativas' oculta arquivadas (default); 'incluir' mostra tudo; 'so' só arquivadas.
export type ArquivadaFilter = 'ativas' | 'incluir' | 'so';

export interface ListFilters {
  uf?: string[];
  score_min?: number;
  categoria?: Categoria[];
  data_inicio?: Date;
  data_fim?: Date;
  keyword?: string[];
  busca?: string;
  valor_min?: number;
  valor_max?: number;
  status?: string;
  arquivada?: ArquivadaFilter;
  so_favoritas?: boolean;
  page: number;
  page_size: number;
  order: OrderBy;
  direction?: SortDirection;
}

export interface LicitacaoListRow {
  id: string;
  id_pncp: string;
  titulo: string | null;
  objeto: string | null;
  orgao: string | null;
  uf: string | null;
  municipio: string | null;
  modalidade: string | null;
  valor_estimado: string | null;
  status: string | null;
  data_publicacao: Date | null;
  data_abertura: Date | null;
  data_encerramento: Date | null;
  url_pncp: string | null;
  keywords_match: string[] | null;
  arquivada: boolean;
  favorita: boolean;
  created_at: Date;
  updated_at: Date;
  analise_score: number | null;
  analise_categoria: Categoria | null;
  analise_justificativa: string | null;
  analise_pontos_fortes: string[] | null;
  analise_red_flags: string[] | null;
  analise_created_at: Date | null;
  analise_modelo: string | null;
}

export interface ListResult {
  data: LicitacaoListRow[];
  total: number;
}

// Direção padrão por coluna quando o caller não informa `direction`.
const DEFAULT_DIRECTION: Record<OrderBy, SortDirection> = {
  data_encerramento: 'asc',
  data_abertura: 'asc',
  titulo: 'asc',
  orgao: 'asc',
  uf: 'asc',
  score: 'desc',
  valor_estimado: 'desc',
};

function buildOrderFrag(order: OrderBy, direction?: SortDirection) {
  const dir = direction ?? DEFAULT_DIRECTION[order];
  // Desempate por data_encerramento ASC (exceto quando já é a coluna primária).
  switch (order) {
    case 'data_encerramento':
      return dir === 'desc'
        ? sql`ORDER BY l.data_encerramento DESC NULLS LAST`
        : sql`ORDER BY l.data_encerramento ASC NULLS LAST`;
    case 'data_abertura':
      return dir === 'desc'
        ? sql`ORDER BY l.data_abertura DESC NULLS LAST, l.data_encerramento ASC NULLS LAST`
        : sql`ORDER BY l.data_abertura ASC NULLS LAST, l.data_encerramento ASC NULLS LAST`;
    case 'score':
      return dir === 'desc'
        ? sql`ORDER BY a.score DESC NULLS LAST, l.data_encerramento ASC NULLS LAST`
        : sql`ORDER BY a.score ASC NULLS LAST, l.data_encerramento ASC NULLS LAST`;
    case 'valor_estimado':
      return dir === 'desc'
        ? sql`ORDER BY l.valor_estimado DESC NULLS LAST, l.data_encerramento ASC NULLS LAST`
        : sql`ORDER BY l.valor_estimado ASC NULLS LAST, l.data_encerramento ASC NULLS LAST`;
    case 'titulo':
      return dir === 'desc'
        ? sql`ORDER BY l.titulo DESC NULLS LAST, l.data_encerramento ASC NULLS LAST`
        : sql`ORDER BY l.titulo ASC NULLS LAST, l.data_encerramento ASC NULLS LAST`;
    case 'orgao':
      return dir === 'desc'
        ? sql`ORDER BY l.orgao DESC NULLS LAST, l.data_encerramento ASC NULLS LAST`
        : sql`ORDER BY l.orgao ASC NULLS LAST, l.data_encerramento ASC NULLS LAST`;
    case 'uf':
      return dir === 'desc'
        ? sql`ORDER BY l.uf DESC NULLS LAST, l.data_encerramento ASC NULLS LAST`
        : sql`ORDER BY l.uf ASC NULLS LAST, l.data_encerramento ASC NULLS LAST`;
  }
}

/**
 * LATERAL join pega só a análise mais recente por licitação (1:N).
 * Os filtros que dependem da análise (score_min, categoria) usam essa coluna.
 */
export async function listLicitacoes(filters: ListFilters): Promise<ListResult> {
  const offset = (filters.page - 1) * filters.page_size;

  const ufFrag = filters.uf?.length
    ? sql`AND l.uf IN ${sql(filters.uf)}`
    : sql``;
  const categoriaFrag = filters.categoria?.length
    ? sql`AND a.categoria IN ${sql(filters.categoria)}`
    : sql``;
  const scoreFrag = filters.score_min != null
    ? sql`AND a.score >= ${filters.score_min}`
    : sql``;
  const dataInicioFrag = filters.data_inicio
    ? sql`AND l.data_encerramento >= ${filters.data_inicio}`
    : sql``;
  const dataFimFrag = filters.data_fim
    ? sql`AND l.data_encerramento <= ${filters.data_fim}`
    : sql``;
  const keywordFrag = filters.keyword?.length
    ? sql`AND l.keywords_match && ${filters.keyword}`
    : sql``;
  const buscaFrag = filters.busca
    ? sql`AND (l.titulo ILIKE ${'%' + filters.busca + '%'} OR l.objeto ILIKE ${'%' + filters.busca + '%'})`
    : sql``;
  const valorMinFrag = filters.valor_min != null
    ? sql`AND l.valor_estimado >= ${filters.valor_min}`
    : sql``;
  const valorMaxFrag = filters.valor_max != null
    ? sql`AND l.valor_estimado <= ${filters.valor_max}`
    : sql``;
  const statusFrag = filters.status
    ? sql`AND l.status = ${filters.status}`
    : sql``;
  // 'ativas' default oculta arquivadas; 'incluir' não filtra; 'so' inverte.
  const arquivadaFrag =
    filters.arquivada === 'so'
      ? sql`AND l.arquivada = true`
      : filters.arquivada === 'incluir'
        ? sql``
        : sql`AND l.arquivada = false`;
  const favoritaFrag = filters.so_favoritas
    ? sql`AND l.favorita = true`
    : sql``;

  const orderFrag = buildOrderFrag(filters.order, filters.direction);

  const data = await sql<LicitacaoListRow[]>`
    SELECT
      l.id, l.id_pncp, l.titulo, l.objeto, l.orgao, l.uf, l.municipio,
      l.modalidade, l.valor_estimado, l.status,
      l.data_publicacao, l.data_abertura, l.data_encerramento, l.url_pncp,
      l.keywords_match, l.arquivada, l.favorita, l.created_at, l.updated_at,
      a.score          AS analise_score,
      a.categoria      AS analise_categoria,
      a.justificativa  AS analise_justificativa,
      a.pontos_fortes  AS analise_pontos_fortes,
      a.red_flags      AS analise_red_flags,
      a.created_at     AS analise_created_at,
      a.modelo         AS analise_modelo
    FROM licitacoes l
    LEFT JOIN LATERAL (
      SELECT score, categoria, justificativa, pontos_fortes, red_flags, created_at, modelo
      FROM analises
      WHERE licitacao_id = l.id
      ORDER BY created_at DESC
      LIMIT 1
    ) a ON true
    WHERE 1=1
      ${ufFrag}
      ${categoriaFrag}
      ${scoreFrag}
      ${dataInicioFrag}
      ${dataFimFrag}
      ${keywordFrag}
      ${buscaFrag}
      ${valorMinFrag}
      ${valorMaxFrag}
      ${statusFrag}
      ${arquivadaFrag}
      ${favoritaFrag}
    ${orderFrag}
    LIMIT ${filters.page_size} OFFSET ${offset}
  `;

  const totalRows = await sql<{ count: string }[]>`
    SELECT count(*)::text
    FROM licitacoes l
    LEFT JOIN LATERAL (
      SELECT score, categoria FROM analises
      WHERE licitacao_id = l.id
      ORDER BY created_at DESC LIMIT 1
    ) a ON true
    WHERE 1=1
      ${ufFrag}
      ${categoriaFrag}
      ${scoreFrag}
      ${dataInicioFrag}
      ${dataFimFrag}
      ${keywordFrag}
      ${buscaFrag}
      ${valorMinFrag}
      ${valorMaxFrag}
      ${statusFrag}
      ${arquivadaFrag}
      ${favoritaFrag}
  `;

  return { data: [...data], total: Number(totalRows[0]?.count ?? 0) };
}

export async function getLicitacaoById(id: string): Promise<LicitacaoListRow | null> {
  const rows = await sql<LicitacaoListRow[]>`
    SELECT
      l.id, l.id_pncp, l.titulo, l.objeto, l.orgao, l.uf, l.municipio,
      l.modalidade, l.valor_estimado, l.status,
      l.data_publicacao, l.data_abertura, l.data_encerramento, l.url_pncp,
      l.keywords_match, l.arquivada, l.favorita, l.created_at, l.updated_at,
      a.score          AS analise_score,
      a.categoria      AS analise_categoria,
      a.justificativa  AS analise_justificativa,
      a.pontos_fortes  AS analise_pontos_fortes,
      a.red_flags      AS analise_red_flags,
      a.created_at     AS analise_created_at,
      a.modelo         AS analise_modelo
    FROM licitacoes l
    LEFT JOIN LATERAL (
      SELECT score, categoria, justificativa, pontos_fortes, red_flags, created_at, modelo
      FROM analises
      WHERE licitacao_id = l.id
      ORDER BY created_at DESC
      LIMIT 1
    ) a ON true
    WHERE l.id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateLicitacaoFlags(
  id: string,
  patch: { arquivada?: boolean; favorita?: boolean },
): Promise<{ id: string; arquivada: boolean; favorita: boolean } | null> {
  // Constrói SET dinamicamente — pelo menos um campo já é validado no caller.
  const arquivadaSet =
    patch.arquivada !== undefined ? sql`arquivada = ${patch.arquivada},` : sql``;
  const favoritaSet =
    patch.favorita !== undefined ? sql`favorita = ${patch.favorita},` : sql``;
  const rows = await sql<{ id: string; arquivada: boolean; favorita: boolean }[]>`
    UPDATE licitacoes
    SET ${arquivadaSet} ${favoritaSet} updated_at = now()
    WHERE id = ${id}
    RETURNING id, arquivada, favorita
  `;
  return rows[0] ?? null;
}
