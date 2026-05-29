'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

export default function PerfilPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['empresa-perfil'],
    queryFn: api.getEmpresaPerfil,
  });

  const [conteudo, setConteudo] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Sincroniza textarea quando a query carrega/atualiza.
  useEffect(() => {
    if (data) setConteudo(data.conteudo);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: api.updateEmpresaPerfil,
    onSuccess: (next) => {
      setSaveError(null);
      setSavedAt(Date.now());
      qc.setQueryData(['empresa-perfil'], next);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar');
    },
  });

  const dirty = data ? conteudo !== data.conteudo : false;
  const trimmed = conteudo.trim();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Perfil da empresa</h2>
        <p className="text-xs text-slate-500">
          Markdown injetado no prompt do classificador Gemini. Cada parágrafo extra
          custa tokens em toda execução — seja objetivo.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Carregando…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Erro ao carregar: {(error as Error).message}
        </div>
      )}

      {data && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!trimmed) {
              setSaveError('Conteúdo vazio');
              return;
            }
            saveMut.mutate({ conteudo: trimmed });
          }}
        >
          <textarea
            value={conteudo}
            onChange={(e) => {
              setConteudo(e.target.value);
              setSavedAt(null);
            }}
            spellCheck={false}
            className="min-h-[480px] w-full rounded-lg border border-slate-300 bg-white p-4 font-mono text-xs leading-relaxed text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
            placeholder="# Perfil da empresa..."
          />

          {saveError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              {data.updated_at && (
                <span>
                  Última edição:{' '}
                  {format(parseISO(data.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              )}
              {savedAt && !dirty && (
                <span className="ml-2 text-emerald-700">Salvo.</span>
              )}
            </div>
            <Button type="submit" disabled={saveMut.isPending || !dirty || !trimmed}>
              <Save className="h-3.5 w-3.5" />
              {saveMut.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
