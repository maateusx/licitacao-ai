# Configuração

A aplicação é configurada por **variáveis de ambiente** (comportamento) e por **arquivos em `config/`** (seed inicial do perfil, filtros e keywords).

## Variáveis de ambiente

Definidas em `.env` na raiz (usado pela API) e `apps/web/.env.local` (usado pelo web). Copie dos exemplos:

```bash
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
```

### API (`.env`)

| Variável | Default | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:54322/postgres` | Conexão Postgres |
| `GEMINI_API_KEY` | — | **Chave da API do Gemini** ([AI Studio](https://aistudio.google.com/app/apikey)). Obrigatória para classificar e para `/reanalisar` |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo usado no classificador |
| `GEMINI_RATE_LIMIT_MS` | `250` | Intervalo mínimo entre chamadas ao Gemini |
| `CLASSIFIER_MAX_RETRIES` | `2` | Retries com prompt corretivo em saída inválida |
| `PNCP_RATE_LIMIT_MS` | `1000` | Intervalo entre requisições ao PNCP |
| `PNCP_MAX_PAGES_PER_KEYWORD` | `20` | Cap de páginas por keyword |
| `PNCP_USER_AGENT` | (string de browser) | User-Agent enviado ao PNCP |
| `HEURISTIC_VALOR_MINIMO` | `10000` | Valor mínimo (R$) — usado como fallback do filtro |
| `API_PORT` | `3001` | Porta da API |
| `API_HOST` | `0.0.0.0` | Host de bind da API |
| `CORS_ORIGIN` | `*` | Origem permitida no CORS |
| `SCHEDULER_ENABLED` | `true` | Liga/desliga o cron in-process |
| `SCHEDULER_CRON` | `0 6,18 * * *` | Agenda do cron (5 campos) |
| `SCHEDULER_TIMEZONE` | `America/Sao_Paulo` | Timezone do scheduler |

A validação dessas variáveis acontece em [`apps/api/src/config.ts`](../apps/api/src/config.ts) (Zod).

### Web (`apps/web/.env.local`)

| Variável | Default | Descrição |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL da API consumida pelo frontend |

## Arquivos em `config/`

Esses arquivos são o **seed inicial**. No primeiro boot, a API copia `empresa-perfil.md` e `filtros.json` para o banco (tabelas singleton) caso estejam vazias — depois disso, a fonte de verdade passa a ser o banco, editável pelas telas `/admin/perfil` e `/admin/filtros`.

### [`config/keywords.seed.json`](../config/keywords.seed.json)

Lista de keywords iniciais (`termo` + `peso`), carregada por `pnpm db:seed`. Exemplo:

```json
[
  { "termo": "inteligência artificial", "peso": 1.0 },
  { "termo": "chatbot", "peso": 1.0 },
  { "termo": "software", "peso": 0.6 }
]
```

> O `peso` é informativo na v1 (não influencia a classificação). Gerencie as keywords em `/admin/keywords` após o seed.

### [`config/filtros.json`](../config/filtros.json)

Regras do filtro heurístico pré-LLM (ver [Pipeline](./pipeline.md)):

```json
{
  "blacklist_uf": [],
  "blacklist_orgaos": [],
  "blacklist_objeto_regex": [
    "\\b(impress(ão|ao)|toner|cartucho)\\b",
    "\\blimpeza\\s+(predial|hospitalar|urbana)\\b",
    "\\b(obra|reforma|construção\\s+civil|pavimentação)\\b"
  ]
}
```

- `blacklist_uf` — UFs a descartar.
- `blacklist_orgaos` — órgãos a descartar (match por substring).
- `blacklist_objeto_regex` — regex aplicados ao `objeto` para descartar categorias irrelevantes (materiais de consumo, limpeza, obras, etc.).

### `config/empresa-perfil.md`

Perfil da empresa em Markdown, **injetado no prompt do classificador**. Descreve o que a empresa vende, setores/clientes-alvo e os critérios de fit que definem `core` / `adjacente` / `fora`. Edite-o (ou via `/admin/perfil`) para adaptar a classificação ao seu negócio.

> Como esse conteúdo vai dentro do prompt, cada parágrafo custa tokens — mantenha-o objetivo.
