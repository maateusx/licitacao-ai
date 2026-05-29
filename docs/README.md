# Documentação — Licitações AI

Documentação técnica de referência da aplicação. Para instalação e primeiros passos, veja o [README principal](../README.md).

| Documento | Conteúdo |
|---|---|
| [Arquitetura](./arquitetura.md) | Visão geral do monorepo, componentes e fluxo de dados ponta-a-ponta |
| [Pipeline](./pipeline.md) | Coleta no PNCP → dedup → filtro heurístico → classificação Gemini |
| [API REST](./api.md) | Referência completa de todos os endpoints |
| [Banco de dados](./banco-de-dados.md) | Schema, tabelas, índices e relacionamentos |
| [Frontend](./frontend.md) | Estrutura do app Next.js, páginas e componentes |
| [Configuração](./configuracao.md) | Variáveis de ambiente e arquivos em `config/` |

> A especificação original do produto está em [`licitacoes-ai.spec`](../licitacoes-ai.spec). Em caso de divergência, **o código e esta documentação prevalecem** — a spec reflete o plano inicial.
