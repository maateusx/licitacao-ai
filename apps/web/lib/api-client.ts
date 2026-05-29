import type {
  EmpresaPerfil,
  Execucao,
  ExecucoesResponse,
  Filtros,
  Keyword,
  KeywordsResponse,
  Licitacao,
  ListResponse,
  ReanalisarResponse,
  RunResponse,
  Stats,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, message?: string) {
    super(message ?? `API ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listLicitacoes: (qs: URLSearchParams) =>
    request<ListResponse>(`/api/licitacoes?${qs.toString()}`),
  getLicitacao: (id: string) => request<Licitacao>(`/api/licitacoes/${id}`),
  updateLicitacao: (id: string, body: { arquivada?: boolean; favorita?: boolean }) =>
    request<{ id: string; arquivada: boolean; favorita: boolean }>(`/api/licitacoes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  reanalisarLicitacao: (id: string) =>
    request<ReanalisarResponse>(`/api/licitacoes/${id}/reanalisar`, { method: 'POST' }),
  getStats: () => request<Stats>('/api/stats'),

  listKeywords: () => request<KeywordsResponse>('/api/keywords'),
  createKeyword: (body: { termo: string; peso?: number; ativo?: boolean }) =>
    request<Keyword>('/api/keywords', { method: 'POST', body: JSON.stringify(body) }),
  updateKeyword: (id: string, body: { termo?: string; peso?: number; ativo?: boolean }) =>
    request<Keyword>(`/api/keywords/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteKeyword: (id: string) =>
    request<void>(`/api/keywords/${id}`, { method: 'DELETE' }),

  listExecucoes: () => request<ExecucoesResponse>('/api/execucoes'),
  triggerRun: () => request<RunResponse>('/api/run', { method: 'POST' }),

  getEmpresaPerfil: () => request<EmpresaPerfil>('/api/empresa-perfil'),
  updateEmpresaPerfil: (body: { conteudo: string }) =>
    request<EmpresaPerfil>('/api/empresa-perfil', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getFiltros: () => request<Filtros>('/api/filtros'),
  updateFiltros: (body: Omit<Filtros, 'updated_at'>) =>
    request<Filtros>('/api/filtros', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export type { Execucao };
