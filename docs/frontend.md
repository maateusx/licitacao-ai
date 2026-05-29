# Frontend

App **Next.js 14 (App Router)** em [`apps/web/`](../apps/web/). Consome a API via TanStack Query. Estilização com Tailwind + shadcn/ui.

## Estrutura

```
apps/web/
├── app/
│   ├── layout.tsx              # Shell raiz
│   ├── providers.tsx           # QueryClientProvider (TanStack Query)
│   ├── page.tsx                # /        — Timeline
│   ├── tabela/page.tsx         # /tabela  — visão em tabela
│   └── admin/
│       ├── layout.tsx          # Header + navegação do admin
│       ├── keywords/page.tsx   # /admin/keywords
│       ├── perfil/page.tsx     # /admin/perfil
│       ├── filtros/page.tsx    # /admin/filtros
│       └── execucoes/page.tsx  # /admin/execucoes
├── components/
│   ├── Header.tsx
│   ├── FilterSidebar.tsx
│   ├── Timeline.tsx
│   ├── LicitacaoCard.tsx
│   ├── LicitacaoDrawer.tsx
│   ├── LicitacoesTable.tsx
│   ├── Pagination.tsx
│   └── ui/                     # primitivos shadcn (badge, button, input, sheet, slider, switch, tooltip)
└── lib/
    ├── api-client.ts           # wrapper de fetch sobre a API
    ├── types.ts                # tipos das respostas da API
    ├── filters.ts              # constantes + defaults dos filtros
    ├── use-filters.ts          # hook de estado de filtros (sincronizado na URL via nuqs)
    └── utils.ts                # helpers (formatação BRL, cn, etc.)
```

## Páginas

| Rota | Arquivo | Descrição |
|---|---|---|
| `/` | `app/page.tsx` | Timeline filtrável — eixo X por `data_encerramento`, cor por score |
| `/tabela` | `app/tabela/page.tsx` | Mesmos dados/filtros em tabela ordenável + paginação |
| `/admin/keywords` | `app/admin/keywords/page.tsx` | CRUD de keywords (criar, peso, ativar/desativar, remover) |
| `/admin/perfil` | `app/admin/perfil/page.tsx` | Editor do perfil da empresa (Markdown) |
| `/admin/filtros` | `app/admin/filtros/page.tsx` | Editor das regras do filtro heurístico |
| `/admin/execucoes` | `app/admin/execucoes/page.tsx` | Histórico de runs + botão "Rodar agora" (polling enquanto roda) |

## Componentes-chave

- **`Timeline`** — distribui os cards num canvas horizontal posicionado por `data_encerramento`, empilhando em "lanes" para evitar sobreposição. Cor por score (verde ≥80, amarelo 50–79, cinza <50).
- **`FilterSidebar`** — todos os filtros (busca com debounce, UF, categoria IA, slider de score, range de valor, status, arquivada, só favoritas, ordenação). Lê/escreve via `useFilters()`.
- **`LicitacaoDrawer`** — painel lateral (shadcn Sheet) com o detalhe completo + análise IA (score, categoria, justificativa, pontos fortes, red flags). Ações: reanalisar, arquivar/restaurar, favoritar.
- **`LicitacoesTable`** — grade ordenável usada em `/tabela`; clique na linha abre o drawer.
- **`LicitacaoCard`** — card compacto da timeline.

## Camada de dados

### `lib/api-client.ts`

Wrapper de `fetch` sobre todos os endpoints. Base URL vem de `NEXT_PUBLIC_API_URL` (fallback `http://localhost:3001`). Lança `ApiError` (com `status` e `body`) em respostas não-OK.

### TanStack Query

[`app/providers.tsx`](../apps/web/app/providers.tsx) provê o `QueryClient`. As páginas usam `useQuery`/`useMutation`. Exemplo do polling em `/admin/execucoes`: o `refetchInterval` fica em 3s enquanto `run_in_progress` for `true`, e desliga quando o run termina.

### Estado dos filtros — `lib/use-filters.ts`

`useFilters()` usa **nuqs** (`useQueryStates`) para manter os filtros na **querystring da URL**, tornando qualquer visão compartilhável por link. Os defaults batem com `DEFAULT_FILTERS` em [`lib/filters.ts`](../apps/web/lib/filters.ts) — quando o valor é o default, nuqs omite o param da URL, mantendo-a limpa.
