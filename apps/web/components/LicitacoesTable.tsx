'use client';

import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_DIRECTION, type OrderBy, type SortDirection } from '@/lib/filters';
import { NOME_FONTE, type Categoria, type Licitacao } from '@/lib/types';
import { cn, formatBRL, resumoObjeto, truncate } from '@/lib/utils';

interface Column {
  key: OrderBy | null;
  label: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

const COLUMNS: Column[] = [
  { key: 'data_encerramento', label: 'Encerra' },
  { key: 'score', label: 'IA', align: 'center' },
  { key: null, label: 'Objeto' },
  { key: 'orgao', label: 'Órgão' },
  { key: 'uf', label: 'UF', align: 'center' },
  { key: null, label: 'Modalidade' },
  { key: 'valor_estimado', label: 'Valor', align: 'right' },
];

const categoriaVariant: Record<Categoria, 'success' | 'info' | 'muted'> = {
  core: 'success',
  adjacente: 'info',
  fora: 'muted',
};

interface Props {
  data: Licitacao[];
  order: OrderBy;
  direction: SortDirection;
  selectedId: string | null;
  onSort: (order: OrderBy, direction: SortDirection) => void;
  onSelect: (id: string) => void;
}

export function LicitacoesTable({
  data,
  order,
  direction,
  selectedId,
  onSort,
  onSelect,
}: Props) {
  const handleSort = (col: OrderBy) => {
    if (col === order) {
      onSort(col, direction === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(col, DEFAULT_DIRECTION[col]);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                className={cn(
                  'border-b border-slate-200 px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-500',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                )}
              >
                {col.key ? (
                  <SortHeader
                    label={col.label}
                    active={order === col.key}
                    direction={direction}
                    align={col.align}
                    onClick={() => handleSort(col.key as OrderBy)}
                  />
                ) : (
                  <span className="text-[10px]">{col.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <Row
              key={row.id}
              licitacao={row}
              selected={row.id === selectedId}
              onSelect={() => onSelect(row.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  active,
  direction,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  align?: 'left' | 'right' | 'center';
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex w-full items-center gap-1 text-[10px] uppercase tracking-wide transition hover:text-slate-900',
        active ? 'text-slate-900' : 'text-slate-500',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
      )}
    >
      <span>{label}</span>
      <Icon className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
    </button>
  );
}

function Row({
  licitacao,
  selected,
  onSelect,
}: {
  licitacao: Licitacao;
  selected: boolean;
  onSelect: () => void;
}) {
  const a = licitacao.analise;

  return (
    <tr
      onClick={onSelect}
      className={cn(
        'cursor-pointer transition hover:bg-slate-50',
        selected && 'bg-slate-100 hover:bg-slate-100',
        licitacao.arquivada && 'opacity-60',
      )}
    >
      <td className="border-b border-slate-100 px-3 py-2 align-top">
        <EncerraCell iso={licitacao.data_encerramento} />
      </td>
      <td className="border-b border-slate-100 px-3 py-2 text-center align-top">
        {a ? (
          <Badge variant={categoriaVariant[a.categoria]} className="normal-case">
            {a.categoria}
            {a.score != null && ` · ${a.score}`}
          </Badge>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="max-w-[420px] border-b border-slate-100 px-3 py-2 align-top">
        <div className="flex items-start gap-1.5 font-medium text-slate-900">
          {licitacao.favorita && (
            <Star className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500" />
          )}
          {licitacao.arquivada && (
            <Archive className="h-3 w-3 shrink-0 text-slate-400" />
          )}
          <span className="line-clamp-2" title={licitacao.objeto ?? undefined}>
            {resumoObjeto(licitacao.objeto, licitacao.titulo) || '(sem objeto)'}
          </span>
        </div>
        {licitacao.municipio && (
          <div className="mt-0.5 text-[11px] text-slate-500">{licitacao.municipio}</div>
        )}
      </td>
      <td className="max-w-[260px] border-b border-slate-100 px-3 py-2 align-top text-slate-700">
        {truncate(licitacao.orgao, 80) || '—'}
      </td>
      <td className="border-b border-slate-100 px-3 py-2 text-center align-top text-slate-700">
        {licitacao.uf ?? '—'}
      </td>
      <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">
        {licitacao.modalidade ?? '—'}
        <div className="text-[10px] text-slate-400">{NOME_FONTE[licitacao.fonte] ?? licitacao.fonte}</div>
      </td>
      <td className="border-b border-slate-100 px-3 py-2 text-right align-top tabular-nums text-slate-900">
        {formatBRL(licitacao.valor_estimado)}
      </td>
    </tr>
  );
}

function EncerraCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-slate-300">—</span>;
  const d = parseISO(iso);
  const days = differenceInCalendarDays(d, new Date());
  const urgent = days >= 0 && days <= 3;
  return (
    <div className="flex flex-col leading-tight">
      <span className="tabular-nums text-slate-900">
        {format(d, 'dd/MM/yyyy', { locale: ptBR })}
      </span>
      <span
        className={cn(
          'text-[11px] tabular-nums',
          days < 0 ? 'text-slate-400' : urgent ? 'text-red-600' : 'text-slate-500',
        )}
      >
        {days === 0 ? 'hoje' : days > 0 ? `em ${days}d` : `há ${-days}d`}
      </span>
    </div>
  );
}
