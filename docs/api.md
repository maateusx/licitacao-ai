# API REST

Servidor Fastify em [`apps/api/src/`](../apps/api/src/). Base URL local: `http://localhost:3001`. Todas as rotas de dados ficam sob `/api`. Validação de entrada com Zod; respostas e corpos em JSON.

## Health

| Método | Rota | Resposta |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |

## Licitações

Arquivo: [`routes/licitacoes.ts`](../apps/api/src/routes/licitacoes.ts).

### `GET /api/licitacoes`

Lista licitações com a última análise embutida, filtros e paginação.

**Query params** (todos opcionais):

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `uf` | CSV | — | UFs (2 letras), ex. `SP,MG` |
| `score_min` | int 0–100 | — | Score mínimo da análise |
| `categoria` | CSV | — | `core` / `adjacente` / `fora` |
| `data_inicio` | date | — | Filtra por `data_encerramento` ≥ |
| `data_fim` | date | — | Filtra por `data_encerramento` ≤ |
| `keyword` | CSV | — | Filtra por keyword de match |
| `busca` | string | — | Busca textual em título/objeto |
| `valor_min` | number | — | Valor estimado mínimo |
| `valor_max` | number | — | Valor estimado máximo |
| `status` | string | — | Status do edital |
| `arquivada` | enum | `ativas` | `ativas` / `incluir` / `so` |
| `so_favoritas` | boolean | — | Só favoritas |
| `page` | int | `1` | Página |
| `page_size` | int (máx 200) | `50` | Itens por página |
| `order` | enum | `data_encerramento` | `data_encerramento` / `data_abertura` / `score` / `valor_estimado` / `titulo` / `orgao` / `uf` |
| `direction` | enum | — | `asc` / `desc` |

**Resposta:**
```json
{
  "data": [ { /* licitação + campo `analise` (ou null) */ } ],
  "pagination": { "page": 1, "page_size": 50, "total": 123 }
}
```

Cada item inclui os campos da licitação (`id`, `id_pncp`, `titulo`, `objeto`, `orgao`, `uf`, `municipio`, `modalidade`, `valor_estimado`, `status`, datas, `url_pncp`, `keywords_match`, `arquivada`, `favorita`) e um objeto `analise` (`score`, `categoria`, `justificativa`, `pontos_fortes`, `red_flags`, `modelo`, `created_at`) ou `null`.

Erros: `400 invalid_query` (params inválidos).

### `GET /api/licitacoes/:id`

Detalhe de uma licitação + última análise. Erros: `400 invalid_id`, `404 not_found`.

### `PATCH /api/licitacoes/:id`

Alterna as flags do usuário. Corpo (pelo menos um campo):
```json
{ "arquivada": true, "favorita": false }
```
Erros: `400 invalid_id` / `400 invalid_body`, `404 not_found`.

### `POST /api/licitacoes/:id/reanalisar`

Força nova classificação Gemini, criando **nova linha** em `analises` (mantém o histórico). Erros: `400 invalid_id`, `404 not_found`, `503 gemini_unavailable` (quando `GEMINI_API_KEY` não está configurada).

## Stats

Arquivo: [`routes/stats.ts`](../apps/api/src/routes/stats.ts).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/stats` | Contadores agregados do dashboard (totais, média de score, distribuição por categoria) |

## Keywords

Arquivo: [`routes/keywords.ts`](../apps/api/src/routes/keywords.ts).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/keywords` | Lista todas (ativas + inativas) |
| POST | `/api/keywords` | Cria keyword |
| PATCH | `/api/keywords/:id` | Edita (`termo`, `ativo`, `peso`) |
| DELETE | `/api/keywords/:id` | Remove |

## Execuções

Arquivo: [`routes/execucoes.ts`](../apps/api/src/routes/execucoes.ts).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/execucoes` | Histórico (últimas 50) + flag `run_in_progress` |
| POST | `/api/run` | Dispara o pipeline async. `202` ao iniciar, `409` se já estiver rodando |

## Perfil da empresa

Arquivo: [`routes/empresa-perfil.ts`](../apps/api/src/routes/empresa-perfil.ts). Singleton (Markdown) injetado no prompt do classificador.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/empresa-perfil` | Conteúdo atual (Markdown) |
| PATCH | `/api/empresa-perfil` | Atualiza o conteúdo (invalida o cache em memória) |

## Filtros heurísticos

Arquivo: [`routes/filtros.ts`](../apps/api/src/routes/filtros.ts). Singleton com as regras do filtro pré-LLM.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/filtros` | Regras atuais (`valor_minimo`, blacklists) |
| PATCH | `/api/filtros` | Atualiza as regras (valida os regex antes de salvar) |
