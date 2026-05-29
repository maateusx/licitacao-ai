import type { Categoria } from './types';

export const ORDER_OPTIONS = [
  'data_encerramento',
  'data_abertura',
  'score',
  'valor_estimado',
  'titulo',
  'orgao',
  'uf',
] as const;
export type OrderBy = (typeof ORDER_OPTIONS)[number];

// Subconjunto exposto nos chips do FilterSidebar (compartilhado entre timeline
// e tabela). As colunas extras só são acionáveis pelos headers da tabela.
export const SIDEBAR_ORDER_OPTIONS = ['data_encerramento', 'score', 'valor_estimado'] as const;

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

// Default por coluna — datas/texto sobem, score/valor descem.
export const DEFAULT_DIRECTION: Record<OrderBy, SortDirection> = {
  data_encerramento: 'asc',
  data_abertura: 'asc',
  titulo: 'asc',
  orgao: 'asc',
  uf: 'asc',
  score: 'desc',
  valor_estimado: 'desc',
};

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export const CATEGORIAS: Categoria[] = ['core', 'adjacente', 'fora'];

export const UF_LIST = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const ARQUIVADA_FILTERS = ['ativas', 'incluir', 'so'] as const;
// 'ativas' (default) oculta; 'incluir' mostra todas; 'so' mostra só arquivadas.
export type ArquivadaFilter = (typeof ARQUIVADA_FILTERS)[number];

export interface Filters {
  busca: string;
  uf: string[];
  categoria: Categoria[];
  keyword: string[];
  score_min: number;
  valor_min: number | null;
  valor_max: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  modalidade: string[];
  so_abertas: boolean;
  arquivada: ArquivadaFilter;
  so_favoritas: boolean;
  order: OrderBy;
  direction: SortDirection;
  page: number;
  page_size: number;
}

export const DEFAULT_FILTERS: Filters = {
  busca: '',
  uf: [],
  categoria: [],
  keyword: [],
  score_min: 50,
  valor_min: null,
  valor_max: null,
  data_inicio: null,
  data_fim: null,
  modalidade: [],
  so_abertas: true,
  arquivada: 'ativas',
  so_favoritas: false,
  order: 'data_encerramento',
  direction: 'asc',
  page: 1,
  page_size: 50,
};

/**
 * Converte os filtros da UI em querystring para a API. `so_abertas` vira
 * `data_inicio=hoje`; `score_min=0` é omitido para não filtrar fora
 * licitações sem análise. Quando `pageSize` é passado explicitamente
 * (timeline usa 100), ele sobrescreve `f.page_size`.
 */
export function toApiQuery(f: Filters, pageSize?: number): URLSearchParams {
  const q = new URLSearchParams();
  if (f.busca) q.set('busca', f.busca);
  if (f.uf.length) q.set('uf', f.uf.join(','));
  if (f.categoria.length) q.set('categoria', f.categoria.join(','));
  if (f.keyword.length) q.set('keyword', f.keyword.join(','));
  if (f.score_min > 0) q.set('score_min', String(f.score_min));
  if (f.valor_min != null) q.set('valor_min', String(f.valor_min));
  if (f.valor_max != null) q.set('valor_max', String(f.valor_max));
  // data_inicio do usuário tem precedência; se vazio e "só em aberto" estiver
  // ligado, usa hoje. Quando ambos existem, usa o mais restritivo (mais tarde).
  const today = new Date().toISOString().slice(0, 10);
  const dataInicio = f.so_abertas
    ? f.data_inicio && f.data_inicio > today
      ? f.data_inicio
      : today
    : f.data_inicio || null;
  if (dataInicio) q.set('data_inicio', dataInicio);
  if (f.data_fim) q.set('data_fim', f.data_fim);
  if (f.arquivada !== 'ativas') q.set('arquivada', f.arquivada);
  if (f.so_favoritas) q.set('so_favoritas', '1');
  q.set('order', f.order);
  q.set('direction', f.direction);
  q.set('page', String(f.page));
  q.set('page_size', String(pageSize ?? f.page_size));
  return q;
}
