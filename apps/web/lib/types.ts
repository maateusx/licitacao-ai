export type Categoria = 'core' | 'adjacente' | 'fora';

export interface Analise {
  score: number | null;
  categoria: Categoria;
  justificativa: string | null;
  pontos_fortes: string[];
  red_flags: string[];
  modelo: string | null;
  created_at: string | null;
}

export interface Licitacao {
  id: string;
  fonte: string;
  id_pncp: string;
  titulo: string | null;
  objeto: string | null;
  orgao: string | null;
  uf: string | null;
  municipio: string | null;
  modalidade: string | null;
  valor_estimado: number | null;
  status: string | null;
  data_publicacao: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  url_pncp: string | null;
  keywords_match: string[];
  arquivada: boolean;
  favorita: boolean;
  created_at: string;
  updated_at: string;
  analise: Analise | null;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

export interface ListResponse {
  data: Licitacao[];
  pagination: Pagination;
}

export interface Stats {
  total_ativas: number;
  score_medio: number | null;
  fechando_em_7_dias: number;
  novas_semana: number;
  por_categoria: Record<Categoria, number>;
}

export interface Keyword {
  id: string;
  termo: string;
  ativo: boolean;
  peso: number;
  created_at: string;
}

export interface KeywordsResponse {
  data: Keyword[];
}

export interface Execucao {
  id: string;
  started_at: string;
  finished_at: string | null;
  duracao_ms: number | null;
  status: string;
  erro: string | null;
  total_encontradas: number;
  total_novas: number;
  total_classificadas: number;
  total_filtradas: number;
  total_erros_class: number;
}

export interface ExecucoesResponse {
  data: Execucao[];
  run_in_progress: boolean;
  last_started_at: string | null;
}

export interface RunResponse {
  status: 'started';
  started_at: string;
}

export interface EmpresaPerfil {
  conteudo: string;
  updated_at: string | null;
}

export interface Filtros {
  valor_minimo: number;
  blacklist_uf: string[];
  blacklist_orgaos: string[];
  blacklist_objeto_regex: string[];
  updated_at: string | null;
}

export interface ReanalisarResponse {
  ok: boolean;
  analise: {
    id: string;
    score: number | null;
    categoria: Categoria;
    justificativa?: string | null;
    pontos_fortes?: string[];
    red_flags?: string[];
    modelo?: string;
    created_at: string;
  };
  erro?: string;
}

export const NOME_FONTE: Record<string, string> = {
  pncp: 'PNCP',
  querido_diario: 'Querido Diário',
  petronect: 'Petronect',
  paradigma: 'Portal Paradigma (Sistema S)',
  gobuyer: 'GoBuyer (CNI/SESI/SENAI)',
};
