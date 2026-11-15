'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2">
      <div className="text-slate-500">{icon}</div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
        <span className="text-lg font-semibold text-slate-900 tabular-nums">{value}</span>
      </div>
    </div>
  );
}

export function Header() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
  });

  const fmt = (n: number | null | undefined) =>
    isLoading ? '…' : n == null ? '—' : String(n);

  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Licitações AI</h1>
          <p className="text-xs text-slate-500">PNCP · priorizadas por IA</p>
        </div>
        <ViewTabs />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Stat icon={<Activity className="h-4 w-4" />} label="Ativas" value={fmt(data?.total_ativas)} />
        <Stat
          icon={<Sparkles className="h-4 w-4" />}
          label="Score médio"
          value={data?.score_medio == null ? (isLoading ? '…' : '—') : data.score_medio.toFixed(1)}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Fecha em ≤7d"
          value={fmt(data?.fechando_em_7_dias)}
        />
        <Link
          href="/admin/keywords"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Settings className="h-3.5 w-3.5" /> Admin
        </Link>
      </div>
    </header>
  );
}

function ViewTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Preserva filtros ao trocar entre as views.
  const qs = searchParams?.toString();
  const suffix = qs ? `?${qs}` : '';

  const tabs = [
    { href: `/${suffix}`, label: 'Tabela', match: '/' },
    { href: `/timeline${suffix}`, label: 'Timeline', match: '/timeline' },
  ];

  return (
    <nav className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
      {tabs.map((t) => {
        const active = pathname === t.match;
        return (
          <Link
            key={t.match}
            href={t.href}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition',
              active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
