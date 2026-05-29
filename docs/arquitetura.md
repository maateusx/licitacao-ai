# Arquitetura

## Visão geral

Licitações AI é um **monorepo pnpm** com dois aplicativos e um banco Postgres:

```
┌──────────────────────────────────────────────────────────────┐
│                         apps/web (Next.js 14)                   │
│  Timeline · Tabela · Admin (keywords / perfil / filtros / runs) │
└───────────────────────────────┬─────────────────────────────────┘
                                 │  HTTP (TanStack Query → api-client)
┌───────────────────────────────▼─────────────────────────────────┐
│                         apps/api (Fastify 5)                      │
│  Rotas REST  ·  Pipeline (orchestrator)  ·  Scheduler (cron)      │
└──────────┬──────────────────────────────────┬────────────────────┘
           │                                   │
   ┌───────▼────────┐                  ┌───────▼────────┐
   │  PNCP API      │                  │  Gemini API    │
   │ (busca pública)│                  │ (classificação)│
   └────────────────┘                  └────────────────┘
           │
   ┌───────▼────────────────────────────────────────────┐
   │  Postgres 16 (Docker)                                │
   │  licitacoes · analises · keywords · execucoes        │
   │  empresa_perfil · filtros                            │
   └──────────────────────────────────────────────────────┘
```

## Componentes

### `apps/api` — Backend (Fastify)

Servidor único que cumpre três papéis:

1. **API REST** — leitura/escrita de licitações, keywords, execuções e configuração. Ver [API REST](./api.md).
2. **Pipeline de coleta** — busca no PNCP, filtra e classifica. Ver [Pipeline](./pipeline.md).
3. **Scheduler** — cron in-process que dispara o pipeline automaticamente.

Entry point: [`apps/api/src/server.ts`](../apps/api/src/server.ts). No boot, ele:
- registra CORS e os 6 grupos de rotas;
- roda `seedConfigIfEmpty()` (popula `empresa_perfil`/`filtros` a partir de `config/` se vazios);
- sobe o HTTP listener;
- inicia o scheduler (depois do listen, para não disparar em deploy abortado).

### `apps/web` — Frontend (Next.js App Router)

UI que consome a API. Ver [Frontend](./frontend.md). Páginas principais: timeline (`/`), tabela (`/tabela`) e telas administrativas (`/admin/*`).

### Banco de dados (Postgres)

Acessado via **postgres-js** com uma camada de repositórios tipados em [`apps/api/src/db/repositories/`](../apps/api/src/db/repositories/). Ver [Banco de dados](./banco-de-dados.md).

## Fluxo de dados ponta-a-ponta

1. O **scheduler** (ou um disparo manual via UI/API) chama `runCollection()`.
2. O **pipeline** busca licitações no PNCP por keyword, deduplica por `id_pncp` e persiste em `licitacoes`.
3. Cada licitação nova passa pelo **filtro heurístico**; as que sobrevivem vão para o **classificador Gemini**, que grava o resultado em `analises`.
4. Cada execução registra contadores agregados em `execucoes`.
5. O **frontend** lê `licitacoes` + última `analise` via API e renderiza a timeline/tabela, com filtros sincronizados na URL.

## Stack

- **API** — Node 20, Fastify 5, postgres-js, Zod, Pino, undici, node-cron, `@google/generative-ai`
- **Web** — Next.js 14 (App Router), TanStack Query v5, Tailwind, shadcn/ui, nuqs
- **Infra** — Docker Compose (Postgres 16)
- **Monorepo** — pnpm workspaces (`@licitacoes/api`, `@licitacoes/web`)
