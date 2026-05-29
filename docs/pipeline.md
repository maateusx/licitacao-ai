# Pipeline de coleta e classificação

O pipeline busca licitações no PNCP, filtra as irrelevantes e classifica o restante com o Gemini. Todo o código vive em [`apps/api/src/pipeline/`](../apps/api/src/pipeline/).

## Disparo

O pipeline pode ser iniciado de três formas — todas passam pelo mesmo lock em memória ([`run-lock.ts`](../apps/api/src/pipeline/run-lock.ts)), que impede duas execuções simultâneas:

| Origem | Como |
|---|---|
| **Cron** | Scheduler in-process ([`scheduler.ts`](../apps/api/src/scheduler.ts)). Default `0 6,18 * * *` (6h e 18h, `America/Sao_Paulo`). |
| **UI** | `/admin/execucoes` → botão "Rodar agora". |
| **HTTP** | `POST /api/run` (202 ao iniciar, 409 se já houver run em andamento). |
| **CLI** | `pnpm smoke [keyword] [maxPages] [--no-class]`. |

## Orquestração

[`orchestrator.ts`](../apps/api/src/pipeline/orchestrator.ts) → `runCollection(opts)` coordena tudo:

```
runCollection(opts)
  │
  ├─ INSERT em execucoes (status='running')
  │
  ├─ FASE 1 — COLETA
  │   para cada keyword ativa:
  │     fetchKeyword(client, keyword, { maxPages })
  │       ├─ pagina a busca do PNCP (rate-limit ~1 req/s)
  │       └─ para cada item: processItem() → upsert em licitacoes
  │   acumula as licitações novas num Map<id_pncp, ...>
  │
  ├─ FASE 2 — FILTRO  (pulada se opts.skipClassification)
  │   para cada licitação nova:
  │     applyHeuristicFilter(input, filtros)
  │       ├─ rejeitada → conta em total_filtradas
  │       └─ aprovada  → segue para classificação
  │
  ├─ FASE 3 — CLASSIFICAÇÃO
  │   para cada licitação aprovada:
  │     classifier.classify(input)
  │       ├─ ok    → INSERT em analises (score/categoria/...)
  │       └─ falha → INSERT em analises (score=null, categoria='fora', erro)
  │
  └─ UPDATE em execucoes (finished_at, status='done'|'error', totais)
```

## Fase 1 — Coleta

- [`pncp-client.ts`](../apps/api/src/pipeline/pncp-client.ts) — cliente HTTP do PNCP (undici). Aplica rate-limit, User-Agent customizado e retry com backoff exponencial em erros 5xx/timeout.
- [`fetcher.ts`](../apps/api/src/pipeline/fetcher.ts) → `fetchKeyword()` — pagina os resultados de uma keyword até a última página ou até o cap (`PNCP_MAX_PAGES_PER_KEYWORD`, default 20).
- [`dedup.ts`](../apps/api/src/pipeline/dedup.ts) → `processItem()` — normaliza os campos do item do PNCP (lidando com variações de nome) e faz **upsert** por `id_pncp`:
  - novo → `INSERT`;
  - existente → `UPDATE` em `updated_at`, merge de `keywords_match` e `status`.

A resposta crua da API é guardada em `licitacoes.raw` (jsonb) para permitir reprocessamento.

## Fase 2 — Filtro heurístico

[`heuristic-filter.ts`](../apps/api/src/pipeline/heuristic-filter.ts) → `applyHeuristicFilter()` aplica regras baratas **antes** de gastar tokens no LLM. Avalia em curto-circuito (a primeira regra que reprova encerra):

1. `valor_estimado >= valor_minimo`
2. UF não está em `blacklist_uf`
3. Órgão não bate com `blacklist_orgaos` (substring)
4. `objeto` não bate com nenhum regex em `blacklist_objeto_regex`

As regras vêm da tabela `filtros` (singleton, seeded de [`config/filtros.json`](../config/filtros.json)). Campos nulos/ausentes **nunca** bloqueiam — na dúvida, deixa o LLM decidir. Licitações reprovadas ficam no banco, mas não são enviadas ao Gemini.

## Fase 3 — Classificação (Gemini)

[`gemini-classifier.ts`](../apps/api/src/pipeline/gemini-classifier.ts) → classe `GeminiClassifier`:

- monta o prompt com [`prompts/classifier.v1.ts`](../apps/api/src/pipeline/prompts/classifier.v1.ts), injetando o **perfil da empresa** (tabela `empresa_perfil`, seeded de [`config/empresa-perfil.md`](../config/empresa-perfil.md));
- chama o modelo (`GEMINI_MODEL`, default `gemini-2.0-flash`);
- valida a saída com **Zod** no schema `{ score, categoria, justificativa, pontos_fortes, red_flags }`;
- em saída inválida, faz **retry com prompt corretivo** (até `CLASSIFIER_MAX_RETRIES`);
- esgotados os retries, grava a análise com `score=null` / `categoria='fora'` e a mensagem de erro, preservando o rastro.

O construtor lança erro se `GEMINI_API_KEY` não estiver setada — por isso o endpoint `/reanalisar` devolve **503** quando a chave falta, em vez de derrubar o servidor.

### Categorias

| Categoria | Significado |
|---|---|
| `core` | Encaixa diretamente no que a empresa vende |
| `adjacente` | Relacionado, pode valer a pena |
| `fora` | Fora de escopo |

O critério exato de cada categoria é definido no perfil da empresa em `config/empresa-perfil.md`.

## Persistência

- `licitacoes` — uma linha por edital (upsert por `id_pncp`).
- `analises` — relação **1:N** com `licitacoes`. Reanálise sempre faz `INSERT`, preservando o histórico; a UI mostra a análise mais recente.
- `execucoes` — uma linha por run, com os contadores (`total_encontradas`, `total_novas`, `total_classificadas`, `total_filtradas`, `total_erros_class`).

Ver [Banco de dados](./banco-de-dados.md) para o schema completo.
