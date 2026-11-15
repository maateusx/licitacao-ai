'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { FilterSidebar } from '@/components/FilterSidebar';
import { Header } from '@/components/Header';
import { LicitacaoDrawer } from '@/components/LicitacaoDrawer';
import { LicitacoesTable } from '@/components/LicitacoesTable';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { toApiQuery, type OrderBy, type SortDirection } from '@/lib/filters';
import { useFilters } from '@/lib/use-filters';

export default function TabelaPage() {
  const { filters, setFilters, reset } = useFilters();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const qs = toApiQuery(filters);
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['licitacoes', qs.toString()],
    queryFn: () => api.listLicitacoes(qs),
  });

  const total = data?.pagination.total ?? 0;
  const hasResults = (data?.data.length ?? 0) > 0;

  const handleSort = (order: OrderBy, direction: SortDirection) => {
    setFilters({ order, direction, page: null });
  };

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <FilterSidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
            <div className="text-xs text-slate-500">
              {isLoading
                ? 'Carregando…'
                : error
                  ? `Erro: ${(error as Error).message}`
                  : `${total} licitações`}
            </div>
            {error && (
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                Tentar de novo
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {isLoading && (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Carregando…
              </div>
            )}
            {!isLoading && error && (
              <ErrorView message={(error as Error).message} onRetry={() => refetch()} />
            )}
            {!isLoading && !error && !hasResults && (
              <EmptyView onReset={reset} hasFilters={hasActiveFilters(filters)} />
            )}
            {data && hasResults && (
              <LicitacoesTable
                data={data.data}
                order={filters.order}
                direction={filters.direction}
                selectedId={selectedId}
                onSort={handleSort}
                onSelect={setSelectedId}
              />
            )}
          </div>
          {data && (
            <Pagination
              page={filters.page}
              pageSize={filters.page_size}
              total={total}
              onPageChange={(p) => setFilters({ page: p === 1 ? null : p })}
              onPageSizeChange={(ps) => setFilters({ page_size: ps, page: null })}
            />
          )}
        </main>
      </div>
      <LicitacaoDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-sm text-red-700">Erro ao carregar: {message}</p>
        <p className="text-xs text-slate-500">
          A API está rodando? Confira <code className="rounded bg-slate-100 px-1">apps/api</code>.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}

function EmptyView({ onReset, hasFilters }: { onReset: () => void; hasFilters: boolean }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium text-slate-700">Nenhuma licitação encontrada</p>
        {hasFilters ? (
          <>
            <p className="text-xs text-slate-500">
              Os filtros atuais não retornaram resultados.
            </p>
            <Button variant="outline" size="sm" onClick={onReset}>
              Limpar filtros
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              O banco está vazio — cadastre keywords e rode o pipeline.
            </p>
            <div className="flex gap-2">
              <Link
                href="/admin/keywords"
                className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-50"
              >
                Cadastrar keywords
              </Link>
              <Link
                href="/admin/execucoes"
                className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
              >
                Rodar pipeline
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function hasActiveFilters(f: ReturnType<typeof useFilters>['filters']): boolean {
  return (
    f.busca.length > 0 ||
    f.uf.length > 0 ||
    f.categoria.length > 0 ||
    f.keyword.length > 0 ||
    f.score_min > 0 ||
    f.valor_min != null ||
    f.valor_max != null ||
    f.so_abertas === false
  );
}
