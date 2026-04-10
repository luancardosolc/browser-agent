# Desenvolvimento

## Pré-requisitos

- Node.js 18+
- Google Chrome

## Comandos

```bash
npm install          # instala dependências
npm run dev          # build + watch (hot reload via WXT)
npm run build        # build produção em .output/chrome-mv3/
npm run typecheck    # verifica tipos TypeScript
npm run test         # testes unitários (Vitest + jsdom)
```

## Carregar no Chrome

1. `npm run build`
2. Abrir `chrome://extensions`
3. Ativar "Modo do desenvolvedor"
4. "Carregar sem compactação" → selecionar `extension/.output/chrome-mv3/`

## Adicionar um novo page type

1. Editar `src/context/detector.ts` — adicionar caso em `detectPageType()`
2. Adicionar ao union type `PageType` em `src/types/index.ts`
3. Criar plugin em `src/plugins/` com `canHandle()` correspondente
4. Registrar em `src/entrypoints/content.ts`

## Estrutura de pastas

```
extension/
├── src/
│   ├── core/           ← engine, plugin-registry, form-intelligence
│   ├── plugins/        ← um sub-diretório por plugin
│   ├── context/        ← detector de tipo de página
│   ├── actions/        ← executor de ações DOM
│   ├── extractors/     ← extração de dados
│   ├── communication/  ← cliente HTTP para o backend
│   ├── entrypoints/    ← background, content, popup (WXT entry points)
│   └── types/          ← tipos e interfaces compartilhados
├── tests/              ← testes unitários (Vitest)
├── docs/               ← esta pasta
├── wxt.config.ts
└── vitest.config.ts
```
