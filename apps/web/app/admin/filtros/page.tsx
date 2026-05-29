'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api-client';
import type { Filtros } from '@/lib/types';

type Editable = Omit<Filtros, 'updated_at'>;

const EMPTY: Editable = {
  valor_minimo: 0,
  blacklist_uf: [],
  blacklist_orgaos: [],
  blacklist_objeto_regex: [],
};

export default function FiltrosPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['filtros'],
    queryFn: api.getFiltros,
  });

  const [draft, setDraft] = useState<Editable>(EMPTY);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [regexErrors, setRegexErrors] = useState<{ padrao: string; erro: string }[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (data) {
      setDraft({
        valor_minimo: data.valor_minimo,
        blacklist_uf: data.blacklist_uf,
        blacklist_orgaos: data.blacklist_orgaos,
        blacklist_objeto_regex: data.blacklist_objeto_regex,
      });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: api.updateFiltros,
    onSuccess: (next) => {
      setSaveError(null);
      setRegexErrors([]);
      setSavedAt(Date.now());
      qc.setQueryData(['filtros'], next);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.body);
          if (body.error === 'regex_invalida' && Array.isArray(body.regex_invalidas)) {
            setRegexErrors(body.regex_invalidas);
            setSaveError('Há regex inválidas — corrija antes de salvar.');
            return;
          }
        } catch {
          // body não era JSON
        }
      }
      setRegexErrors([]);
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar');
    },
  });

  const dirty = data ? !sameEditable(draft, data) : false;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
        <p className="text-xs text-slate-500">
          Pré-filtro heurístico aplicado antes do classificador Gemini —
          licitações que batem em qualquer regra são descartadas sem custo de
          LLM. Regex são case-insensitive.
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
        <div className="flex flex-col gap-5">
          <Section title="Valor mínimo (R$)" hint="Licitações abaixo desse valor são descartadas.">
            <Input
              type="number"
              min={0}
              step={1000}
              value={draft.valor_minimo}
              onChange={(e) => {
                setDraft({ ...draft, valor_minimo: Number(e.target.value) });
                setSavedAt(null);
              }}
              className="w-48"
            />
          </Section>

          <Section
            title="Blacklist de UF"
            hint="Siglas de 2 letras. Ex: SP, RJ. Vazio = sem restrição."
          >
            <TagEditor
              values={draft.blacklist_uf}
              onChange={(v) => {
                setDraft({ ...draft, blacklist_uf: v });
                setSavedAt(null);
              }}
              placeholder="Ex: SP"
              transform={(v) => v.trim().toUpperCase()}
              validate={(v) => (v.length === 2 ? null : 'UF deve ter 2 letras')}
            />
          </Section>

          <Section
            title="Blacklist de órgãos"
            hint="Substring case-insensitive — se o nome do órgão contém esse texto, é descartado."
          >
            <TagEditor
              values={draft.blacklist_orgaos}
              onChange={(v) => {
                setDraft({ ...draft, blacklist_orgaos: v });
                setSavedAt(null);
              }}
              placeholder="Ex: ministério da defesa"
            />
          </Section>

          <Section
            title="Blacklist de objeto (regex)"
            hint="Regex JS (sem flags — i é aplicado automaticamente). Cada padrão é testado contra o campo objeto."
          >
            <TagEditor
              values={draft.blacklist_objeto_regex}
              onChange={(v) => {
                setDraft({ ...draft, blacklist_objeto_regex: v });
                setSavedAt(null);
                setRegexErrors([]);
              }}
              placeholder={String.raw`Ex: \b(impress(ão|ao)|toner)\b`}
              mono
              validate={(v) => {
                try {
                  new RegExp(v, 'i');
                  return null;
                } catch (err) {
                  return err instanceof Error ? err.message : 'regex inválida';
                }
              }}
              invalidValues={new Set(regexErrors.map((r) => r.padrao))}
            />
            {regexErrors.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-red-700">
                {regexErrors.map((r, i) => (
                  <li key={i}>
                    <code className="rounded bg-red-100 px-1 py-0.5">{r.padrao}</code> —{' '}
                    {r.erro}
                  </li>
                ))}
              </ul>
            )}
          </Section>

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
                  {format(parseISO(data.updated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </span>
              )}
              {savedAt && !dirty && <span className="ml-2 text-emerald-700">Salvo.</span>}
            </div>
            <Button
              onClick={() => saveMut.mutate(draft)}
              disabled={saveMut.isPending || !dirty}
            >
              <Save className="h-3.5 w-3.5" />
              {saveMut.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      {hint && <p className="mb-3 mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

function TagEditor({
  values,
  onChange,
  placeholder,
  transform,
  validate,
  invalidValues,
  mono,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  transform?: (v: string) => string;
  validate?: (v: string) => string | null;
  invalidValues?: Set<string>;
  mono?: boolean;
}) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  function add() {
    const v = (transform ? transform(input) : input.trim());
    if (!v) return;
    if (values.includes(v)) {
      setInputError('Já está na lista');
      return;
    }
    const validationErr = validate?.(v) ?? null;
    if (validationErr) {
      setInputError(validationErr);
      return;
    }
    onChange([...values, v]);
    setInput('');
    setInputError(null);
  }

  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setInputError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={mono ? 'font-mono text-xs' : undefined}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>
      {inputError && (
        <p className="mt-1 text-[11px] text-red-700">{inputError}</p>
      )}
      {values.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {values.map((v, i) => {
            const bad = invalidValues?.has(v) ?? false;
            return (
              <li
                key={`${v}-${i}`}
                className={
                  bad
                    ? 'inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-800'
                    : 'inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-800'
                }
              >
                <span className={mono ? 'font-mono' : undefined}>{v}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function sameEditable(a: Editable, b: Filtros): boolean {
  return (
    a.valor_minimo === b.valor_minimo &&
    sameStrArr(a.blacklist_uf, b.blacklist_uf) &&
    sameStrArr(a.blacklist_orgaos, b.blacklist_orgaos) &&
    sameStrArr(a.blacklist_objeto_regex, b.blacklist_objeto_regex)
  );
}

function sameStrArr(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
