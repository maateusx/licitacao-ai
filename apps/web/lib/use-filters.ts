'use client';

import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
} from 'nuqs';
import { useMemo } from 'react';
import {
  ARQUIVADA_FILTERS,
  DEFAULT_FILTERS,
  ORDER_OPTIONS,
  SORT_DIRECTIONS,
  type Filters,
} from './filters';
import type { Categoria } from './types';

const CATEGORIAS = ['core', 'adjacente', 'fora'] as const;

/**
 * Filtros persistidos na URL (shareable links). Defaults batem com
 * DEFAULT_FILTERS — quando o valor é o default, nuqs omite o param na URL.
 */
export function useFilters() {
  const [state, setState] = useQueryStates(
    {
      busca: parseAsString.withDefault(''),
      uf: parseAsArrayOf(parseAsString).withDefault([]),
      categoria: parseAsArrayOf(parseAsStringEnum([...CATEGORIAS])).withDefault([]),
      keyword: parseAsArrayOf(parseAsString).withDefault([]),
      score_min: parseAsInteger.withDefault(DEFAULT_FILTERS.score_min),
      valor_min: parseAsInteger,
      valor_max: parseAsInteger,
      data_inicio: parseAsString,
      data_fim: parseAsString,
      modalidade: parseAsArrayOf(parseAsString).withDefault([]),
      so_abertas: parseAsBoolean.withDefault(true),
      arquivada: parseAsStringEnum([...ARQUIVADA_FILTERS]).withDefault(DEFAULT_FILTERS.arquivada),
      so_favoritas: parseAsBoolean.withDefault(false),
      order: parseAsStringEnum([...ORDER_OPTIONS]).withDefault(DEFAULT_FILTERS.order),
      direction: parseAsStringEnum([...SORT_DIRECTIONS]).withDefault(DEFAULT_FILTERS.direction),
      page: parseAsInteger.withDefault(1),
      page_size: parseAsInteger.withDefault(DEFAULT_FILTERS.page_size),
    },
    { history: 'replace', clearOnDefault: true },
  );

  const filters: Filters = useMemo(
    () => ({
      busca: state.busca,
      uf: state.uf,
      categoria: state.categoria as Categoria[],
      keyword: state.keyword,
      score_min: state.score_min,
      valor_min: state.valor_min,
      valor_max: state.valor_max,
      data_inicio: state.data_inicio,
      data_fim: state.data_fim,
      modalidade: state.modalidade,
      so_abertas: state.so_abertas,
      arquivada: state.arquivada,
      so_favoritas: state.so_favoritas,
      order: state.order,
      direction: state.direction,
      page: state.page,
      page_size: state.page_size,
    }),
    [state],
  );

  return {
    filters,
    setFilters: setState,
    reset: () =>
      setState({
        busca: null,
        uf: null,
        categoria: null,
        keyword: null,
        score_min: null,
        valor_min: null,
        valor_max: null,
        data_inicio: null,
        data_fim: null,
        modalidade: null,
        so_abertas: null,
        arquivada: null,
        so_favoritas: null,
        order: null,
        direction: null,
        page: null,
        page_size: null,
      }),
  };
}
