'use client';

import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Archive, Sparkles, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Licitacao } from '@/lib/types';
import { cn, formatBRL, truncate } from '@/lib/utils';

interface Props {
  licitacao: Licitacao;
  onClick: () => void;
}

function scoreClasses(score: number | null | undefined) {
  if (score == null) return 'border-l-score-none';
  if (score >= 80) return 'border-l-score-high';
  if (score >= 50) return 'border-l-score-mid';
  return 'border-l-score-low';
}

export function LicitacaoCard({ licitacao, onClick }: Props) {
  const {
    titulo,
    objeto,
    orgao,
    uf,
    valor_estimado,
    data_encerramento,
    analise,
    created_at,
    arquivada,
    favorita,
  } = licitacao;
  const score = analise?.score ?? null;

  const daysLeft =
    data_encerramento != null
      ? differenceInCalendarDays(parseISO(data_encerramento), new Date())
      : null;

  const novaEstaSemana =
    created_at != null && differenceInCalendarDays(new Date(), parseISO(created_at)) <= 7;

  const card = (
    <button
      onClick={onClick}
      className={cn(
        'group flex h-full w-full flex-col gap-1 rounded-md border border-slate-200 border-l-4 bg-white p-2 text-left shadow-sm transition hover:shadow-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400',
        scoreClasses(score),
        arquivada && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="line-clamp-2 flex-1 text-[12px] font-medium leading-tight text-slate-900">
          {favorita && (
            <Star className="mr-0.5 inline h-3 w-3 -translate-y-px fill-amber-500 text-amber-500" />
          )}
          {arquivada && (
            <Archive className="mr-0.5 inline h-3 w-3 -translate-y-px text-slate-400" />
          )}
          {truncate(objeto, 80) || truncate(titulo, 80) || '(sem objeto)'}
        </span>
        {score != null && (
          <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {score}
          </span>
        )}
      </div>

      <div className="line-clamp-1 text-[10px] text-slate-500">
        {orgao ?? 'órgão ?'} {uf ? `· ${uf}` : ''}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <span className="text-[10px] font-medium tabular-nums text-slate-700">
          {formatBRL(valor_estimado)}
        </span>
        <div className="flex gap-1">
          {daysLeft != null && daysLeft >= 0 && daysLeft < 7 && (
            <Badge variant="danger" className="px-1 py-0">
              {daysLeft === 0 ? 'hoje' : `${daysLeft}d`}
            </Badge>
          )}
          {score != null && score >= 90 && (
            <Badge variant="success" className="px-1 py-0">
              <Sparkles className="h-2.5 w-2.5" /> {score}
            </Badge>
          )}
          {novaEstaSemana && (
            <Badge variant="info" className="px-1 py-0">
              nova
            </Badge>
          )}
        </div>
      </div>
    </button>
  );

  if (!analise?.justificativa) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" align="start">
        <p className="font-medium">
          IA · {analise.categoria}
          {analise.score != null ? ` · ${analise.score}` : ''}
        </p>
        <p className="mt-1 leading-snug text-slate-200">{analise.justificativa}</p>
      </TooltipContent>
    </Tooltip>
  );
}
