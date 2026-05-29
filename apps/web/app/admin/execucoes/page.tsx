'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api-client';
import type { Execucao } from '@/lib/types';

type StatusFilter = 'all' | 'done' | 'error' | 'running';

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'done', label: 'Sucesso' },
  { value: 'error', label: 'Erro' },
  { value: 'running', label: 'Em execução' },
];

export default function ExecucoesPage() {
  const qc = useQueryClient();
  const [runError, setRunError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['execucoes'],
    queryFn: api.listExecucoes,
    // Faz polling enquanto há run em andamento — assim a UI atualiza sozinha
    // quando a execução termina.
    refetchInterval: (q) => (q.state.data?.run_in_progress ? 3000 : false),
  });

  const runMut = useMutation({
    mutationFn: api.triggerRun,
    onSuccess: () => {
      setRunError(null);
      qc.invalidateQueries({ queryKey: ['execucoes'] });
    },
    onError: (err) => {
      setRunError(
        err instanceof ApiError && err.status === 409
          ? 'Já há uma execução em andamento.'
          : err instanceof Error
            ? err.message
            : 'Erro ao disparar',
      );
    },
  });

  const running = data?.run_in_progress ?? false;

  const allRows = data?.data ?? [];
  const counts = allRows.reduce(
    (acc, e) => {
      acc.all += 1;
      if (e.status === 'done' || e.status === 'error' || e.status === 'running') {
        acc[e.status] += 1;
      }
      return acc;
    },
    { all: 0, done: 0, error: 0, running: 0 } as Record<StatusFilter, number>,
  );
  const filteredRows =
    statusFilter === 'all' ? allRows : allRows.filter((e) => e.status === statusFilter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Execuções</h2>
          <p className="text-xs text-slate-500">
            Histórico das últimas 50 rodadas do pipeline. Cron roda 2x/dia
            (configurável via <code className="rounded bg-slate-100 px-1 py-0.5">SCHEDULER_CRON</code>).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={isRefetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Atualizar
          </Button>
          <Button
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending || running}
          >
            <Play className="h-3.5 w-3.5" />
            {running ? 'Rodando…' : 'Rodar agora'}
          </Button>
        </div>
      </div>

      {runError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {runError}
        </div>
      )}

      {running && (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Execução em andamento — a tabela atualiza automaticamente quando terminar.
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_OPTIONS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={
                  active
                    ? 'rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-medium text-white'
                    : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50'
                }
              >
                {opt.label}
                <span className={active ? 'ml-1.5 text-slate-300' : 'ml-1.5 text-slate-400'}>
                  {counts[opt.value]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        {isLoading && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Carregando…</div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-red-700">
              Erro ao carregar: {(error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}
        {data && data.data.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Nenhuma execução ainda — clique em <strong>Rodar agora</strong> para
            disparar a primeira.
          </div>
        )}
        {data && data.data.length > 0 && filteredRows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-slate-500">
            <p>Nenhuma execução com este filtro.</p>
            <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
              Mostrar todas
            </Button>
          </div>
        )}
        {filteredRows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Início</th>
                <th className="px-4 py-2 font-medium">Duração</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Encontradas</th>
                <th className="px-4 py-2 text-right font-medium">Novas</th>
                <th className="px-4 py-2 text-right font-medium">Filtradas</th>
                <th className="px-4 py-2 text-right font-medium">Classificadas</th>
                <th className="px-4 py-2 text-right font-medium">Erros</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((e) => (
                <ExecucaoRow key={e.id} execucao={e} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ExecucaoRow({ execucao: e }: { execucao: Execucao }) {
  const started = parseISO(e.started_at);
  const dur = e.duracao_ms == null ? null : formatDuration(e.duracao_ms);
  return (
    <tr className="border-b border-slate-100 last:border-0 align-top">
      <td className="px-4 py-2 text-slate-800">
        {format(started, 'dd/MM HH:mm', { locale: ptBR })}
        <div className="text-[10px] text-slate-500">
          {formatDistanceToNowStrict(started, { locale: ptBR, addSuffix: true })}
        </div>
      </td>
      <td className="px-4 py-2 tabular-nums text-slate-700">{dur ?? '—'}</td>
      <td className="px-4 py-2">
        <StatusBadge status={e.status} />
        {e.erro && (
          <div className="mt-1 line-clamp-2 max-w-[260px] text-[10px] text-red-700">
            {e.erro}
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">{e.total_encontradas}</td>
      <td className="px-4 py-2 text-right tabular-nums">{e.total_novas}</td>
      <td className="px-4 py-2 text-right tabular-nums">{e.total_filtradas}</td>
      <td className="px-4 py-2 text-right tabular-nums">{e.total_classificadas}</td>
      <td className="px-4 py-2 text-right tabular-nums">
        {e.total_erros_class > 0 ? (
          <span className="font-medium text-red-700">{e.total_erros_class}</span>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') return <Badge variant="success">done</Badge>;
  if (status === 'running') return <Badge variant="info">running</Badge>;
  if (status === 'error') return <Badge variant="danger">error</Badge>;
  return <Badge variant="muted">{status}</Badge>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const restSec = Math.round(sec - min * 60);
  return `${min}m${restSec.toString().padStart(2, '0')}s`;
}
