-- gen_random_uuid() é built-in no Postgres 13+, não precisa de pgcrypto.

CREATE TABLE IF NOT EXISTS licitacoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pncp             text UNIQUE NOT NULL,
  titulo              text,
  objeto              text,
  orgao               text,
  uf                  text,
  municipio           text,
  modalidade          text,
  valor_estimado      numeric,
  status              text,
  data_publicacao     timestamptz,
  data_abertura       timestamptz,
  data_encerramento   timestamptz,
  url_pncp            text,
  raw                 jsonb NOT NULL,
  keywords_match      text[],
  arquivada           boolean NOT NULL DEFAULT false,
  favorita            boolean NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ALTERs idempotentes para bancos que já tinham a tabela criada antes.
ALTER TABLE licitacoes ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;
ALTER TABLE licitacoes ADD COLUMN IF NOT EXISTS favorita  boolean NOT NULL DEFAULT false;
-- Multi-fonte: id_pncp/url_pncp guardam id/link de qualquer fonte (nome histórico);
-- ids de fontes != 'pncp' vêm prefixados com '<fonte>:'.
ALTER TABLE licitacoes ADD COLUMN IF NOT EXISTS fonte text NOT NULL DEFAULT 'pncp';

CREATE INDEX IF NOT EXISTS idx_licitacoes_encerramento ON licitacoes(data_encerramento);
CREATE INDEX IF NOT EXISTS idx_licitacoes_fonte        ON licitacoes(fonte);
CREATE INDEX IF NOT EXISTS idx_licitacoes_uf           ON licitacoes(uf);
CREATE INDEX IF NOT EXISTS idx_licitacoes_status       ON licitacoes(status);
CREATE INDEX IF NOT EXISTS idx_licitacoes_keywords     ON licitacoes USING gin(keywords_match);
CREATE INDEX IF NOT EXISTS idx_licitacoes_arquivada    ON licitacoes(arquivada) WHERE arquivada = true;
CREATE INDEX IF NOT EXISTS idx_licitacoes_favorita     ON licitacoes(favorita) WHERE favorita = true;

CREATE TABLE IF NOT EXISTS keywords (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo       text UNIQUE NOT NULL,
  ativo       boolean DEFAULT true,
  peso        numeric DEFAULT 1.0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execucoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  total_encontradas     int DEFAULT 0,
  total_novas           int DEFAULT 0,
  total_classificadas   int DEFAULT 0,
  total_filtradas       int DEFAULT 0,
  total_erros_class     int DEFAULT 0,
  status                text NOT NULL DEFAULT 'running',
  erro                  text
);

-- total_filtradas / total_erros_class adicionados na Etapa 2; ALTERs idempotentes
-- para bancos que já tinham a tabela criada antes.
ALTER TABLE execucoes ADD COLUMN IF NOT EXISTS total_filtradas   int DEFAULT 0;
ALTER TABLE execucoes ADD COLUMN IF NOT EXISTS total_erros_class int DEFAULT 0;

-- score é nullable: quando o classificador falha em produzir JSON válido após
-- os retries, gravamos a análise com score=null / categoria='fora' para
-- preservar o rastro do erro.
CREATE TABLE IF NOT EXISTS analises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id    uuid NOT NULL REFERENCES licitacoes(id) ON DELETE CASCADE,
  score           int CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  categoria       text NOT NULL CHECK (categoria IN ('core', 'adjacente', 'fora')),
  justificativa   text,
  pontos_fortes   jsonb,
  red_flags       jsonb,
  modelo          text NOT NULL,
  prompt_version  text NOT NULL,
  erro            text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analises_licitacao ON analises(licitacao_id);
CREATE INDEX IF NOT EXISTS idx_analises_score     ON analises(score DESC);
CREATE INDEX IF NOT EXISTS idx_analises_categoria ON analises(categoria);

-- Singletons: id = 1 garante linha única. Conteúdo seeded em boot a partir
-- de config/empresa-perfil.md e config/filtros.json quando a tabela está vazia.
CREATE TABLE IF NOT EXISTS empresa_perfil (
  id          smallint PRIMARY KEY CHECK (id = 1),
  conteudo    text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS filtros (
  id                     smallint PRIMARY KEY CHECK (id = 1),
  valor_minimo           numeric NOT NULL DEFAULT 10000,
  blacklist_uf           text[]  NOT NULL DEFAULT '{}',
  blacklist_orgaos       text[]  NOT NULL DEFAULT '{}',
  blacklist_objeto_regex text[]  NOT NULL DEFAULT '{}',
  updated_at             timestamptz NOT NULL DEFAULT now()
);
