# Pipeline de IA para Licitações — PNCP

**Versão:** 0.1 (MVP)
**Autor:** Mateus
**Data:** 2026-05-17
**Status:** Especificação inicial

---

## 1. Visão geral

Pipeline local que monitora o Portal Nacional de Contratações Públicas (PNCP) em busca de licitações de software relevantes, classifica cada oportunidade via Gemini API e expõe os resultados em um frontend com timeline filtrável.

### Objetivos
- Reduzir o trabalho manual de garimpar licitações no PNCP.
- Priorizar oportunidades por fit estratégico (score 0–100) em vez de só por keyword.
- Visualizar prazos de proposta em uma timeline para não perder janelas.
- Ser simples, rodar localmente, sem dependência de cloud.

### Não-objetivos (fora do MVP)
- Autenticação / multi-usuário.
- Submissão automática de propostas.
- Download e parsing profundo de PDFs de edital (fase 2).
- Notificações push, email ou WhatsApp (fase 2).
- Deploy em produção / multi-tenant.

---

## 2. Contexto

### Fonte de dados
- **Endpoint:** `https://pncp.gov.br/api/search/`
- **Autenticação:** nenhuma.
- **Formato:** JSON.
- **Parâmetros de busca usados:**
  - `q` — palavra-chave (variável)
  - `tipos_documento=edital`
  - `ordenacao=-data`
  - `pagina` (1..N) / `tam_pagina=100`
  - `status=recebendo_proposta`
  - `tipos=1|4`

### Premissas técnicas
- Rodar 100% local (script + serviços em Docker quando aplicável).
- LLM via Gemini API (não local).
- Stack alinhada ao padrão Mateus: Node.js + Fastify + Supabase (Postgres) + Next.js.
- Mantém histórico de licitações encontradas mesmo que saiam do "recebendo_proposta".

---

## 3. Arquitetura

```
┌──────────────────────┐
│  Cron (2x/dia)       │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  PNCP Fetcher        │  multi-keyword, paginado
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Dedup               │  por id_pncp
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Filtro heurístico   │  valor, UF, blacklist, regex
└──────────┬───────────┘
           ▼
┌──────────────────────┐      ┌──────────────────────┐
│  Gemini Classifier   │─────▶│  Supabase (Postgres) │
└──────────────────────┘      └──────────┬───────────┘
                                         ▼
                              ┌──────────────────────┐
                              │  Fastify API         │
                              └──────────┬───────────┘
                                         ▼
                              ┌──────────────────────┐
                              │  Next.js (Timeline)  │
                              └──────────────────────┘
```

### Camadas
1. **Coleta** — Cron dispara o orchestrator, que itera sobre keywords ativas e pagina o endpoint do PNCP.
2. **Normalização & Dedup** — Cada licitação é mapeada para o schema interno; deduplica por `id_pncp`.
3. **Filtro heurístico** — Filtros baratos antes de gastar token (valor mínimo, UF, blacklist de órgãos).
4. **Classificação IA** — Gemini classifica fit com perfil da empresa e retorna JSON estruturado.
5. **Persistência** — Postgres armazena licitações e análises (1:N, suporta reanálise).
6. **API** — Fastify expõe REST para o frontend.
7. **UI** — Next.js com timeline + sidebar de filtros.

---

## 4. Modelo de dados

### Tabela `licitacoes`
```sql
CREATE TABLE licitacoes (
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
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_licitacoes_encerramento ON licitacoes(data_encerramento);
CREATE INDEX idx_licitacoes_uf ON licitacoes(uf);
CREATE INDEX idx_licitacoes_status ON licitacoes(status);
CREATE INDEX idx_licitacoes_keywords ON licitacoes USING gin(keywords_match);
```

### Tabela `analises`
```sql
CREATE TABLE analises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id    uuid NOT NULL REFERENCES licitacoes(id) ON DELETE CASCADE,
  score           int NOT NULL CHECK (score >= 0 AND score <= 100),
  categoria       text NOT NULL CHECK (categoria IN ('core', 'adjacente', 'fora')),
  justificativa   text,
  pontos_fortes   jsonb,
  red_flags       jsonb,
  modelo          text NOT NULL,
  prompt_version  text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_analises_licitacao ON analises(licitacao_id);
CREATE INDEX idx_analises_score ON analises(score DESC);
CREATE INDEX idx_analises_categoria ON analises(categoria);
```

### Tabela `keywords`
```sql
CREATE TABLE keywords (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo       text UNIQUE NOT NULL,
  ativo       boolean DEFAULT true,
  peso        numeric DEFAULT 1.0,
  created_at  timestamptz DEFAULT now()
);
```

### Tabela `execucoes`
```sql
CREATE TABLE execucoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  total_encontradas     int DEFAULT 0,
  total_novas           int DEFAULT 0,
  total_classificadas   int DEFAULT 0,
  status                text NOT NULL DEFAULT 'running',
  erro                  text
);
```

---

## 5. API REST

Todos os endpoints retornam JSON. Sem autenticação no MVP.

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/licitacoes` | Lista com filtros e paginação |
| GET | `/api/licitacoes/:id` | Detalhe + última análise |
| POST | `/api/licitacoes/:id/reanalisar` | Força nova análise |
| GET | `/api/stats` | Contadores para o dashboard |
| GET | `/api/keywords` | Lista keywords |
| POST | `/api/keywords` | Cria keyword |
| PATCH | `/api/keywords/:id` | Edita (ativar/desativar, peso) |
| DELETE | `/api/keywords/:id` | Remove |
| GET | `/api/execucoes` | Histórico de runs |
| POST | `/api/run` | Dispara pipeline manualmente |

### `GET /api/licitacoes` — query params
```
uf=MG,SP                    # multi
score_min=70
categoria=core,adjacente
data_inicio=2026-05-01
data_fim=2026-06-30
keyword=ia
busca=chatbot               # full-text em titulo+objeto
valor_min=50000
valor_max=500000
status=recebendo_proposta
page=1
page_size=50
order=data_encerramento     # data_encerramento | score | valor_estimado
```

### Response shape (lista)
```json
{
  "data": [
    {
      "id": "uuid",
      "id_pncp": "...",
      "titulo": "...",
      "orgao": "...",
      "uf": "MG",
      "valor_estimado": 150000,
      "data_encerramento": "2026-05-25T18:00:00Z",
      "analise": {
        "score": 85,
        "categoria": "core",
        "justificativa": "..."
      }
    }
  ],
  "pagination": { "page": 1, "page_size": 50, "total": 234 }
}
```

---

## 6. Pipeline em detalhe

### 6.1 PNCP Fetcher
- Para cada keyword `ativa` na tabela `keywords`:
  - Pagina `/api/search/` até a última página retornada ou até `pagina > 20` (safety cap).
  - Rate limit: 1 req/s entre chamadas.
  - Retry exponencial (3 tentativas) em 5xx / timeout.
  - User-Agent customizado identificando a aplicação.

### 6.2 Dedup
- Chave única: `id_pncp` (provavelmente `numero_controle_pncp` — confirmar na inspeção da API).
- Se já existe: faz `UPDATE` em `updated_at` + `keywords_match` (merge de keywords) + `status`.
- Se é nova: `INSERT` e marca para classificação.

### 6.3 Filtro heurístico
Aplica em sequência (curto-circuito ao primeiro falso):
- `valor_estimado >= config.valor_minimo` (quando informado)
- `uf NOT IN config.blacklist_uf`
- `orgao NOT IN config.blacklist_orgaos`
- Regex de blacklist no `objeto` (ex: licitações de impressão, café, limpeza)

Licitações filtradas são gravadas no banco mas **não vão ao Gemini** — economiza token.

### 6.4 Classificador Gemini

**Modelo:** `gemini-2.0-flash` (custo-benefício para classificação)

**Prompt estruturado** (resumo — versão completa em arquivo separado):
```
Você é um analista de oportunidades comerciais para uma empresa de
software brasileira. Avalie a licitação abaixo e classifique o fit
com o perfil da empresa.

PERFIL DA EMPRESA:
[descrição do portfólio — TakeFlow AI, Síndico Online, etc]

LICITAÇÃO:
Título: {titulo}
Órgão: {orgao} ({uf})
Objeto: {objeto}
Valor estimado: R$ {valor}
Modalidade: {modalidade}

Responda APENAS em JSON válido no formato:
{
  "score": 0-100,
  "categoria": "core" | "adjacente" | "fora",
  "justificativa": "1-2 frases",
  "pontos_fortes": ["..."],
  "red_flags": ["..."]
}
```

**Validação de saída:**
- Schema Zod aplicado em cada resposta.
- Em caso de erro de parsing, retry com prompt corretivo (max 2x).
- Falha persistente → grava análise com `score=null` e `categoria="fora"` + log do erro.

### 6.5 Orchestrator
Sequência por execução:
1. Cria registro em `execucoes` com `status=running`.
2. Roda fetcher → dedup → filtro → classifier.
3. Atualiza contadores agregados.
4. Marca `status=done` ou `status=error` com mensagem.

---

## 7. Frontend

### Rotas
- `/` — **Timeline** (view principal)
- `/lista` — Tabela densa
- `/licitacao/:id` — Página de detalhe
- `/admin/keywords` — CRUD de keywords
- `/admin/execucoes` — Histórico + botão "rodar agora"

### Timeline (página principal)

**Layout:**
- Header com stats (total ativas, score médio, fechando em 7 dias).
- Sidebar esquerda (~280px) com filtros.
- Área central com timeline scrollável horizontalmente.

**Eixo da timeline:**
- X = `data_encerramento` (prazo final de proposta).
- Granularidade: dia (com agrupamento por semana quando há muitos itens).
- Marca visual para "hoje".

**Cards:**
- Posição X pela data de encerramento.
- Cor pelo score: verde (≥80), amarelo (50–79), cinza (<50).
- Conteúdo: título truncado + órgão + UF + valor.
- Hover: tooltip com justificativa da IA.
- Click: drawer lateral com detalhe completo + link para PNCP.

**Badges:**
- 🔴 "Fecha em <7 dias"
- ⭐ Score ≥ 90
- 🆕 "Nova esta semana"

### Sidebar de filtros
- Busca textual (debounce 300ms)
- Multiselect: keywords
- Multiselect: UF
- Multiselect: categoria IA (core / adjacente / fora)
- Slider: score mínimo (default: 50)
- Range: valor estimado
- Multiselect: modalidade
- Toggle: "Só ainda em aberto" (default: on)
- Botão "Limpar filtros"

Estado dos filtros persistido na URL (querystring) para shareable links.

### Drawer de detalhe
- Título + órgão + UF + modalidade
- Valor estimado
- Datas (publicação, abertura, encerramento) com countdown
- Objeto completo
- Análise IA: score, categoria, justificativa, pontos fortes, red flags
- Botões: "Abrir no PNCP", "Reanalisar"

---

## 8. Stack técnica

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Fastify 4
- **DB client:** `@supabase/supabase-js` ou `postgres` (pg-native)
- **Validação:** Zod
- **HTTP client:** `undici` (nativo, performático)
- **Scheduler:** `node-cron` (in-process) ou cron do sistema
- **LLM:** `@google/generative-ai`
- **Logging:** `pino`

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Componentes:** shadcn/ui
- **Data fetching:** TanStack Query
- **Estado de filtros:** Zustand + sync com URL via `nuqs`
- **Timeline:** custom (SVG/canvas) ou `vis-timeline`
- **Datas:** `date-fns` com locale pt-BR

### Infra local
- **Supabase local:** Docker Compose
- **Sem cloud no MVP.**

---

## 9. Estrutura de pastas

```
licitacoes-ai/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── pipeline/
│   │   │   │   ├── pncp-client.ts
│   │   │   │   ├── fetcher.ts
│   │   │   │   ├── dedup.ts
│   │   │   │   ├── heuristic-filter.ts
│   │   │   │   ├── gemini-classifier.ts
│   │   │   │   ├── prompts/
│   │   │   │   │   └── classifier.v1.ts
│   │   │   │   └── orchestrator.ts
│   │   │   ├── routes/
│   │   │   │   ├── licitacoes.ts
│   │   │   │   ├── keywords.ts
│   │   │   │   ├── execucoes.ts
│   │   │   │   └── run.ts
│   │   │   ├── db/
│   │   │   │   ├── client.ts
│   │   │   │   ├── schema.sql
│   │   │   │   └── repositories/
│   │   │   ├── lib/
│   │   │   ├── config.ts
│   │   │   └── server.ts
│   │   ├── tests/
│   │   └── package.json
│   └── web/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── lista/page.tsx
│       │   ├── licitacao/[id]/page.tsx
│       │   └── admin/
│       │       ├── keywords/page.tsx
│       │       └── execucoes/page.tsx
│       ├── components/
│       │   ├── Timeline.tsx
│       │   ├── FilterSidebar.tsx
│       │   ├── LicitacaoCard.tsx
│       │   ├── LicitacaoDrawer.tsx
│       │   └── ui/
│       ├── lib/
│       │   ├── api-client.ts
│       │   └── filters.ts
│       └── package.json
├── packages/
│   └── shared-types/
│       └── src/index.ts
├── config/
│   ├── keywords.seed.json
│   └── empresa-perfil.md
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 10. Configuração

### `.env`
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash

# Pipeline
PNCP_RATE_LIMIT_MS=1000
PNCP_MAX_PAGES_PER_KEYWORD=20
HEURISTIC_VALOR_MINIMO=10000

# API
API_PORT=3001
API_HOST=0.0.0.0

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### `config/keywords.seed.json`
```json
[
  { "termo": "inteligência artificial", "peso": 1.0 },
  { "termo": "chatbot", "peso": 1.0 },
  { "termo": "agente virtual", "peso": 1.0 },
  { "termo": "atendimento automatizado", "peso": 0.9 },
  { "termo": "URA", "peso": 0.8 },
  { "termo": "voz", "peso": 0.7 },
  { "termo": "automação", "peso": 0.7 },
  { "termo": "RPA", "peso": 0.8 },
  { "termo": "gestão condominial", "peso": 1.0 },
  { "termo": "software de gestão", "peso": 0.6 }
]
```

### `config/empresa-perfil.md`
Documento usado dentro do prompt do classificador. Descreve em 2–3 parágrafos:
- O que a empresa vende (produtos do portfólio).
- Setores/clientes-alvo.
- Critérios do que conta como "core" vs "adjacente" vs "fora".

---

## 11. Roadmap MVP (~2 semanas)

### Sprint 1 — Coleta (2–3 dias)
- [ ] Docker Compose com Supabase local rodando
- [ ] `schema.sql` aplicado
- [ ] Inspeção empírica da API PNCP com 1 keyword real
- [ ] `pncp-client.ts` + `fetcher.ts` funcionando
- [ ] Dedup + persistência no banco
- [ ] Seed inicial de keywords
- [ ] Smoke test: rodar 1 keyword end-to-end

### Sprint 2 — Classificação (2–3 dias)
- [ ] Filtro heurístico configurável
- [ ] Prompt v1 do classificador (com perfil da empresa)
- [ ] `gemini-classifier.ts` com validação Zod + retry
- [ ] Tabela `analises` populada
- [ ] Orchestrator completo com log em `execucoes`

### Sprint 3 — API + Timeline (3–4 dias)
- [ ] Endpoints `/licitacoes`, `/licitacoes/:id`, `/stats`
- [ ] Next.js scaffold + shadcn/ui
- [ ] Componente `Timeline` funcional
- [ ] `FilterSidebar` com todos os filtros
- [ ] `LicitacaoDrawer` com análise IA

### Sprint 4 — Admin + polish (2 dias)
- [ ] CRUD de keywords
- [ ] View de execuções + botão "rodar agora"
- [ ] Cron local agendado
- [ ] README com instruções de setup
- [ ] Tratamento de erros e estados vazios

---

## 12. Critérios de aceitação do MVP

- [ ] `docker compose up` sobe Supabase em até 30s.
- [ ] `pnpm dev` sobe API e Web simultaneamente.
- [ ] Pipeline roda end-to-end em <5 min para 10 keywords.
- [ ] Custo Gemini por execução completa fica abaixo de R$ 2,00.
- [ ] Timeline exibe ≥ 50 licitações sem travar.
- [ ] Filtros aplicam em <500ms (com índices corretos).
- [ ] Reanalisar uma licitação cria nova linha em `analises` sem apagar a anterior.
- [ ] Não há nenhum dado mockado em produção do MVP.

---

## 13. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| API do PNCP mudar estrutura | Salvar resposta crua em `raw` (jsonb) — permite reprocessar |
| Gemini retornar JSON inválido | Validação Zod + retry com prompt corretivo + fallback gracioso |
| Custo de tokens explodir | Filtro heurístico antes do LLM + cap de keywords ativas |
| Duplicatas com `id_pncp` diferente | Possível dedup secundário por (orgao + objeto + data_publicacao) na fase 2 |
| Timeline travar com muitos itens | Virtualização + paginação server-side |

---

## 14. Fase 2 (pós-MVP)

Ideias para evoluir depois do MVP estar estável:
- Download e extração de texto do edital PDF (chunking + embedding).
- Análise profunda do edital (requisitos técnicos, exigências de habilitação, prazo de entrega).
- Notificações: email diário com top 5, integração WhatsApp.
- Multi-usuário com perfis de empresa distintos.
- Tracking de licitações ganhas/perdidas para feedback no classificador.
- Re-treinamento do prompt com base no histórico de decisões manuais.
- Comparativo com competidores (quem mais ganhou licitação X no histórico).
