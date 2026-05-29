'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  ARQUIVADA_FILTERS,
  CATEGORIAS,
  DEFAULT_DIRECTION,
  SIDEBAR_ORDER_OPTIONS,
  UF_LIST,
  type ArquivadaFilter,
  type OrderBy,
} from '@/lib/filters';
import type { Categoria } from '@/lib/types';
import { useFilters } from '@/lib/use-filters';
import { cn } from '@/lib/utils';

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function FilterSidebar() {
  const { filters, setFilters, reset } = useFilters();
  const [buscaLocal, setBuscaLocal] = useState(filters.busca);

  // Debounce 300ms na busca — evita refetch a cada tecla.
  useEffect(() => {
    if (buscaLocal === filters.busca) return;
    const t = setTimeout(() => setFilters({ busca: buscaLocal || null, page: null }), 300);
    return () => clearTimeout(t);
  }, [buscaLocal, filters.busca, setFilters]);

  // Mantém input sincronizado se filtros forem zerados externamente.
  useEffect(() => {
    if (filters.busca !== buscaLocal) setBuscaLocal(filters.busca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.busca]);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Filtros</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            reset();
            setBuscaLocal('');
          }}
        >
          Limpar
        </Button>
      </div>

      <Section label="Busca">
        <div className="relative">
          <Input
            placeholder="título, objeto…"
            value={buscaLocal}
            onChange={(e) => setBuscaLocal(e.target.value)}
          />
          {buscaLocal && (
            <button
              aria-label="limpar busca"
              onClick={() => setBuscaLocal('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </Section>

      <Section label="Categoria IA">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map((c) => {
            const active = filters.categoria.includes(c);
            return (
              <Chip
                key={c}
                active={active}
                onClick={() =>
                  setFilters({
                    categoria: toggle(filters.categoria, c) as Categoria[],
                    page: null,
                  })
                }
              >
                {c}
              </Chip>
            );
          })}
        </div>
      </Section>

      <Section label={`Score mínimo: ${filters.score_min}`}>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[filters.score_min]}
          onValueChange={(v) => setFilters({ score_min: v[0] ?? 0, page: null })}
        />
      </Section>

      <Section label="UF">
        <div className="grid grid-cols-5 gap-1">
          {UF_LIST.map((uf) => {
            const active = filters.uf.includes(uf);
            return (
              <Chip
                key={uf}
                active={active}
                onClick={() => setFilters({ uf: toggle(filters.uf, uf), page: null })}
              >
                {uf}
              </Chip>
            );
          })}
        </div>
      </Section>

      <Section label="Data de encerramento">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="data-inicio" className="text-[10px] text-slate-500">
              de
            </label>
            <Input
              id="data-inicio"
              type="date"
              value={filters.data_inicio ?? ''}
              max={filters.data_fim ?? undefined}
              onChange={(e) =>
                setFilters({ data_inicio: e.target.value || null, page: null })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="data-fim" className="text-[10px] text-slate-500">
              até
            </label>
            <Input
              id="data-fim"
              type="date"
              value={filters.data_fim ?? ''}
              min={filters.data_inicio ?? undefined}
              onChange={(e) =>
                setFilters({ data_fim: e.target.value || null, page: null })
              }
            />
          </div>
        </div>
      </Section>

      <Section label="Valor estimado (R$)">
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="mín"
            value={filters.valor_min ?? ''}
            onChange={(e) =>
              setFilters({
                valor_min: e.target.value ? Number(e.target.value) : null,
                page: null,
              })
            }
          />
          <Input
            type="number"
            placeholder="máx"
            value={filters.valor_max ?? ''}
            onChange={(e) =>
              setFilters({
                valor_max: e.target.value ? Number(e.target.value) : null,
                page: null,
              })
            }
          />
        </div>
      </Section>

      <Section label="Ordenação">
        <div className="flex flex-wrap gap-1.5">
          {SIDEBAR_ORDER_OPTIONS.map((o) => (
            <Chip
              key={o}
              active={filters.order === o}
              onClick={() =>
                setFilters({
                  order: o as OrderBy,
                  direction: DEFAULT_DIRECTION[o],
                  page: null,
                })
              }
            >
              {orderLabel(o)}
            </Chip>
          ))}
        </div>
      </Section>

      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <label htmlFor="so-abertas" className="text-xs text-slate-700">
          Só em aberto
        </label>
        <Switch
          id="so-abertas"
          checked={filters.so_abertas}
          onCheckedChange={(v) => setFilters({ so_abertas: v, page: null })}
        />
      </div>

      <Section label="Arquivadas">
        <div className="flex flex-wrap gap-1.5">
          {ARQUIVADA_FILTERS.map((a) => (
            <Chip
              key={a}
              active={filters.arquivada === a}
              onClick={() => setFilters({ arquivada: a as ArquivadaFilter, page: null })}
            >
              {arquivadaLabel(a)}
            </Chip>
          ))}
        </div>
      </Section>

      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <label htmlFor="so-favoritas" className="text-xs text-slate-700">
          Só favoritas
        </label>
        <Switch
          id="so-favoritas"
          checked={filters.so_favoritas}
          onCheckedChange={(v) => setFilters({ so_favoritas: v, page: null })}
        />
      </div>

      <ActiveFilters
        filters={filters}
        onClear={(patch) => setFilters({ ...patch, page: null })}
      />
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md border px-2 py-1 text-xs transition',
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

function formatDateLabel(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function orderLabel(o: string) {
  if (o === 'data_encerramento') return 'data';
  if (o === 'score') return 'score';
  return 'valor';
}

function arquivadaLabel(a: ArquivadaFilter) {
  if (a === 'ativas') return 'ativas';
  if (a === 'incluir') return 'incluir';
  return 'só arquivadas';
}

function ActiveFilters({
  filters,
  onClear,
}: {
  filters: ReturnType<typeof useFilters>['filters'];
  onClear: (patch: Record<string, unknown>) => void;
}) {
  const chips: Array<{ label: string; clear: () => void }> = [];
  filters.uf.forEach((uf) =>
    chips.push({
      label: `UF: ${uf}`,
      clear: () => onClear({ uf: filters.uf.filter((x) => x !== uf) }),
    }),
  );
  filters.categoria.forEach((c) =>
    chips.push({
      label: c,
      clear: () => onClear({ categoria: filters.categoria.filter((x) => x !== c) }),
    }),
  );
  if (filters.valor_min != null)
    chips.push({ label: `≥ R$ ${filters.valor_min}`, clear: () => onClear({ valor_min: null }) });
  if (filters.valor_max != null)
    chips.push({ label: `≤ R$ ${filters.valor_max}`, clear: () => onClear({ valor_max: null }) });
  if (filters.data_inicio)
    chips.push({
      label: `vence ≥ ${formatDateLabel(filters.data_inicio)}`,
      clear: () => onClear({ data_inicio: null }),
    });
  if (filters.data_fim)
    chips.push({
      label: `vence ≤ ${formatDateLabel(filters.data_fim)}`,
      clear: () => onClear({ data_fim: null }),
    });

  if (chips.length === 0) return null;
  return (
    <Section label="Ativos">
      <div className="flex flex-wrap gap-1">
        {chips.map((c, i) => (
          <Badge
            key={i}
            variant="default"
            className="cursor-pointer normal-case"
            onClick={c.clear}
          >
            {c.label} <X className="h-3 w-3" />
          </Badge>
        ))}
      </div>
    </Section>
  );
}
