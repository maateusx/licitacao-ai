'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin/keywords', label: 'Keywords' },
  { href: '/admin/perfil', label: 'Perfil' },
  { href: '/admin/filtros', label: 'Filtros' },
  { href: '/admin/execucoes', label: 'Execuções' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Timeline
            </Link>
            <h1 className="text-sm font-semibold text-slate-900">Admin</h1>
          </div>
          <nav className="flex gap-1">
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition',
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
