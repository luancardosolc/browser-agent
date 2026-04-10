# Job Tracker — Browser Automation Agent Extension

Chrome Extension built with [WXT](https://wxt.dev/) + TypeScript. Atua como runtime de automação de browser integrado ao Job Tracker.

## Setup

```bash
cd extension
npm install
npm run dev        # modo desenvolvimento (hot reload)
npm run build      # build produção
npm run test       # testes unitários
```

Carregue a pasta `extension/.output/chrome-mv3/` no Chrome em `chrome://extensions` (modo desenvolvedor).

## Arquitetura

Ver [`docs/architecture.md`](docs/architecture.md).

## Plugins

Ver [`docs/plugins.md`](docs/plugins.md).

## Comunicação com backend

Ver [`docs/communication.md`](docs/communication.md).

## Desenvolvimento

Ver [`docs/development.md`](docs/development.md).
