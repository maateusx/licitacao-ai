'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, ApiError } from '@/lib/api-client';
import type { Keyword } from '@/lib/types';

export default function KeywordsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['keywords'],
    queryFn: api.listKeywords,
  });

  const [termo, setTermo] = useState('');
  const [peso, setPeso] = useState('1.0');
  const [createError, setCreateError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['keywords'] });

  const createMut = useMutation({
    mutationFn: api.createKeyword,
    onSuccess: () => {
      setTermo('');
      setPeso('1.0');
      setCreateError(null);
      invalidate();
    },
    onError: (err) => {
      setCreateError(
        err instanceof ApiError && err.status === 409
          ? 'Keyword já existe.'
          : err instanceof Error
            ? err.message
            : 'Erro ao criar',
      );
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Keywords</h2>
        <p className="text-xs text-slate-500">
          Termos que o coletor envia ao PNCP. Ative/desative ou ajuste peso (peso
          é informativo — não afeta o classificador na v1).
        </p>
      </div>

      <form
        className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const t = termo.trim();
          if (!t) return;
          const p = Number(peso);
          if (!Number.isFinite(p) || p <= 0) {
            setCreateError('Peso inválido');
            return;
          }
          createMut.mutate({ termo: t, peso: p });
        }}
      >
        <Field label="Termo" className="flex-1">
          <Input
            placeholder="ex: chatbot"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            maxLength={120}
            required
          />
        </Field>
        <Field label="Peso" className="w-24">
          <Input
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={createMut.isPending}>
          <Plus className="h-3.5 w-3.5" />
          {createMut.isPending ? 'Adicionando…' : 'Adicionar'}
        </Button>
      </form>
      {createError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {createError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        {isLoading && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Carregando…</div>
        )}
        {error && (
          <ErrorState
            message={(error as Error).message}
            onRetry={() => refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Nenhuma keyword cadastrada — adicione uma acima ou rode{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">pnpm db:seed</code>.
          </div>
        )}
        {data && data.data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Termo</th>
                <th className="w-24 px-4 py-2 text-right font-medium">Peso</th>
                <th className="w-24 px-4 py-2 text-center font-medium">Ativo</th>
                <th className="w-16 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((k) => (
                <KeywordRow key={k.id} keyword={k} onChanged={invalidate} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KeywordRow({ keyword, onChanged }: { keyword: Keyword; onChanged: () => void }) {
  const [pesoLocal, setPesoLocal] = useState(String(keyword.peso));
  const [error, setError] = useState<string | null>(null);

  const patchMut = useMutation({
    mutationFn: (body: { peso?: number; ativo?: boolean }) =>
      api.updateKeyword(keyword.id, body),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Erro'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteKeyword(keyword.id),
    onSuccess: onChanged,
    onError: (err) => setError(err instanceof Error ? err.message : 'Erro ao remover'),
  });

  const commitPeso = () => {
    const p = Number(pesoLocal);
    if (!Number.isFinite(p) || p <= 0) {
      setError('Peso inválido');
      setPesoLocal(String(keyword.peso));
      return;
    }
    if (p === keyword.peso) return;
    patchMut.mutate({ peso: p });
  };

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2 text-slate-900">{keyword.termo}</td>
      <td className="px-4 py-2 text-right">
        <Input
          type="number"
          step="0.1"
          min="0.1"
          max="10"
          value={pesoLocal}
          onChange={(e) => setPesoLocal(e.target.value)}
          onBlur={commitPeso}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-7 px-2 text-right text-xs"
          disabled={patchMut.isPending}
        />
      </td>
      <td className="px-4 py-2 text-center">
        <Switch
          checked={keyword.ativo}
          onCheckedChange={(v) => patchMut.mutate({ ativo: v })}
          disabled={patchMut.isPending}
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          aria-label="remover"
          onClick={() => {
            if (confirm(`Remover keyword "${keyword.termo}"?`)) deleteMut.mutate();
          }}
          disabled={deleteMut.isPending}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {error && <div className="mt-1 text-[10px] text-red-600">{error}</div>}
      </td>
    </tr>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <p className="text-sm text-red-700">Erro ao carregar: {message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
