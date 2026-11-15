# Licitações AI

Encontrar oportunidades relevantes em licitações públicas brasileiras é um trabalho manual e tedioso: são milhares de editais publicados todos os dias no [PNCP](https://pncp.gov.br/) (Portal Nacional de Contratações Públicas), a grande maioria irrelevante para qualquer empresa específica.

**Licitações AI** automatiza esse garimpo para o seu nicho — seja ele software, obras, equipamentos médicos ou qualquer outro — definido pelas palavras-chave que você cadastra e pelo perfil da sua empresa. É um pipeline que:

1. **Monitora** o PNCP, diários municipais (Querido Diário), Petronect e portais do Sistema S por palavras-chave (cron automático ou disparo manual);
2. **Filtra** os resultados por heurísticas (valor mínimo, UF/órgão, regex de objeto);
3. **Classifica** cada oportunidade restante usando o **Gemini**, avaliando se faz sentido para o perfil da sua empresa;
4. **Exibe** tudo numa timeline web filtrável, com histórico de execuções e reanálise sob demanda.

Roda inteiramente local, com Postgres em Docker.

📚 **Documentação técnica completa em [`docs/`](./docs/)** — [arquitetura](./docs/arquitetura.md), [pipeline](./docs/pipeline.md), [API REST](./docs/api.md), [banco de dados](./docs/banco-de-dados.md), [frontend](./docs/frontend.md) e [configuração](./docs/configuracao.md).

## Funcionalidades

- 🔎 **Busca multi-keyword e multi-fonte**: PNCP, Querido Diário, Petronect, portais Paradigma e GoBuyer do Sistema S ([detalhes](./docs/pipeline.md#fase-1--coleta)).
- 🧹 **Filtro heurístico** configurável sem rebuild ([`config/filtros.json`](./config/filtros.json)).
- 🤖 **Classificação por IA** (Gemini) com validação de schema (Zod) e retry, usando o perfil da empresa como contexto ([`config/empresa-perfil.md`](./config/empresa-perfil.md)).
- 📅 **Timeline filtrável** com estado sincronizado na URL.
- ⚙️ **Painel admin** para gerenciar keywords (CRUD, peso, on/off) e acompanhar execuções.
- 🔁 **Reanálise sob demanda** de qualquer licitação direto pela UI.
- ⏰ **Scheduler in-process** (cron) configurável.

## Stack

- **API** — Node 20 + Fastify 5 + Postgres (postgres-js) + Zod + Pino
- **Pipeline** — undici (HTTP), node-cron (scheduler), `@google/generative-ai` via REST
- **Web** — Next.js 14 (App Router) + TanStack Query + Tailwind + shadcn/ui + nuqs
- **Infra local** — Docker Compose (Postgres 16)

Monorepo gerenciado com **pnpm workspaces**.

## Como rodar

**Pré-requisitos:** Node 20+, pnpm 10+ e Docker.

```bash
# 1. Clone e instale dependências
git clone <url-do-repo>
cd licitacao-ai
pnpm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
# Edite .env e preencha GEMINI_API_KEY (veja "Variáveis de ambiente" abaixo).
# Opcional no smoke test; obrigatório para classificar e para /reanalisar.

# 3. Suba o banco e prepare o schema
pnpm db:up        # Postgres em :54322 (volume em ./supabase-data/)
pnpm db:schema    # aplica apps/api/src/db/schema.sql (idempotente)
pnpm db:seed      # popula keywords iniciais de config/keywords.seed.json

# 4. Suba API (:3001) + Web (:3000) em paralelo
pnpm dev
```

Acesse **[http://localhost:3000](http://localhost:3000)**.

> **Obtendo uma chave Gemini:** crie uma gratuitamente no [Google AI Studio](https://aistudio.google.com/app/apikey) e cole em `GEMINI_API_KEY` no `.env`. Sem ela, o app sobe e lista licitações, mas a classificação e o botão "Reanalisar" retornam 503.

## Variáveis de ambiente

Definidas em `.env` (raiz, usado pela API) e `apps/web/.env.local` (web). Veja [`.env.example`](./.env.example) para a lista completa com defaults.

| Variável | Default | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:54322/postgres` | Conexão com o Postgres |
| `GEMINI_API_KEY` | — | **Chave da API do Gemini** (obrigatória para classificar) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo usado no classificador |
| `PNCP_RATE_LIMIT_MS` | `1000` | Intervalo entre requisições ao PNCP |
| `PNCP_MAX_PAGES_PER_KEYWORD` | `20` | Limite de páginas por keyword |
| `HEURISTIC_VALOR_MINIMO` | `10000` | Valor mínimo (R$) para passar no filtro |
| `API_PORT` / `API_HOST` | `3001` / `0.0.0.0` | Bind da API |
| `CORS_ORIGIN` | `*` | Origem permitida no CORS |
| `SCHEDULER_ENABLED` | `true` | Liga/desliga o cron in-process |
| `SCHEDULER_CRON` | `0 6,18 * * *` | Agenda do cron (5 campos) |
| `SCHEDULER_TIMEZONE` | `America/Sao_Paulo` | Timezone do scheduler |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL da API usada pelo web |

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | API + Web em paralelo |
| `pnpm dev:api` / `pnpm dev:web` | Sobe um lado só |
| `pnpm build` | Build de produção do web (Next) |
| `pnpm typecheck` | Typecheck dos dois pacotes |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:logs` | Controla o Postgres no Docker |
| `pnpm db:schema` | Aplica/atualiza schema |
| `pnpm db:seed` | Popula keywords iniciais |
| `pnpm smoke` | Roda o pipeline ponta-a-ponta para 1 keyword (use `--no-class` para pular Gemini) |
| `pnpm classify:test` | Testa só o classificador num input estático |

## Pipeline

Disparo automático: cron in-process via `node-cron`. Default `0 6,18 * * *` (6h e 18h, `America/Sao_Paulo`). Configurável em `SCHEDULER_CRON` / `SCHEDULER_TIMEZONE` / `SCHEDULER_ENABLED=false`.

Disparo manual:

- **UI** — `/admin/execucoes` → botão "Rodar agora"
- **HTTP** — `POST /api/run` (202 quando inicia, 409 se já estiver rodando)
- **CLI** — `pnpm smoke [keyword] [maxPages] [--no-class]`

Sequência: PNCP fetcher (multi-keyword paginado, rate-limit 1 req/s) → dedup por `id_pncp` → filtro heurístico (valor mínimo, blacklist de UF/órgão, regex de objeto — config em [`config/filtros.json`](./config/filtros.json)) → classificador Gemini com validação Zod + retry → persistência em `licitacoes` / `analises` (1:N, reanálise sempre faz `INSERT`) → log em `execucoes`.

## API

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/licitacoes` | Lista com filtros e paginação |
| GET | `/api/licitacoes/:id` | Detalhe + última análise |
| PATCH | `/api/licitacoes/:id` | Alterna flags (`arquivada`, `favorita`) |
| POST | `/api/licitacoes/:id/reanalisar` | Força nova análise (cria nova linha em `analises`) |
| GET | `/api/stats` | Contadores do dashboard |
| GET | `/api/keywords` | Lista (todas, ativas + inativas) |
| POST | `/api/keywords` | Cria |
| PATCH | `/api/keywords/:id` | Edita (`termo`, `ativo`, `peso`) |
| DELETE | `/api/keywords/:id` | Remove |
| GET | `/api/execucoes` | Histórico (últimas 50) + `run_in_progress` |
| POST | `/api/run` | Dispara o pipeline (async) |
| GET / PATCH | `/api/empresa-perfil` | Lê/edita o perfil da empresa (usado no prompt) |
| GET / PATCH | `/api/filtros` | Lê/edita as regras do filtro heurístico |

Referência completa de query params e respostas: [docs/api.md](./docs/api.md).

## UI

- `/` — Timeline filtrável (estado dos filtros sincronizado na URL)
- `/tabela` — Mesmos dados/filtros em tabela ordenável + paginação
- `/admin/keywords` — CRUD de keywords (peso + on/off + remoção)
- `/admin/perfil` — Editor do perfil da empresa (Markdown, injetado no prompt)
- `/admin/filtros` — Editor das regras do filtro heurístico
- `/admin/execucoes` — Histórico de runs + botão "Rodar agora" (faz polling enquanto há run em andamento)
- Drawer de detalhe — análise IA + ações: reanalisar, arquivar/restaurar, favoritar

Detalhes de componentes e camada de dados: [docs/frontend.md](./docs/frontend.md).

## Estrutura

```text
apps/
├── api/        # Fastify + pipeline + scheduler
└── web/        # Next.js (App Router)
config/
├── filtros.json
├── keywords.seed.json
└── empresa-perfil.md   # usado no prompt do classificador
docs/                   # documentação técnica
docker-compose.yml
licitacoes-ai.spec
```

## Troubleshooting

- **`pnpm dev` reclama de porta ocupada** — outro processo usa 3000 ou 3001. Mate com `lsof -ti:3001 | xargs kill` ou troque `API_PORT`.
- **API responde mas web mostra erro de fetch** — confira `NEXT_PUBLIC_API_URL` em `apps/web/.env.local`.
- **Botão "Reanalisar" devolve 503** — `GEMINI_API_KEY` não configurada. Edite `.env` e reinicie a API.
- **Cron não dispara** — `SCHEDULER_ENABLED=false`? Cron inválido? Confira logs no boot da API (`scheduler started` indica que está ativo).

## Licença

[Unlicense](./LICENSE) — domínio público. Use para o que quiser.
