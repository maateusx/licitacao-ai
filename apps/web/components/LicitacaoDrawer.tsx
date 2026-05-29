'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Archive, ArchiveRestore, ExternalLink, RefreshCw, Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { api, ApiError } from '@/lib/api-client';
import type { Categoria, Licitacao } from '@/lib/types';
import { cn, formatBRL } from '@/lib/utils';

interface Props {
  id: string | null;
  onClose: () => void;
}

const categoriaVariant: Record<Categoria, 'success' | 'info' | 'muted'> = {
  core: 'success',
  adjacente: 'info',
  fora: 'muted',
};

export function LicitacaoDrawer({ id, onClose }: Props) {
  const { data, isLoading, error, refetch } = useQuery<Licitacao>({
    queryKey: ['licitacao', id],
    queryFn: () => api.getLicitacao(id!),
    enabled: !!id,
  });

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {isLoading && <div className="text-sm text-slate-500">Carregando…</div>}
        {error && (
          <div className="flex flex-col gap-2 text-sm text-red-600">
            <div>Erro: {(error as Error).message}</div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}
        {data && <DrawerBody licitacao={data} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ licitacao }: { licitacao: Licitacao }) {
  const a = licitacao.analise;
  const qc = useQueryClient();
  const [reanalisarError, setReanalisarError] = useState<string | null>(null);

  const reanalisarMut = useMutation({
    mutationFn: () => api.reanalisarLicitacao(licitacao.id),
    onSuccess: () => {
      setReanalisarError(null);
      // Recarrega tanto o detalhe quanto a lista (a última análise mudou).
      qc.invalidateQueries({ queryKey: ['licitacao', licitacao.id] });
      qc.invalidateQueries({ queryKey: ['licitacoes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.status === 503
          ? 'Gemini não configurado (GEMINI_API_KEY ausente).'
          : err instanceof Error
            ? err.message
            : 'Erro';
      setReanalisarError(msg);
    },
  });

  const flagsMut = useMutation({
    mutationFn: (patch: { arquivada?: boolean; favorita?: boolean }) =>
      api.updateLicitacao(licitacao.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['licitacao', licitacao.id] });
      qc.invalidateQueries({ queryKey: ['licitacoes'] });
    },
  });

  return (
    <div className="flex flex-col gap-5 pr-6">
      <SheetTitle className="text-lg font-semibold leading-tight text-slate-900">
        {licitacao.titulo ?? '(sem título)'}
      </SheetTitle>

      <div className="flex flex-wrap gap-1.5">
        {licitacao.uf && <Badge variant="default">{licitacao.uf}</Badge>}
        {licitacao.modalidade && <Badge variant="info">{licitacao.modalidade}</Badge>}
        {licitacao.status && <Badge variant="muted">{licitacao.status}</Badge>}
        {a && (
          <Badge variant={categoriaVariant[a.categoria]}>
            IA · {a.categoria}
            {a.score != null && ` · ${a.score}`}
          </Badge>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Valor estimado
        </div>
        <div className="text-2xl font-semibold tabular-nums text-slate-900">
          {formatBRL(licitacao.valor_estimado)}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Órgão" value={licitacao.orgao ?? '—'} />
        <Field label="Município" value={licitacao.municipio ?? '—'} />
        <Field label="ID PNCP" value={licitacao.id_pncp} mono />
        <DateField label="Publicação" iso={licitacao.data_publicacao} />
        <DateField label="Abertura" iso={licitacao.data_abertura} />
        <DateField label="Encerramento" iso={licitacao.data_encerramento} countdown />
      </dl>

      {licitacao.objeto && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Objeto
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {licitacao.objeto}
          </p>
        </section>
      )}

      {a && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Análise IA
            </h3>
            <span className="text-[10px] text-slate-400">
              {a.modelo ?? '—'}
              {a.created_at && ` · ${format(parseISO(a.created_at), 'dd/MM HH:mm')}`}
            </span>
          </div>

          {a.justificativa && (
            <p className="mb-3 text-sm leading-snug text-slate-700">{a.justificativa}</p>
          )}

          {a.pontos_fortes.length > 0 && (
            <ListBlock
              icon={<Sparkles className="h-3.5 w-3.5 text-green-600" />}
              label="Pontos fortes"
              items={a.pontos_fortes}
            />
          )}
          {a.red_flags.length > 0 && (
            <ListBlock
              icon={<AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
              label="Red flags"
              items={a.red_flags}
            />
          )}
        </section>
      )}

      {licitacao.keywords_match.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Keywords
          </h3>
          <div className="flex flex-wrap gap-1">
            {licitacao.keywords_match.map((k) => (
              <Badge key={k} variant="default" className="normal-case">
                {k}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => flagsMut.mutate({ favorita: !licitacao.favorita })}
            disabled={flagsMut.isPending}
            className={cn(
              licitacao.favorita &&
                'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
            )}
          >
            <Star
              className={cn(
                'h-3.5 w-3.5',
                licitacao.favorita && 'fill-amber-500 text-amber-500',
              )}
            />
            {licitacao.favorita ? 'Favoritada' : 'Favoritar'}
          </Button>
          <Button
            variant="outline"
            onClick={() => flagsMut.mutate({ arquivada: !licitacao.arquivada })}
            disabled={flagsMut.isPending}
            className={cn(
              licitacao.arquivada && 'border-slate-300 bg-slate-100 text-slate-700',
            )}
          >
            {licitacao.arquivada ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" /> Desarquivar
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" /> Arquivar
              </>
            )}
          </Button>
        </div>
        {licitacao.url_pncp && (
          <a
            href={licitacao.url_pncp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            Abrir no PNCP <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => reanalisarMut.mutate()}
          disabled={reanalisarMut.isPending}
        >
          <RefreshCw
            className={reanalisarMut.isPending ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
          />
          {reanalisarMut.isPending ? 'Reanalisando…' : 'Reanalisar com IA'}
        </Button>
        {reanalisarError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {reanalisarError}
          </div>
        )}
        {reanalisarMut.data?.ok && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            Nova análise gerada: score {reanalisarMut.data.analise.score ?? '—'} ·{' '}
            {reanalisarMut.data.analise.categoria}.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={mono ? 'font-mono text-[11px] text-slate-700' : 'text-slate-800'}>{value}</dd>
    </div>
  );
}

function DateField({
  label,
  iso,
  countdown,
}: {
  label: string;
  iso: string | null;
  countdown?: boolean;
}) {
  if (!iso) return <Field label={label} value="—" />;
  const d = parseISO(iso);
  const days = differenceInCalendarDays(d, new Date());
  const cd =
    countdown && (days === 0 ? ' · hoje' : days > 0 ? ` · em ${days}d` : ` · há ${-days}d`);
  return (
    <Field label={label} value={`${format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })}${cd || ''}`} />
  );
}

function ListBlock({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {icon} {label}
      </div>
      <ul className="ml-4 list-disc space-y-0.5 text-xs text-slate-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
