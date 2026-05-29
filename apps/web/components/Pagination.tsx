'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from '@/lib/filters';
import { cn } from '@/lib/utils';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {from}–{to} de <span className="font-medium text-slate-900">{total}</span>
        </span>
        <label className="flex items-center gap-1.5">
          <span>por página</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <PageButton onClick={() => onPageChange(1)} disabled={safePage <= 1} label="primeira">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </PageButton>
        <PageButton
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          label="anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageButton>
        <span className="px-2 tabular-nums">
          Página <span className="font-medium text-slate-900">{safePage}</span> de {totalPages}
        </span>
        <PageButton
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          label="próxima"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PageButton>
        <PageButton
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          label="última"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}
