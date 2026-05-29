# Banco de dados

Postgres 16 (via Docker Compose). Acesso por **postgres-js** ([`db/client.ts`](../apps/api/src/db/client.ts)) com uma camada de repositórios tipados em [`db/repositories/`](../apps/api/src/db/repositories/). O schema é definido em [`db/schema.sql`](../apps/api/src/db/schema.sql) e aplicado de forma idempotente com `pnpm db:schema`.

## Diagrama de relacionamento

```
keywords        execucoes        empresa_perfil (singleton id=1)
                                 filtros        (singleton id=1)

licitacoes 1 ──── N analises
   (id_pncp unique)   (licitacao_id FK, ON DELETE CASCADE)
```

## `licitacoes`

Uma linha por edital coletado. Upsert por `id_pncp`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `id_pncp` | text UNIQUE NOT NULL | ID externo no PNCP |
| `titulo` | text | |
| `objeto` | text | Descrição do objeto da contratação |
| `orgao` | text | Órgão público |
| `uf` | text | UF (ex. `SP`) |
| `municipio` | text | |
| `modalidade` | text | Modalidade de contratação |
| `valor_estimado` | numeric | Valor estimado (R$) |
| `status` | text | Status do edital |
| `data_publicacao` | timestamptz | |
| `data_abertura` | timestamptz | |
| `data_encerramento` | timestamptz | Prazo (eixo da timeline) |
| `url_pncp` | text | Link para o edital no PNCP |
| `raw` | jsonb NOT NULL | Resposta crua do PNCP (reprocessamento) |
| `keywords_match` | text[] | Keywords que casaram (merge no upsert) |
| `arquivada` | boolean NOT NULL = false | Flag do usuário |
| `favorita` | boolean NOT NULL = false | Flag do usuário |
| `created_at` / `updated_at` | timestamptz = now() | |

**Índices:** `data_encerramento`, `uf`, `status`, GIN em `keywords_match`, e parciais em `arquivada`/`favorita` (`WHERE ... = true`).

## `analises`

Resultado de cada classificação. Relação **1:N** com `licitacoes` — reanálise cria nova linha (histórico preservado).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `licitacao_id` | uuid FK NOT NULL | `REFERENCES licitacoes(id) ON DELETE CASCADE` |
| `score` | int | `NULL` ou 0–100 (CHECK). `NULL` = classificação falhou |
| `categoria` | text NOT NULL | CHECK em `core` / `adjacente` / `fora` |
| `justificativa` | text | |
| `pontos_fortes` | jsonb | Array de pontos fortes |
| `red_flags` | jsonb | Array de alertas |
| `modelo` | text NOT NULL | Ex. `gemini-2.0-flash` |
| `prompt_version` | text NOT NULL | Ex. `classifier.v1` |
| `erro` | text | Mensagem (quando a classificação falhou) |
| `created_at` | timestamptz = now() | |

**Índices:** `licitacao_id`, `score DESC`, `categoria`.

## `keywords`

Termos usados na busca do PNCP. CRUD em `/admin/keywords`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `termo` | text UNIQUE NOT NULL | |
| `ativo` | boolean = true | Inclui na coleta? |
| `peso` | numeric = 1.0 | Metadado (v1 não usa na classificação) |
| `created_at` | timestamptz = now() | |

Seed inicial: [`config/keywords.seed.json`](../config/keywords.seed.json) via `pnpm db:seed`.

## `execucoes`

Trilha de auditoria das execuções do pipeline.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `started_at` | timestamptz NOT NULL = now() | |
| `finished_at` | timestamptz | `NULL` enquanto roda |
| `total_encontradas` | int = 0 | Encontradas no PNCP |
| `total_novas` | int = 0 | Novas no banco |
| `total_classificadas` | int = 0 | Classificadas com sucesso |
| `total_filtradas` | int = 0 | Reprovadas no filtro heurístico |
| `total_erros_class` | int = 0 | Falhas de classificação |
| `status` | text NOT NULL = `running` | `running` / `done` / `error` |
| `erro` | text | Mensagem quando `status='error'` |

## `empresa_perfil` (singleton)

`id = 1` (CHECK força linha única). Markdown injetado no prompt do classificador. Seeded de [`config/empresa-perfil.md`](../config/empresa-perfil.md) no boot se vazio.

| Coluna | Tipo |
|---|---|
| `id` | smallint PK CHECK (id = 1) |
| `conteudo` | text NOT NULL |
| `updated_at` | timestamptz NOT NULL = now() |

## `filtros` (singleton)

`id = 1`. Regras do filtro heurístico pré-LLM. Seeded de [`config/filtros.json`](../config/filtros.json) no boot se vazio.

| Coluna | Tipo | Default |
|---|---|---|
| `id` | smallint PK CHECK (id = 1) | |
| `valor_minimo` | numeric NOT NULL | `10000` |
| `blacklist_uf` | text[] NOT NULL | `{}` |
| `blacklist_orgaos` | text[] NOT NULL | `{}` (match por substring) |
| `blacklist_objeto_regex` | text[] NOT NULL | `{}` (regex no objeto) |
| `updated_at` | timestamptz NOT NULL = now() | |

## Scripts

| Comando | Arquivo | O que faz |
|---|---|---|
| `pnpm db:schema` | [`scripts/apply-schema.ts`](../apps/api/src/scripts/apply-schema.ts) | Aplica `schema.sql` (idempotente) |
| `pnpm db:seed` | [`scripts/seed-keywords.ts`](../apps/api/src/scripts/seed-keywords.ts) | Carrega `keywords.seed.json` |

> Os singletons `empresa_perfil`/`filtros` são populados automaticamente no boot da API por `seedConfigIfEmpty()` quando estão vazios.
